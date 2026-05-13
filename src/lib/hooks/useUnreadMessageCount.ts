"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/components/shared/CurrentProfileProvider";

/**
 * Live unread-message count for the signed-in user. Powers the sidebar
 * badge on Messages.
 *
 * Strategy:
 *   1. Initial fetch: count messages addressed to me where my-side read
 *      flag is false. RLS scopes to threads I'm on.
 *   2. Realtime: subscribe to INSERT (new message) and UPDATE (read-flag
 *      flip) on `messages`. On any event, refetch the count. We don't
 *      try to maintain the count incrementally — it's a single integer
 *      and the round trip is cheap.
 *
 * Returns 0 until the first fetch resolves; the badge is hidden when 0
 * anyway so this never flashes a stale number.
 */
export const useUnreadMessageCount = (): number => {
  const { profile } = useCurrentProfile();
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const isAgent = profile.role === "agent" || profile.role === "admin";
    const readColumn = isAgent ? "read_by_agent" : "read_by_client";

    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq(readColumn, false)
        .neq("sender_id", profile.id);
      if (cancelled) return;
      if (error) {
        console.error("[useUnreadMessageCount] fetch", error);
        return;
      }
      setCount(c ?? 0);
    };

    void fetchCount();

    const channel = supabase
      .channel(`messages:unread:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = (payload.new ?? null) as { sender_id?: string } | null;
          if (row?.sender_id === profile.id) return; // own send
          void fetchCount();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => void fetchCount(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [profile.id, profile.role]);

  return count;
};
