"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type {
  Representation,
  StageKey,
  TransactionStatus,
} from "@/lib/supabase/database.types";

// ─────────────────────────────────────────────────────────────────────────────
// Transactions server actions.
//
// Right now there's only one — `createTransaction` — but the file is the
// natural home for the rest of the agent-side mutations as we keep
// trimming mock surfaces.
//
// RLS gates (migration 0012 / "Agents read/write their txs"):
//   WITH CHECK (
//     organization_id = public.app_user_org()
//     AND public.app_user_role() in ('agent','admin')
//     AND (agent_id = auth.uid() OR public.app_user_role() = 'admin')
//   )
// — so the action must set `organization_id` from the user's profile and
// `agent_id = auth.uid()`. We derive both server-side to keep the client
// from spoofing them.
//
// Side effect to be aware of: the `bootstrap_transaction_stages` trigger
// from 0007 fires on insert and writes 9 `transaction_stages` rows with
// the correct done/current/upcoming pattern for the chosen stage_key.
// No app code needs to do it.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_KEYS = [
  "offer", "contract", "earnest", "inspection", "appraisal",
  "loan",  "ctc",      "walk",    "closing",
] as const satisfies readonly StageKey[];

const STATUS_KEYS = ["on_track", "needs_attention", "at_risk"] as const satisfies readonly TransactionStatus[];

const REPRESENTATIONS = [
  "buyer_client", "buyer_customer", "seller_client", "seller_customer",
] as const satisfies readonly Representation[];

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Input is loose strings (modal-friendly). Validation/coercion happens
 * inside so the caller doesn't need its own narrowing logic.
 */
export type CreateTransactionInput = {
  address: string;
  city?: string;
  /** Free-text price; the action parses to a number. Empty allowed. */
  price?: string;
  /** Loose category label, e.g. "Buyer · Single-family". */
  type?: string;
  representation?: string;
  stageKey?: string;
  status?: string;
  /** YYYY-MM-DD. */
  closing?: string;
};

/**
 * Parse a user-typed price like "$1,295,000" or "1295000" into a number.
 * Returns null if blank or unparseable — both surface to the DB as NULL.
 */
const parsePrice = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

const isOneOf = <T extends string>(value: string | undefined, allowed: readonly T[]): T | null => {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
};

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Result<{ id: string }>> {
  const address = input.address?.trim();
  if (!address) return { ok: false, error: "Property address is required." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Derive org from profile so the client can't supply it. Agents can
  // only create transactions in their own org (RLS would block otherwise,
  // but the explicit lookup also gives us a clean error message).
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };
  if (profile.role !== "agent" && profile.role !== "admin") {
    return { ok: false, error: "Only agents and admins can create transactions." };
  }

  const stageKey: StageKey = isOneOf(input.stageKey, STAGE_KEYS) ?? "offer";
  const status: TransactionStatus = isOneOf(input.status, STATUS_KEYS) ?? "on_track";
  const representation = isOneOf(input.representation, REPRESENTATIONS);

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      organization_id: profile.organization_id,
      agent_id: user.id,
      // client_id is intentionally null — gets populated when an invite
      // is accepted (Phase H flow).
      client_id: null,
      address,
      city: input.city?.trim() || null,
      price: parsePrice(input.price),
      type: input.type?.trim() || null,
      representation,
      stage_key: stageKey,
      status,
      closing: input.closing?.trim() || null,
      // listing_agent / co_agent left as null — the agent's own profile
      // shows on the detail page via the FK join.
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createTransaction]", error);
    return { ok: false, error: error?.message ?? "Could not create transaction." };
  }

  // Refresh every surface that lists or counts transactions.
  revalidatePath("/agent/transactions");
  revalidatePath("/agent/dashboard");
  revalidatePath("/agent/clients");

  return { ok: true, data: { id: data.id } };
}

// ─── delete (soft) ──────────────────────────────────────────────────────────
//
// Routes through the SECURITY DEFINER RPC `public.delete_transaction`
// (migration 0019), which validates that the caller is an agent who owns
// the transaction (or any admin in the same org) and stamps `deleted_at`.
//
// We don't drop the row — every dependent record (documents, messages,
// notifications, stages, tasks) keeps its FK reference intact for audit /
// future restore tooling. App-layer queries filter `deleted_at IS NULL`
// so the row disappears from active surfaces immediately.

/** Map RPC sentinel exception messages to user-facing copy. */
const deleteTxFriendlyError = (message: string): string => {
  switch (message) {
    case "not_signed_in":            return "You're not signed in.";
    case "caller_profile_missing":   return "Your profile couldn't be found.";
    case "caller_not_authorized":    return "Only agents and admins can delete transactions.";
    case "target_not_found":         return "Transaction not found.";
    case "target_other_organization":
      return "That transaction belongs to a different organization.";
    case "target_not_yours":         return "You can only delete transactions you own.";
    default:                         return message;
  }
};

export async function deleteTransaction(
  txId: string,
): Promise<Result> {
  if (!txId) return { ok: false, error: "Missing transaction id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_transaction", {
    target_tx_id: txId,
  });
  if (error) {
    console.error("[deleteTransaction]", error);
    return { ok: false, error: deleteTxFriendlyError(error.message) };
  }

  // Same surfaces as createTransaction — anything that lists or counts
  // active transactions needs to re-render.
  revalidatePath("/agent/transactions");
  revalidatePath("/agent/dashboard");
  revalidatePath("/agent/clients");
  revalidatePath("/agent/documents");

  return { ok: true, data: undefined };
}
