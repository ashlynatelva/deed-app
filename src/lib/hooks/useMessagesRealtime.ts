"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Phase F — Supabase Realtime subscription for the messages table.
//
// Strategy:
//   We open a single per-route channel that listens to INSERT events on
//   `public.messages`. RLS doesn't apply to realtime fan-out at the
//   broadcast level — Supabase Realtime delivers every postgres_changes
//   event to subscribed clients regardless of policies. We therefore
//   either filter at the channel level (one channel per thread, with
//   `filter: 'thread_id=eq.<id>'`) for the thread detail page, or filter
//   in the callback (for the inbox view, where we want notification of
//   any thread the user is on).
//
//   When a new message lands that the user can see (passes the inbox
//   filter or matches the active thread), we call `router.refresh()`.
//   That re-runs the server component, re-fetches the data through RLS
//   (so we're guaranteed to display only what the user is allowed to
//   read), and seamlessly hands the new HTML to the client. No
//   merge-state-by-hand bugs.
//
// Why not just merge events into local state?
//   It works fine, but it forces us to mirror the server query logic
//   (sort, unread count, dedup) in the client. router.refresh() lets
//   the server keep being the source of truth at the cost of one extra
//   network round trip per inbound message — totally fine for an MVP
//   inbox.
// ─────────────────────────────────────────────────────────────────────────────

type Scope =
  | { kind: "inbox"; userId: string }
  | { kind: "thread"; threadId: string };

/**
 * Subscribe to message INSERTs and call `router.refresh()` on each
 * relevant event. Returns nothing — the hook is fire-and-forget.
 *
 * Pass `scope: { kind: 'thread', threadId }` on the thread detail page,
 * or `scope: { kind: 'inbox', userId }` on the inbox / client messages
 * page. The userId is the signed-in user's auth id; we filter inbox
 * events to messages NOT sent by self (own messages already show via
 * the action's optimistic flow + revalidatePath).
 */
export const useMessagesRealtime = (scope: Scope) => {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();

    // Channel name is namespaced by scope so multiple hook calls on the
    // same page (unlikely but possible) don't collide.
    const channelName =
      scope.kind === "thread"
        ? `messages:thread:${scope.threadId}`
        : `messages:inbox:${scope.userId}`;

    const channel = supabase.channel(channelName);

    if (scope.kind === "thread") {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${scope.threadId}`,
        },
        () => router.refresh(),
      );
    } else {
      // Inbox view: refresh on every INSERT (we can't filter by "threads
      // I'm on" server-side without a sub-select). The callback runs
      // cheaply when nothing changed because router.refresh() is a
      // no-op for content that hasn't changed.
      const userId = scope.userId;
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = (payload.new ?? null) as { sender_id?: string } | null;
          // Skip echoes of the user's own sends — those already revalidated
          // via the server action's revalidatePath.
          if (row?.sender_id === userId) return;
          router.refresh();
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, scope]);
};
