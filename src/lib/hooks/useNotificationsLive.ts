"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/components/shared/CurrentProfileProvider";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import {
  mapNotification,
  type ClientNotification,
} from "@/lib/supabase/notification-shape";
import type { NotificationRow } from "@/lib/supabase/queries";

// ─────────────────────────────────────────────────────────────────────────────
// Phase G — Live notifications hook.
//
// Single source of truth for both <NotificationsBell> (top-nav dropdown)
// and <NotificationHistory> (full page). The hook:
//
//   1. Fetches the most-recent `limit` notifications for the signed-in
//      user. RLS scopes by recipient_id so we don't filter again here.
//
//   2. Subscribes to a Realtime channel for INSERTs + UPDATEs on
//      `public.notifications`. The channel filter narrows to
//      `recipient_id=eq.<user.id>` so unrelated rows don't even reach
//      the browser.
//
//   3. Maintains a local state array — INSERT prepends, UPDATE replaces
//      by id. This avoids router.refresh() ping-pong since the bell is
//      always-mounted from TopNav.
//
//   4. Mutations call the server actions (which revalidate the
//      notifications pages); we also optimistically flip the local
//      state so the dropdown UI doesn't flicker between server round
//      trips.
// ─────────────────────────────────────────────────────────────────────────────

type Hook = {
  notifications: ClientNotification[];
  unreadCount: number;
  /**
   * Mark a single notification as read. Returns a promise that resolves
   * AFTER the Supabase write commits — callers that navigate immediately
   * after marking should `await` this so the next page's bell fetch sees
   * the persisted read state instead of racing it.
   */
  markRead: (id: string) => Promise<void>;
  /** Same contract as `markRead` — awaits the bulk update. */
  markAllRead: () => Promise<void>;
};

export const useNotificationsLive = (limit = 50): Hook => {
  const { profile } = useCurrentProfile();
  const role: "agent" | "client" = profile.role === "client" ? "client" : "agent";
  const [rows, setRows] = React.useState<NotificationRow[]>([]);

  // Per-instance suffix so two consumers of this hook (e.g. <NotificationsBell>
  // mounted in TopNav + <NotificationHistory> on the page) don't subscribe to
  // a channel with the exact same name and risk colliding.
  const instanceId = React.useId();

  // Cache the "now" reference per render so timestamps don't flicker on
  // unrelated re-renders. We refresh it once per minute to keep "12m
  // ago" honest without spamming React.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      if (error) {
        console.error("[useNotificationsLive] fetch", error);
        return;
      }
      setRows(data ?? []);
    };
    void fetchInitial();

    const channel = supabase
      .channel(`notifications:${profile.id}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const newRow = payload.new as NotificationRow;
          setRows((prev) => {
            // Dedup by id in case the initial fetch also lands.
            if (prev.some((r) => r.id === newRow.id)) return prev;
            return [newRow, ...prev].slice(0, limit);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as NotificationRow;
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === updated.id);
            if (idx === -1) {
              // Race: UPDATE arrived before our initial fetch returned, or
              // the row was paginated out. Insert in created-at order so
              // the bell still reflects the latest state.
              const next = [updated, ...prev];
              next.sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              );
              return next.slice(0, limit);
            }
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [profile.id, limit, instanceId]);

  const notifications = React.useMemo(
    () => rows.map((r) => mapNotification(r, role, now)),
    [rows, role, now],
  );
  const unreadCount = notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);

  const markRead = React.useCallback(async (id: string) => {
    // Optimistic: flip locally so the bell + history update before the
    // network round trip resolves.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)));
    // Await the server write so the caller can chain a navigation that
    // re-mounts the bell on the next page — without this await, the next
    // page's initial fetch can race the write and momentarily show the
    // notification as unread again.
    await markNotificationRead(id);
  }, []);

  const markAllRead = React.useCallback(async () => {
    setRows((prev) => prev.map((r) => (r.read ? r : { ...r, read: true })));
    await markAllNotificationsRead();
  }, []);

  return { notifications, unreadCount, markRead, markAllRead };
};
