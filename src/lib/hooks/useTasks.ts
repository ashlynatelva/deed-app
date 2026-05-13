"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/components/shared/CurrentProfileProvider";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import type { Task as LegacyTask } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// useTasks — Supabase-backed agent task list.
//
// Replaces the localStorage-backed prototype hook. Returns tasks in the
// legacy `Task` shape (`src/lib/types.ts`) so the existing `/agent/tasks`
// page renders identically without a structural rewrite.
//
// Why client-side and not a server component?
//   The Tasks page is interactive (filter chips, add/edit/delete modal,
//   inline checkbox toggle). Keeping the hook client-side preserves snappy
//   optimistic updates — the user clicks the checkbox and the row strikes
//   through instantly, with the Supabase write trailing.
//
// Writes are optimistic: we update local state first, then issue the
// network call. On error we roll back and surface the message via the
// returned `error`. The Tasks page wires `error` into the existing toast
// channel.
// ─────────────────────────────────────────────────────────────────────────────

type Row = Tables<"tasks">;

const toLegacy = (row: Row, agentName: string): LegacyTask => ({
  id: row.id,
  title: row.title,
  txId: row.transaction_id ?? "",
  // `assignee` has no DB column — single-agent MVP, always the current agent.
  // Editing it in the UI is allowed (won't crash) but isn't persisted.
  assignee: agentName,
  due: row.due_date ?? "",
  priority: row.priority,
  status: row.status,
  notes: row.notes ?? "",
  reminder: row.reminder,
});

type AddInput = Omit<LegacyTask, "id">;
type UpdatePatch = Partial<LegacyTask>;

type Ctx = {
  tasks: LegacyTask[];
  loading: boolean;
  error: string | null;
  add: (input: AddInput) => Promise<void>;
  update: (id: string, patch: UpdatePatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Convenience — flips a task between 'todo' and 'done'. */
  toggleDone: (id: string) => Promise<void>;
};

export const useTasks = (): Ctx => {
  const { profile } = useCurrentProfile();
  const [tasks, setTasks] = React.useState<LegacyTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Lazily memoize the Supabase client so it lives across renders without
  // being created during render itself (React Compiler is strict about this).
  const supabase = React.useMemo(() => createClient(), []);

  // Initial fetch. `profile` is stable for the session — refetching on
  // identity change handles login/logout in dev with hot reload. We
  // intentionally do NOT reset `loading`/`error` before kicking off the
  // async fetch — the initial `useState` already starts in `loading: true`,
  // and resetting these synchronously inside the effect would trigger an
  // extra render the compiler warns about.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (e) {
        console.error("[useTasks] load failed", e);
        setError(e.message);
        setLoading(false);
        return;
      }
      setTasks((data ?? []).map((r) => toLegacy(r, profile.full_name)));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, profile.id, profile.full_name]);

  const add = React.useCallback(
    async (input: AddInput) => {
      const insert: TablesInsert<"tasks"> = {
        organization_id: profile.organization_id,
        agent_id: profile.id,
        transaction_id: input.txId || null,
        title: input.title,
        notes: input.notes || null,
        due_date: input.due || null,
        priority: input.priority,
        status: input.status,
        reminder: input.reminder,
        created_by: profile.id,
      };
      const { data, error: e } = await supabase
        .from("tasks")
        .insert(insert)
        .select()
        .single();
      if (e || !data) {
        console.error("[useTasks.add]", e);
        setError(e?.message ?? "Could not add task.");
        return;
      }
      setTasks((prev) => [toLegacy(data, profile.full_name), ...prev]);
    },
    [supabase, profile.id, profile.organization_id, profile.full_name],
  );

  const update = React.useCallback(
    async (id: string, patch: UpdatePatch) => {
      // Optimistic local update.
      const prev = tasks;
      setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));

      const dbPatch: TablesUpdate<"tasks"> = {};
      if (patch.title     !== undefined) dbPatch.title    = patch.title;
      if (patch.txId      !== undefined) dbPatch.transaction_id = patch.txId || null;
      if (patch.due       !== undefined) dbPatch.due_date = patch.due || null;
      if (patch.priority  !== undefined) dbPatch.priority = patch.priority;
      if (patch.status    !== undefined) dbPatch.status   = patch.status;
      if (patch.notes     !== undefined) dbPatch.notes    = patch.notes || null;
      if (patch.reminder  !== undefined) dbPatch.reminder = patch.reminder;
      // `assignee` is intentionally not persisted (single-agent MVP).

      if (Object.keys(dbPatch).length === 0) return;

      const { error: e } = await supabase
        .from("tasks")
        .update(dbPatch)
        .eq("id", id);
      if (e) {
        console.error("[useTasks.update]", e);
        setError(e.message);
        setTasks(prev); // roll back
      }
    },
    [supabase, tasks],
  );

  const remove = React.useCallback(
    async (id: string) => {
      const prev = tasks;
      setTasks((cur) => cur.filter((t) => t.id !== id));
      const { error: e } = await supabase.from("tasks").delete().eq("id", id);
      if (e) {
        console.error("[useTasks.remove]", e);
        setError(e.message);
        setTasks(prev);
      }
    },
    [supabase, tasks],
  );

  const toggleDone = React.useCallback(
    async (id: string) => {
      const cur = tasks.find((t) => t.id === id);
      if (!cur) return;
      await update(id, { status: cur.status === "done" ? "todo" : "done" });
    },
    [tasks, update],
  );

  return { tasks, loading, error, add, update, remove, toggleDone };
};
