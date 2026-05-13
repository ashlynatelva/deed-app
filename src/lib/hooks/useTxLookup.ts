"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Tiny client-side lookup table for the agent's transactions: id → row.
 *
 * Replaces the old mock `getTransactionById(id)` accessor that the Tasks
 * page (and a couple of other interactive surfaces) reached for to resolve
 * a transaction reference back to a row. Loads once per mount; RLS scopes
 * the result to transactions the signed-in agent owns.
 *
 * Returns a `Map`-shaped object so callers can keep their existing
 * `.get(id)` call sites unchanged.
 */
export type LookupTx = Pick<
  Tables<"transactions">,
  "id" | "address" | "city" | "stage_key" | "status" | "closing" | "price"
>;

export const useTxLookup = (): Map<string, LookupTx> => {
  const [map, setMap] = React.useState<Map<string, LookupTx>>(() => new Map());

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      // Exclude soft-deleted transactions (migration 0019) so action
      // surfaces — add-task picker, task list, etc. — never offer a
      // deleted deal as a target.
      const { data } = await supabase
        .from("transactions")
        .select("id, address, city, stage_key, status, closing, price")
        .is("deleted_at", null);
      if (cancelled || !data) return;
      setMap(new Map(data.map((t) => [t.id, t as LookupTx])));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return map;
};
