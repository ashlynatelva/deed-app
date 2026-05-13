import "server-only";

import { cache } from "react";

import { createClient } from "./server";
import type { Tables } from "./database.types";

// ─────────────────────────────────────────────────────────────────────────────
// Server-side data accessors used by layouts and server components.
//
// React's `cache()` dedupes calls within a single request — so the layout
// fetching the profile + a page fetching the same profile down the tree
// hit the DB only once.
//
// Every query relies on Supabase RLS to scope rows to the current user. The
// helpers don't repeat the `WHERE agent_id = auth.uid()` style filters that
// RLS already enforces — that would mask policy regressions. If a query
// returns 0 rows here for an authenticated user, RLS is the place to debug.
// ─────────────────────────────────────────────────────────────────────────────

export type Profile      = Tables<"profiles">;
export type Organization = Tables<"organizations">;
export type Transaction  = Tables<"transactions">;
export type Stage        = Tables<"transaction_stages">;
export type Task         = Tables<"tasks">;
export type Update       = Tables<"transaction_updates">;
export type DocumentRow  = Tables<"documents">;
export type ThreadRow       = Tables<"message_threads">;
export type MessageRow      = Tables<"messages">;
export type NotificationRow = Tables<"notifications">;
export type InviteRow       = Tables<"invites">;

/**
 * Returns the signed-in user's profiles row, or `null` for unauthenticated
 * requests. The proxy already prevents unauthenticated users from reaching
 * any /agent/* or /client/* path, so layouts can treat a null return as
 * an unexpected state.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data ?? null;
});

/**
 * Returns the single tenant's organization row.
 *
 * Single-tenant for MVP — there's exactly one configured org. When we move
 * to multi-tenant we'll resolve the org from a subdomain or path prefix
 * and this helper becomes `getOrganization(slug)`.
 */
export const getDefaultOrganization = cache(async (): Promise<Organization | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase D — transactions, tasks, transaction_updates
//
// These helpers return raw Supabase row shapes. Pages still receiving the
// legacy camelCase `Transaction` type (see `src/lib/types.ts`) wrap these
// via the mapper in `src/lib/supabase/transaction-shape.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `Transaction` + the related rows the detail page wants in one trip:
 *   - the curated stage timeline (9 rows, ordered by position)
 *   - the agent profile (always present — agent_id is NOT NULL)
 *   - the client profile (NULL until a client accepts an invite)
 *   - visible-on-this-tx transaction_updates (newest first)
 *
 * Documents, message threads, and tasks are loaded separately by their own
 * helpers so each page only pays for what it renders.
 */
export type EnrichedTransaction = Transaction & {
  stages: Stage[];
  updates: Update[];
  agent: Profile;
  client: Profile | null;
};

/**
 * All transactions visible to the signed-in agent. RLS restricts the row set
 * to transactions the agent owns (or all transactions if the user is admin).
 *
 * Ordered by `closing` ascending with NULLs last so the pipeline reads
 * earliest-closing first — matches the existing prototype's dashboard +
 * transactions table sort.
 */
export const getTransactionsForCurrentAgent = cache(
  async (): Promise<Transaction[]> => {
    const supabase = await createClient();
    // `deleted_at IS NULL` excludes soft-deleted transactions (migration
    // 0019). The row stays in the table so FK references on documents /
    // messages / notifications still resolve when reading history.
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .order("closing", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[queries.getTransactionsForCurrentAgent]", error);
      return [];
    }
    return data ?? [];
  },
);

/**
 * The single transaction owned by the signed-in client.
 *
 * RLS scopes this to `client_id = auth.uid()`. Returns the first row if a
 * client somehow has multiple transactions — the MVP's client portal assumes
 * one active transaction per client, but we don't crash if that changes.
 */
export const getTransactionForCurrentClient = cache(
  async (): Promise<Transaction | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  },
);

/**
 * Full detail-page payload for a single transaction. Returns `null` if the
 * id doesn't exist or RLS denies access — callers should treat both as 404.
 *
 * Implementation: a single round trip via Supabase's nested-select syntax
 * pulls the transaction + stages + updates + both party profiles. We then
 * normalize the shape so callers see `agent` / `client` as flat objects
 * rather than the Supabase `agent: { ... } | { ... }[]` ambiguity that
 * comes from FK-resolved selects.
 */
export const getEnrichedTransaction = cache(
  async (id: string): Promise<EnrichedTransaction | null> => {
    const supabase = await createClient();
    // Deleted transactions return null so the detail page renders a 404
    // instead of letting an agent who has the URL bookmarked land on a
    // page for a row that no longer belongs in their active workspace.
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        stages:transaction_stages(*),
        updates:transaction_updates(*),
        agent:profiles!transactions_agent_id_fkey(*),
        client:profiles!transactions_client_id_fkey(*)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[queries.getEnrichedTransaction]", { id, error });
      return null;
    }
    if (!data) return null;

    // Supabase's FK-resolved selects return either an object or a single-
    // element array depending on the cardinality it infers. Normalize.
    const agentRow   = Array.isArray(data.agent)  ? data.agent[0]  : data.agent;
    const clientRow  = Array.isArray(data.client) ? data.client[0] : data.client;
    if (!agentRow) return null;

    const stages: Stage[] = Array.isArray(data.stages)
      ? [...data.stages].sort((a, b) => a.position - b.position)
      : [];
    const updates: Update[] = Array.isArray(data.updates)
      ? [...data.updates].sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        )
      : [];

    // Strip the joined fields off the base row so the spread below doesn't
    // duplicate them with a different shape than `Transaction` expects.
    const txRow = { ...data } as Record<string, unknown>;
    delete txRow.stages;
    delete txRow.updates;
    delete txRow.agent;
    delete txRow.client;

    return {
      ...(txRow as unknown as Transaction),
      stages,
      updates,
      agent: agentRow as Profile,
      client: (clientRow as Profile | null) ?? null,
    };
  },
);

/**
 * All tasks owned by the signed-in agent. The legacy `useTasks` localStorage
 * store sorted by due-date ascending (with nulls last); we match that so the
 * Tasks page renders identically.
 */
export const getTasksForCurrentAgent = cache(
  async (): Promise<Task[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[queries.getTasksForCurrentAgent]", error);
      return [];
    }
    return data ?? [];
  },
);

/**
 * Client profiles tied to transactions the signed-in agent owns. RLS gives
 * the agent read access to org members, and we filter to role='client' here
 * to keep the Clients page noise-free.
 *
 * Each row is paired with its primary transaction (closing-soonest), which
 * the Clients page renders as the property column.
 */
export type ClientWithTransaction = {
  profile: Profile;
  transaction: Transaction | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase E — documents
//
// RLS scopes every read here:
//   - Agents see documents on transactions they own.
//   - Clients see documents on transactions they own (filtered to
//     client_visible = true here as well so internal docs never leak).
//
// `storage_path` is null for seed/metadata-only rows. Pages render them
// in the list but the preview modal falls back to a "no underlying file"
// state — same UX the prototype shipped with.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All documents on a single transaction (agent perspective — includes
 * internal/compliance docs the client can't see). Newest update first.
 */
export const getDocumentsForTransaction = cache(
  async (txId: string): Promise<DocumentRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("transaction_id", txId)
      .order("updated_at", { ascending: false, nullsFirst: false });
    if (error) {
      console.error("[queries.getDocumentsForTransaction]", { txId, error });
      return [];
    }
    return data ?? [];
  },
);

/**
 * Documents on the signed-in client's transaction. Filtered to
 * `client_visible = true` so internal-only rows never reach the client UI
 * (RLS would block them anyway — this is belt-and-suspenders and lets the
 * caller treat the result as already-safe to render).
 */
export const getClientVisibleDocumentsForTransaction = cache(
  async (txId: string): Promise<DocumentRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("transaction_id", txId)
      .eq("client_visible", true)
      .order("updated_at", { ascending: false, nullsFirst: false });
    if (error) {
      console.error("[queries.getClientVisibleDocumentsForTransaction]", { txId, error });
      return [];
    }
    return data ?? [];
  },
);

/**
 * Flat list of every document the signed-in agent has access to (used by
 * `/agent/documents`). Each row is paired with its transaction so the
 * page can render the property column without a second round trip.
 */
export type DocumentWithTransaction = {
  doc: DocumentRow;
  transaction: Pick<Transaction, "id" | "address">;
};

export const getAllDocumentsForCurrentAgent = cache(
  async (): Promise<DocumentWithTransaction[]> => {
    const supabase = await createClient();
    // Pull `deleted_at` on the embedded transaction so we can filter out
    // documents whose underlying tx has been soft-deleted. The column
    // isn't shipped down to the page (we discard it below) — it's just a
    // gate.
    const { data, error } = await supabase
      .from("documents")
      .select(`
        *,
        transaction:transactions!inner(id, address, deleted_at)
      `)
      .order("updated_at", { ascending: false, nullsFirst: false });
    if (error) {
      console.error("[queries.getAllDocumentsForCurrentAgent]", error);
      return [];
    }
    if (!data) return [];

    return data.flatMap((row) => {
      // Supabase inlines the joined transaction as either an object or a
      // single-element array; normalize to plain object.
      const tx = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction;
      if (!tx || tx.deleted_at) return [];
      const doc = { ...row } as Record<string, unknown>;
      delete doc.transaction;
      return [{
        doc: doc as unknown as DocumentRow,
        transaction: { id: tx.id, address: tx.address },
      }];
    });
  },
);

export const getClientsForCurrentAgent = cache(
  async (): Promise<ClientWithTransaction[]> => {
    const supabase = await createClient();

    // Step 1: pull the agent's transactions (RLS already filters).
    // Soft-deleted transactions are excluded so an agent's "clients" list
    // doesn't surface a client whose only relationship was via a tx
    // that's since been deleted.
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .order("closing", { ascending: true, nullsFirst: false });
    if (txErr) {
      console.error("[queries.getClientsForCurrentAgent] txs", txErr);
      return [];
    }
    if (!txs || txs.length === 0) return [];

    const clientIds = Array.from(
      new Set(txs.map((t) => t.client_id).filter((v): v is string => Boolean(v))),
    );
    if (clientIds.length === 0) return [];

    // Step 2: pull the client profiles. The "Org staff read org profiles"
    // RLS policy on profiles lets agents read every profile in their org,
    // so this returns exactly the client_ids we asked for. We hide
    // inactive/deleted clients here so the agent's "active clients" list
    // matches the soft-delete semantics from migration 0016 — historical
    // transactions still reference these profile rows, but they don't
    // belong on a "who am I currently working with" list.
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .in("id", clientIds)
      .eq("role", "client")
      .eq("status", "active");
    if (pErr) {
      console.error("[queries.getClientsForCurrentAgent] profiles", pErr);
      return [];
    }

    const byId = new Map((profiles ?? []).map((p) => [p.id, p] as const));
    // Preserve transaction-order so the Clients page renders in the same
    // order as the pipeline (closing-soonest first).
    const out: ClientWithTransaction[] = [];
    for (const t of txs) {
      if (!t.client_id) continue;
      const profile = byId.get(t.client_id);
      if (!profile) continue;
      out.push({ profile, transaction: t });
    }
    return out;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Phase F — message threads + messages
//
// The 0001 trigger `messages_on_insert` handles:
//   - notification fan-out to the other party
//   - auto-reopen of resolved threads on a client reply
//   - bump `message_threads.updated_at`
//   - write to activity_log
//
// So the app code only needs to insert messages — every downstream effect
// is automatic.
//
// RLS scope (from 0002, unchanged by 0007/0012):
//   - "Read threads I am on": agent or client of the thread
//   - "Read messages on accessible threads": same gate via thread_id
//   No subquery on profiles, so these are recursion-safe.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A thread plus a denormalized snapshot used by inbox lists:
 *   - `lastMessage`  — most-recent message (for the preview row)
 *   - `unreadCount`  — messages the signed-in user hasn't read yet
 *
 * The signed-in user's role determines which `read_by_*` column is checked.
 */
export type ThreadSummary = {
  thread: ThreadRow;
  lastMessage: MessageRow | null;
  unreadCount: number;
};

/**
 * Every thread the signed-in user can see (RLS scopes to agent_id or
 * client_id = auth.uid()). Sorted by `updated_at` desc — the trigger bumps
 * that field every time a new message lands, so the inbox naturally floats
 * the most-recently-active thread to the top.
 *
 * Pulls every message for every thread in a single round trip via the
 * Supabase nested-select syntax. Acceptable for an MVP-sized inbox; if
 * thread counts ever exceed a few hundred we'll switch to a sql view.
 */
export const getThreadsForCurrentUser = cache(
  async (): Promise<ThreadSummary[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("message_threads")
      .select(`
        *,
        messages(*)
      `)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[queries.getThreadsForCurrentUser]", error);
      return [];
    }
    if (!data) return [];

    // Resolve which read flag matters for this user. Agents see threads
    // where they're the agent; clients see threads where they're the
    // client. Cross-org or admin reads aren't a thing in the MVP.
    return data.map((row) => {
      const msgs = (Array.isArray(row.messages) ? row.messages : []) as MessageRow[];
      msgs.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const isAgentSide = row.agent_id === user.id;
      const unreadCount = msgs.reduce((n, m) => {
        const readByMe = isAgentSide ? m.read_by_agent : m.read_by_client;
        // Don't count my own messages as unread — I sent them.
        const mineToSend = m.sender_id === user.id;
        return n + (readByMe || mineToSend ? 0 : 1);
      }, 0);

      // Strip the joined messages off the row before returning, keeping
      // the summary fields denormalized on the response.
      const threadCopy = { ...row } as Record<string, unknown>;
      delete threadCopy.messages;
      return {
        thread: threadCopy as unknown as ThreadRow,
        lastMessage: last,
        unreadCount,
      };
    });
  },
);

/**
 * A single thread with its full message history, ordered oldest first.
 * Returns `null` if RLS denies access or the thread doesn't exist —
 * callers should treat both as 404.
 */
export type ThreadWithMessages = {
  thread: ThreadRow;
  messages: MessageRow[];
};

export const getThreadWithMessages = cache(
  async (threadId: string): Promise<ThreadWithMessages | null> => {
    const supabase = await createClient();
    const { data: thread, error: threadErr } = await supabase
      .from("message_threads")
      .select("*")
      .eq("id", threadId)
      .maybeSingle();
    if (threadErr) {
      console.error("[queries.getThreadWithMessages] thread", threadErr);
      return null;
    }
    if (!thread) return null;

    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (msgErr) {
      console.error("[queries.getThreadWithMessages] messages", msgErr);
      return { thread, messages: [] };
    }

    return { thread, messages: messages ?? [] };
  },
);

/**
 * Total count of unread messages across every thread the user can see.
 * Powers the sidebar badge. Counts messages addressed TO the user
 * (sender !== self) where the user-side read flag is false.
 */
export const getUnreadMessageCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  // Pull just the columns we need to compute the count. RLS already
  // scopes `messages` to threads the user is on.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAgent = profile?.role === "agent" || profile?.role === "admin";
  const readColumn = isAgent ? "read_by_agent" : "read_by_client";

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq(readColumn, false)
    .neq("sender_id", user.id);
  if (error) {
    console.error("[queries.getUnreadMessageCount]", error);
    return 0;
  }
  return count ?? 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase G — notifications
//
// The notifications table is populated entirely by triggers (see 0001):
//   - `messages_on_insert` → "New message" notification to the other party
//   - `transactions_on_stage_change` → "Stage updated" notification to the client
//
// RLS (from 0002, recursion-safe):
//   - "Read own notifications": recipient_id = auth.uid()
//   - "Update own notifications": same gate (used to flip `read = true`)
//   - No INSERT policy — only service-role / triggers write rows.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recent notifications for the signed-in user, newest first. Default
 * limit is generous enough for the history view but small enough that
 * the bell dropdown can show the same call without a separate query.
 */
export const getNotificationsForCurrentUser = cache(
  async (limit = 50): Promise<NotificationRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[queries.getNotificationsForCurrentUser]", error);
      return [];
    }
    return data ?? [];
  },
);

/**
 * Total unread notifications for the signed-in user. Used for the bell
 * dot indicator. RLS already scopes to recipient_id.
 */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) {
    console.error("[queries.getUnreadNotificationCount]", error);
    return 0;
  }
  return count ?? 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase H — invites
//
// RLS (after 0012):
//   - "Agents manage invites in their org": agent + admin SELECT/INSERT/
//     UPDATE/DELETE on rows in their org.
//   - No client-side policy. The public /invite/[token] page reaches the
//     row through a service-role action, not through the user-session
//     client.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pending CLIENT invites the signed-in agent owns. Used to surface
 * pending portal invitations on the Clients page alongside seated
 * clients. Scoped to `target_role = 'client'` after Phase K so agent
 * invites don't bleed into the client surface.
 */
// ─── shared error helpers ──────────────────────────────────────────────────
//
// Some PostgrestError shapes serialize to `{}` through Node's default
// console.error formatter (the properties end up non-enumerable for
// reasons that depend on the supabase-js version + the error source).
// We unpack the standard fields explicitly so dev-console output is
// always actionable.
type PgErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};
const formatPgError = (err: PgErrorLike) => ({
  code:    err.code    ?? null,
  message: err.message ?? null,
  details: err.details ?? null,
  hint:    err.hint    ?? null,
});

// Schema-cache misses on a freshly-added column produce one of these
// shapes depending on the PostgREST version. Recognising them lets a
// caller fall back to a less-filtered query while the cache catches up.
const isSchemaCacheMiss = (err: PgErrorLike): boolean => {
  if (err.code === "PGRST204") return true;       // schema cache miss
  if (err.code === "42703")    return true;       // undefined_column
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("does not exist") && msg.includes("column");
};

export const getPendingInvitesForCurrentAgent = cache(
  async (): Promise<InviteRow[]> => {
    const supabase = await createClient();

    // Primary query: filter to client invites only.
    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .eq("status", "pending")
      .eq("target_role", "client")
      .order("created_at", { ascending: false });

    if (!error) return data ?? [];

    // Schema-cache fallback: if PostgREST hasn't seen `target_role` yet
    // (column added by 0017), every existing row is a client invite by
    // backfill — fall back to a target_role-agnostic query so the page
    // renders. Log a structured error so the operator knows to reload
    // the cache.
    if (isSchemaCacheMiss(error)) {
      console.warn(
        "[queries.getPendingInvitesForCurrentAgent] target_role not in schema cache — falling back. Run `NOTIFY pgrst, 'reload schema';` to refresh.",
        formatPgError(error),
      );
      const fallback = await supabase
        .from("invites")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return fallback.data ?? [];
    }

    console.error(
      "[queries.getPendingInvitesForCurrentAgent]",
      formatPgError(error),
    );
    return [];
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Phase K — team management. Admins use these to populate the Team page.
// ─────────────────────────────────────────────────────────────────────────────

export type TeamMember = Profile;

/**
 * All agents + admins in the signed-in user's organization, sorted with
 * the signed-in user first, then admins, then agents by name. The
 * "Org staff read org profiles" policy from 0012 already lets the
 * caller read every profile in their org — we filter by role in code
 * so the policy stays simple.
 *
 * Inactive (revoked) members are included in the list so admins can
 * see who's been off-boarded and (eventually) restore them. The page
 * UI surfaces the status badge.
 */
export const getTeamMembers = cache(async (): Promise<TeamMember[]> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["agent", "admin"])
    .order("role", { ascending: true })   // admin before agent
    .order("full_name", { ascending: true });
  if (error) {
    console.error("[queries.getTeamMembers]", error);
    return [];
  }

  // Float the signed-in user to the top so the admin sees themselves first.
  const rows = data ?? [];
  return rows.sort((a, b) => {
    if (a.id === user.id) return -1;
    if (b.id === user.id) return 1;
    return 0;
  });
});

/**
 * Pending agent + admin invites for the signed-in user's organization.
 * Read by the Team page. Returns invites where `target_role` is
 * agent or admin (i.e. NOT client invites — those have a separate
 * helper above).
 */
export const getPendingAgentInvitesForCurrentOrg = cache(
  async (): Promise<InviteRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .eq("status", "pending")
      .in("target_role", ["agent", "admin"])
      .order("created_at", { ascending: false });

    if (!error) return data ?? [];

    // If `target_role` isn't in PostgREST's schema cache yet (just after
    // applying 0017), no team invites can exist in the DB anyway — the
    // column literally just appeared. Return [] cleanly and warn the
    // operator instead of bubbling an empty {} error to the dev console.
    if (isSchemaCacheMiss(error)) {
      console.warn(
        "[queries.getPendingAgentInvitesForCurrentOrg] target_role not in schema cache — returning []. Run `NOTIFY pgrst, 'reload schema';` to refresh.",
        formatPgError(error),
      );
      return [];
    }

    console.error(
      "[queries.getPendingAgentInvitesForCurrentOrg]",
      formatPgError(error),
    );
    return [];
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming deadlines for the agent dashboard panel.
//
// Three real sources, unioned and ordered by date:
//   1. `transactions.closing`     → "Closing — <address>"
//   2. `transaction_stages.due_date` (state != 'done') → "<stage label> — <address>"
//   3. `tasks.due_date` (status != 'done')             → "<title> — <address?>"
//
// RLS scopes everything: agents only see their own rows. The closing
// stage's due_date is by convention the transaction's closing date, so
// we skip it during stage iteration to avoid a duplicate row.
// ─────────────────────────────────────────────────────────────────────────────

export type UpcomingDeadline = {
  id: string;
  label: string;
  /** YYYY-MM-DD (date-only, suitable for fmtShort / daysFromNow). */
  date: string;
  who: string;
};

const DEADLINE_STAGE_LABEL: Record<string, string> = {
  offer:      "Offer sent",
  contract:   "Under contract",
  earnest:    "Earnest money",
  inspection: "Inspection",
  appraisal:  "Appraisal",
  loan:       "Loan approval",
  ctc:        "Clear to close",
  walk:       "Final walkthrough",
  closing:    "Closing",
};

const toDeadlineDay = (iso: string): string => iso.slice(0, 10);

export const getUpcomingDeadlinesForCurrentAgent = cache(
  async (daysAhead = 14, limit = 5): Promise<UpcomingDeadline[]> => {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startISO = today.toISOString().slice(0, 10);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + daysAhead);
    const endISO = horizon.toISOString().slice(0, 10);

    // Pull the agent's transactions once. RLS scopes the rows; the lookup
    // table is reused for stage + task labels below. Soft-deleted txs
    // are excluded so deleted deals don't pollute the deadlines feed.
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("id, address, closing, client_id")
      .is("deleted_at", null);
    if (txErr) {
      console.error("[getUpcomingDeadlinesForCurrentAgent] txs", txErr);
      return [];
    }
    const txById = new Map((txs ?? []).map((t) => [t.id, t] as const));

    // Resolve client display names. RLS lets agents read profiles in
    // their org via the "Org staff read org profiles" policy.
    const clientIds = Array.from(
      new Set(
        (txs ?? [])
          .map((t) => t.client_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const clientNameById = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", clientIds);
      for (const p of profiles ?? []) {
        clientNameById.set(p.id, p.full_name);
      }
    }
    const whoForTx = (txId: string): string => {
      const tx = txById.get(txId);
      if (!tx || !tx.client_id) return "Unassigned";
      return clientNameById.get(tx.client_id) ?? "Client";
    };

    // Non-done stage deadlines inside the window.
    const { data: stages } = await supabase
      .from("transaction_stages")
      .select("id, transaction_id, stage_key, state, due_date")
      .gte("due_date", startISO)
      .lte("due_date", endISO)
      .neq("state", "done");

    // Open task deadlines inside the window.
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, transaction_id, status")
      .gte("due_date", startISO)
      .lte("due_date", endISO)
      .neq("status", "done");

    const out: UpcomingDeadline[] = [];

    // (1) Closings.
    for (const tx of txs ?? []) {
      if (!tx.closing) continue;
      const date = toDeadlineDay(tx.closing);
      if (date < startISO || date > endISO) continue;
      out.push({
        id: `closing:${tx.id}`,
        label: `Closing — ${tx.address}`,
        date,
        who: whoForTx(tx.id),
      });
    }

    // (2) Stages, skipping `closing` (already represented above).
    for (const s of stages ?? []) {
      if (!s.due_date) continue;
      if (s.stage_key === "closing") continue;
      const tx = txById.get(s.transaction_id);
      if (!tx) continue;
      const stageLabel = DEADLINE_STAGE_LABEL[s.stage_key] ?? s.stage_key;
      out.push({
        id: `stage:${s.id}`,
        label: `${stageLabel} — ${tx.address}`,
        date: toDeadlineDay(s.due_date),
        who: whoForTx(tx.id),
      });
    }

    // (3) Tasks.
    for (const t of tasks ?? []) {
      if (!t.due_date) continue;
      const address = t.transaction_id
        ? txById.get(t.transaction_id)?.address
        : null;
      out.push({
        id: `task:${t.id}`,
        label: address ? `${t.title} — ${address}` : t.title,
        date: toDeadlineDay(t.due_date),
        who: t.transaction_id ? whoForTx(t.transaction_id) : "Internal",
      });
    }

    return out
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, limit);
  },
);
