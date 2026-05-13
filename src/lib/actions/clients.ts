"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Client lifecycle actions (Phase J — soft-delete / portal revocation).
//
// Today there's only one — `revokeClientPortalAccess`. It's a thin
// wrapper around the SECURITY DEFINER RPC `public.revoke_client_portal_access`
// installed by migration 0016. All the validation (caller is agent/admin,
// target is a client in the same org) lives in the function so the
// rule set is enforced at the database boundary, not just here.
//
// Why no service-role client:
//   The RPC runs under the function owner's privileges; the caller's
//   identity comes from auth.uid() inside the function. We don't need to
//   reach for service-role here — the gate is the function's signature
//   + guards.
// ─────────────────────────────────────────────────────────────────────────────

type Result = { ok: true } | { ok: false; error: string };

/** Map sentinel exception messages from the RPC to human-readable copy. */
const friendlyError = (message: string): string => {
  switch (message) {
    case "not_signed_in":           return "You're not signed in.";
    case "caller_profile_missing":  return "Your profile couldn't be found.";
    case "caller_not_authorized":   return "Only agents and admins can revoke client access.";
    case "target_not_found":        return "Client not found.";
    case "target_not_a_client":     return "Only client accounts can be revoked through this action.";
    case "target_other_organization":
      return "That client belongs to a different organization.";
    default:                        return message;
  }
};

/**
 * Revoke a client's portal access. Soft-delete: flips
 * `profiles.status` to 'inactive' and stamps `portal_access_revoked_at`.
 * Auth.users row is untouched; the proxy + LoginForm enforce the gate
 * on every subsequent navigation/login attempt.
 *
 * Transaction / document / message history is preserved — the FK chain
 * stays intact, and the row is still visible to service-role / future
 * admin-restore tooling.
 */
export async function revokeClientPortalAccess(
  clientId: string,
): Promise<Result> {
  if (!clientId) return { ok: false, error: "Missing client id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_client_portal_access", {
    target_client_id: clientId,
  });
  if (error) {
    console.error("[revokeClientPortalAccess]", error);
    return { ok: false, error: friendlyError(error.message) };
  }

  // Refresh every surface that lists clients or their state.
  revalidatePath("/agent/clients");
  revalidatePath("/agent/dashboard");
  return { ok: true };
}

/**
 * Fully delete a client from the agent's active workspace. Distinct from
 * `revokeClientPortalAccess` — that flips status to 'inactive' (login
 * blocked, but the row still appears in the agent's "active clients"
 * list if the existing `eq("status", "active")` filter is ever
 * relaxed). THIS action flips status to 'deleted' AND stamps
 * `deleted_at` so the row is excluded from every "active" surface
 * permanently, while transaction / document / message FK chains stay
 * intact for audit history.
 *
 * Backed by the SECURITY DEFINER RPC `public.delete_client` (migration
 * 0019), which validates the caller is an agent/admin in the same org
 * as the target client.
 */
export async function deleteClient(
  clientId: string,
): Promise<Result> {
  if (!clientId) return { ok: false, error: "Missing client id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_client", {
    target_client_id: clientId,
  });
  if (error) {
    console.error("[deleteClient]", error);
    return { ok: false, error: friendlyError(error.message) };
  }

  revalidatePath("/agent/clients");
  revalidatePath("/agent/dashboard");
  revalidatePath("/agent/transactions");
  return { ok: true };
}
