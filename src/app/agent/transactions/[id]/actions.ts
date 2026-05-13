"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { StageKey } from "@/lib/supabase/database.types";

const STAGE_ORDER: StageKey[] = [
  "offer", "contract", "earnest", "inspection", "appraisal",
  "loan",  "ctc",      "walk",    "closing",
];

type Result =
  | { ok: true; nextKey: StageKey }
  | { ok: false; error: string };

/**
 * Advance a transaction to the next stage in the canonical 9-step pipeline.
 *
 * Side effects:
 *   1. Marks the current `transaction_stages` row as `done` with today's date.
 *   2. Marks the next `transaction_stages` row as `current`.
 *   3. Updates `transactions.stage_key` — which fires the fan-out trigger
 *      installed in migration 0001 (creates a `transaction_updates` row +
 *      notifications for both agent and client).
 *
 * Refuses to advance past 'closing'. RLS scopes the writes to transactions
 * the agent owns.
 */
export async function advanceStage(txId: string): Promise<Result> {
  const supabase = await createClient();

  // 1. Read current stage_key so we know what to mark done.
  // Soft-deleted transactions can't have their stage advanced — the
  // detail page already 404s for them via `getEnrichedTransaction`, but
  // a stale tab with a deleted tx open could still post this action.
  const { data: tx, error: readErr } = await supabase
    .from("transactions")
    .select("stage_key")
    .eq("id", txId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readErr || !tx) {
    return { ok: false, error: readErr?.message ?? "Transaction not found." };
  }

  const idx = STAGE_ORDER.indexOf(tx.stage_key as StageKey);
  if (idx < 0) {
    return { ok: false, error: `Unknown stage: ${tx.stage_key}` };
  }
  if (idx >= STAGE_ORDER.length - 1) {
    return { ok: false, error: "Transaction is already at the final stage." };
  }
  const nextKey = STAGE_ORDER[idx + 1];
  const today = new Date().toISOString().slice(0, 10);

  // 2. Mark current stage done.
  const { error: doneErr } = await supabase
    .from("transaction_stages")
    .update({ state: "done", done_date: today })
    .eq("transaction_id", txId)
    .eq("stage_key", tx.stage_key);
  if (doneErr) return { ok: false, error: doneErr.message };

  // 3. Mark next stage current.
  const { error: nextErr } = await supabase
    .from("transaction_stages")
    .update({ state: "current" })
    .eq("transaction_id", txId)
    .eq("stage_key", nextKey);
  if (nextErr) return { ok: false, error: nextErr.message };

  // 4. Update the transaction itself — fires the fan-out trigger.
  const { error: txErr } = await supabase
    .from("transactions")
    .update({ stage_key: nextKey })
    .eq("id", txId);
  if (txErr) return { ok: false, error: txErr.message };

  revalidatePath(`/agent/transactions/${txId}`);
  revalidatePath("/agent/transactions");
  revalidatePath("/agent/dashboard");
  return { ok: true, nextKey };
}
