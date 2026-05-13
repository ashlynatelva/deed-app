"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/components/shared/CurrentProfileProvider";
import { daysFromNow } from "@/lib/format";

/**
 * Live KPI summary for the agent sidebar's footer card.
 *
 * Returns:
 *   - `activeValue`   sum of `price` across the signed-in agent's transactions
 *   - `closingSoon`   count of those transactions whose closing date falls in
 *                     the next 30 days (and isn't in the past)
 *
 * Why a dedicated hook rather than `useTxLookup`:
 *   1. `useTxLookup` relies entirely on RLS to scope rows. For an `admin`
 *      caller the RLS policy returns every transaction in the org — which
 *      would inflate the sidebar's "your active deals" total. This hook
 *      explicitly filters by `agent_id = auth.uid()` so the value always
 *      reflects what the SIGNED-IN user owns, regardless of role.
 *   2. `useTxLookup` fetches once on mount and never re-fetches. The
 *      sidebar is rendered on every agent page, so after the agent creates
 *      their first transaction the footer would stay stuck on the
 *      pre-create snapshot until a hard reload. This hook subscribes to
 *      Postgres changes on `transactions` and re-runs the count whenever
 *      the agent's row set could have changed.
 */
export type AgentKpiSummary = {
  /** Sum of `price` (USD, whole dollars) across the agent's transactions. */
  activeValue: number;
  /** Number of the agent's transactions closing in the next 30 days. */
  closingSoon: number;
};

const EMPTY: AgentKpiSummary = { activeValue: 0, closingSoon: 0 };

export const useAgentKpiSummary = (): AgentKpiSummary => {
  const { profile } = useCurrentProfile();
  const userId = profile.id;
  const [summary, setSummary] = React.useState<AgentKpiSummary>(EMPTY);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const recompute = async () => {
      // Explicit agent_id filter. RLS already restricts the row set, but
      // the explicit filter is what lets this work cleanly for admin
      // accounts too — they should see their own deal value in the
      // sidebar, not the whole org's.
      // Exclude soft-deleted transactions (migration 0019) so the
      // sidebar's "active deals" total reflects only the deals the
      // agent is currently working on.
      const { data, error } = await supabase
        .from("transactions")
        .select("price, closing")
        .eq("agent_id", userId)
        .is("deleted_at", null);

      if (cancelled) return;
      if (error) {
        console.error("[useAgentKpiSummary] fetch", error);
        return;
      }

      const activeValue = (data ?? []).reduce(
        (sum, row) => sum + (row.price ?? 0),
        0,
      );
      const closingSoon = (data ?? []).filter((row) => {
        const d = daysFromNow(row.closing);
        return d !== null && d >= 0 && d <= 30;
      }).length;

      setSummary({ activeValue, closingSoon });
    };

    void recompute();

    // Listen for any insert/update/delete on `transactions`. We don't try
    // to filter the channel server-side — the cheap thing is to recompute
    // on any event since each event implies the agent's row set MAY have
    // changed (e.g. an admin assigning them a deal). The query inside
    // recompute() still enforces agent_id = current user.
    const channel = supabase
      .channel(`transactions:agent-kpi:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => void recompute(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return summary;
};
