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

// ─── update ─────────────────────────────────────────────────────────────────
//
// Editable transaction fields, mirroring `CreateTransactionInput` but
// every field optional so the caller can do a partial update. The
// existing transactions RLS policy (`Agents read/write their txs`,
// migration 0012) already gates UPDATEs to the row's owning agent /
// admins-in-org, so we don't need a SECURITY DEFINER RPC — we just
// have to be defensive about which columns we send. Specifically:
//   - `agent_id` / `organization_id` / `client_id` are never accepted
//     from caller input. Reassigning a transaction to a different
//     agent or org is a different action surface.
//   - Soft-deleted rows are out of bounds. The `.is("deleted_at", null)`
//     filter on the update means a deleted tx silently returns
//     zero-rows-affected; we surface that as a "not found" error.

export type UpdateTransactionInput = {
  address?: string;
  city?: string;
  /** Free-text price; parsed via parsePrice. Empty clears the value. */
  price?: string;
  type?: string;
  representation?: string;
  stageKey?: string;
  status?: string;
  /** YYYY-MM-DD. Empty clears the value. */
  closing?: string;
};

const updateTxFriendlyError = (raw: string | null): string => {
  if (!raw) return "Could not update transaction.";
  // PostgREST returns a sentinel string when the UPDATE matched no rows
  // — that's how `.is("deleted_at", null)` excludes deleted rows. Map to
  // a clearer message.
  if (/no rows|matched 0/i.test(raw)) {
    return "Transaction not found or no longer editable.";
  }
  return raw;
};

export async function updateTransaction(
  txId: string,
  input: UpdateTransactionInput,
): Promise<Result> {
  if (!txId) return { ok: false, error: "Missing transaction id." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Build the patch from the input, skipping undefined entries so the
  // caller can do a partial update and only the touched columns hit the
  // database. Trim strings here so we don't push leading/trailing
  // whitespace into the DB.
  //
  // The type annotation matches what Supabase's generated Update shape
  // accepts (TablesUpdate<"transactions">). agent_id / organization_id /
  // client_id are deliberately NOT mirrored into the patch — see file
  // header comment.
  const patch: {
    address?: string;
    city?: string | null;
    price?: number | null;
    type?: string | null;
    representation?: Representation | null;
    stage_key?: StageKey;
    status?: TransactionStatus;
    closing?: string | null;
  } = {};

  if (input.address !== undefined) {
    const trimmed = input.address.trim();
    if (!trimmed) {
      return { ok: false, error: "Property address is required." };
    }
    patch.address = trimmed;
  }
  if (input.city !== undefined) {
    patch.city = input.city.trim() || null;
  }
  if (input.price !== undefined) {
    patch.price = parsePrice(input.price);
  }
  if (input.type !== undefined) {
    patch.type = input.type.trim() || null;
  }
  if (input.representation !== undefined) {
    // Empty string clears the field; any other value must match the enum.
    if (input.representation === "") {
      patch.representation = null;
    } else {
      const rep = isOneOf(input.representation, REPRESENTATIONS);
      if (!rep) return { ok: false, error: "Invalid representation value." };
      patch.representation = rep;
    }
  }
  if (input.stageKey !== undefined) {
    const stage = isOneOf(input.stageKey, STAGE_KEYS);
    if (!stage) return { ok: false, error: "Invalid stage value." };
    patch.stage_key = stage;
  }
  if (input.status !== undefined) {
    const status = isOneOf(input.status, STATUS_KEYS);
    if (!status) return { ok: false, error: "Invalid status value." };
    patch.status = status;
  }
  if (input.closing !== undefined) {
    const cleaned = input.closing.trim();
    if (cleaned && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return { ok: false, error: "Closing date must be YYYY-MM-DD." };
    }
    patch.closing = cleaned || null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, data: undefined };
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", txId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[updateTransaction]", error);
    return { ok: false, error: updateTxFriendlyError(error.message) };
  }
  if (!data || data.length === 0) {
    // RLS hid the row, the row is soft-deleted, or the id doesn't exist
    // — all of which we surface to the user the same way.
    return { ok: false, error: "Transaction not found or no longer editable." };
  }

  // Same revalidation surfaces as create / delete. Sidebar KPI also
  // reacts via realtime postgres_changes on `transactions`.
  revalidatePath("/agent/transactions");
  revalidatePath(`/agent/transactions/${txId}`);
  revalidatePath("/agent/dashboard");
  revalidatePath("/agent/clients");
  revalidatePath("/agent/documents");

  return { ok: true, data: undefined };
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
