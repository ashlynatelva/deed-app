"use server";

import { revalidatePath } from "next/cache";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mailer/mailer";
import { renderInviteEmail } from "@/lib/mailer/invite-email";

// ─────────────────────────────────────────────────────────────────────────────
// Phase H — Invite + client-onboarding server actions.
//
// Flow:
//   1. Agent fills out the "Send portal invite" form. We insert an invite
//      row with a freshly minted token. RLS scopes the write to the
//      agent's org + their own transactions.
//
//   2. The action returns the share URL (`/invite/<token>`). The MVP
//      doesn't send the invite email — the agent copies the link and
//      sends it through whatever channel they already use. Wiring up
//      real email via `supabase.auth.admin.inviteUserByEmail` is a
//      drop-in upgrade later.
//
//   3. The client opens `/invite/<token>` while signed out. The page
//      reads the invite via `getInvitePreview` (service-role, since the
//      visitor has no session yet) and renders the acceptance form.
//
//   4. On submit, `acceptInvite` runs under the service role and:
//        a. Re-validates the token (status=pending, not expired).
//        b. Creates an auth.users row with the chosen password.
//        c. Inserts a profiles row with role='client', linked to the
//           agent's org.
//        d. Updates the invite's transaction so `client_id` points at
//           the new user.
//        e. Marks the invite accepted.
//      Then it signs the user in via the user-session client so the
//      cookie is on the response, and returns success — the page
//      navigates to /client/overview.
// ─────────────────────────────────────────────────────────────────────────────

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// 14 days. The check is done in the action since we don't have a job
// runner sweeping the `invites` table for expired rows. expires_at is
// nullable on the table — null means "no explicit expiry" (treated as
// 14 days for safety).
const DEFAULT_INVITE_TTL_DAYS = 14;
const TTL_MS = DEFAULT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

const isExpired = (row: { expires_at: string | null }): boolean => {
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() < Date.now();
};

const newToken = (): string => {
  // Postgres' `gen_random_uuid` would also work as a column default, but
  // generating client-side lets us return the share URL immediately
  // without a follow-up SELECT.
  return crypto.randomUUID().replace(/-/g, "");
};

const revalidateInvitePaths = () => {
  revalidatePath("/agent/clients");
  revalidatePath("/agent/team");
  revalidatePath("/agent/dashboard");
};

// ─── createInvite ───────────────────────────────────────────────────────────

export type InviteEmailStatus =
  | { kind: "sent" }
  | { kind: "not_configured" }
  | { kind: "failed"; detail: string };

/**
 * Create a pending invite. The signed-in user must be an agent/admin on
 * the transaction (RLS enforces). Returns the share URL the agent will
 * forward to the client, plus a discriminator telling the caller whether
 * we successfully emailed the link or whether they need to share it
 * manually.
 *
 * Emailing is attempted but never blocks success — if email is
 * unconfigured or the provider rejects the send, the invite row still
 * exists and the agent can copy the share link from the modal/clients
 * page exactly as before.
 */
export async function createInvite(input: {
  transactionId: string;
  email: string;
  fullName: string;
}): Promise<Result<{ inviteId: string; token: string; url: string; email: InviteEmailStatus }>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email)                return { ok: false, error: "Email is required." };
  if (!fullName)             return { ok: false, error: "Full name is required." };
  if (!input.transactionId)  return { ok: false, error: "Transaction is required." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Verify the agent owns the transaction (RLS would also block, but a
  // direct check produces a clean error message instead of "0 rows").
  // We also pull `address` here so the invite email can mention the
  // property the client is being invited to, and the agent's profile +
  // org so the email "from" line + branding line are correct.
  // Soft-deleted transactions can't be invited against.
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, organization_id, agent_id, address, city")
    .eq("id", input.transactionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tx) return { ok: false, error: "Transaction not found or not yours." };

  // Agent's display name + org name for the email body. Both are
  // cheap lookups and we already verified the agent's identity above.
  const [{ data: agentProfile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", tx.agent_id).maybeSingle(),
    supabase.from("organizations").select("name, support_email").eq("id", tx.organization_id).maybeSingle(),
  ]);

  const token = newToken();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("invites")
    .insert({
      organization_id: tx.organization_id,
      agent_id: tx.agent_id,
      transaction_id: tx.id,
      email,
      full_name: fullName,
      token,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, token")
    .single();
  if (error || !data) {
    console.error("[createInvite] insert failed", error);
    return { ok: false, error: error?.message ?? "Could not create invite." };
  }

  // Build the share URL. We use NEXT_PUBLIC_SITE_URL when set so previews
  // and prod links work; otherwise fall back to localhost for dev.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const url = `${base}/invite/${data.token}`;

  // Compose + send the invite email. This block is intentionally tolerant
  // of every failure — the invite row already exists in the DB, so the
  // share link is always a valid fallback.
  const propertyLabel = [tx.address, tx.city].filter(Boolean).join(" · ") || null;
  const { subject, html, text } = renderInviteEmail({
    brokerageName: org?.name ?? "DEED",
    agentName: agentProfile?.full_name ?? "Your advisor",
    clientName: fullName,
    propertyLabel,
    inviteUrl: url,
    supportEmail: org?.support_email ?? null,
    targetRole: "client",
  });
  const sendRes = await sendEmail({
    to: email,
    subject,
    html,
    text,
    // Reply-to the inviting agent so client replies route correctly.
    replyTo: agentProfile?.email ?? undefined,
  });
  const emailStatus: InviteEmailStatus = sendRes.ok
    ? { kind: "sent" }
    : sendRes.reason === "not_configured"
    ? { kind: "not_configured" }
    : { kind: "failed", detail: sendRes.detail };

  revalidateInvitePaths();
  return {
    ok: true,
    data: { inviteId: data.id, token: data.token, url, email: emailStatus },
  };
}

// ─── revokeInvite ──────────────────────────────────────────────────────────

export async function revokeInvite(inviteId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending"); // no-op for already-accepted invites
  if (error) {
    console.error("[revokeInvite]", error);
    return { ok: false, error: error.message };
  }
  revalidateInvitePaths();
  return { ok: true, data: undefined };
}

// ─── Invite preview (public) ───────────────────────────────────────────────

export type InvitePreview = {
  status: "pending" | "accepted" | "expired" | "revoked" | "not_found";
  email: string | null;
  fullName: string | null;
  brokerageName: string | null;
  /** Subject-line property + city for context. Null for agent/admin invites. */
  propertyLabel: string | null;
  agentName: string | null;
  /**
   * What kind of profile this invite creates on acceptance:
   *   - 'client': link to the invite's transaction, land on /client/overview
   *   - 'agent' | 'admin': team member, land on /agent/dashboard
   *
   * Drives both the acceptance-page copy and the post-accept redirect.
   */
  targetRole: "client" | "agent" | "admin" | null;
};

/**
 * Public lookup for the /invite/[token] page. Service-role because the
 * visitor is signed out at this point — and even when signed in, they
 * wouldn't be allowed to read another agent's invites row via RLS.
 *
 * Returns a `status` discriminator the page can switch on rather than
 * throwing different errors — that keeps the public-page UX calm.
 */
const notFoundPreview = (): InvitePreview => ({
  status: "not_found",
  email: null,
  fullName: null,
  brokerageName: null,
  propertyLabel: null,
  agentName: null,
  targetRole: null,
});

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  if (!token) return notFoundPreview();

  const admin = createServiceRoleClient();
  const { data: invite, error } = await admin
    .from("invites")
    .select(`
      id, email, full_name, status, expires_at, target_role,
      transaction:transactions(address, city),
      agent:profiles!invites_agent_id_fkey(full_name),
      organization:organizations(name)
    `)
    .eq("token", token)
    .maybeSingle();
  if (error || !invite) return notFoundPreview();

  // Determine an effective status — `expired` shadows `pending` if the
  // server-side expires_at is in the past, even if the row still says
  // 'pending' (no sweeper has touched it yet).
  let status: InvitePreview["status"];
  if (invite.status === "accepted") status = "accepted";
  else if (invite.status === "revoked") status = "revoked";
  else if (isExpired(invite as { expires_at: string | null })) status = "expired";
  else status = "pending";

  const tx = Array.isArray(invite.transaction) ? invite.transaction[0] : invite.transaction;
  const agent = Array.isArray(invite.agent) ? invite.agent[0] : invite.agent;
  const org = Array.isArray(invite.organization) ? invite.organization[0] : invite.organization;

  // Client invites carry a property label; agent/admin invites don't.
  const propertyLabel = tx
    ? [tx.address, tx.city].filter(Boolean).join(" · ")
    : null;

  return {
    status,
    email: invite.email,
    fullName: invite.full_name,
    brokerageName: org?.name ?? null,
    propertyLabel,
    agentName: agent?.full_name ?? null,
    targetRole: invite.target_role as InvitePreview["targetRole"],
  };
}

// ─── acceptInvite (public) ──────────────────────────────────────────────────

/**
 * Public acceptance. The visitor isn't signed in — we use the service
 * role for the auth + DB writes, then sign them in via the user-session
 * client so the response carries the new auth cookie.
 */
export async function acceptInvite(input: {
  token: string;
  password: string;
  fullName?: string; // optional override; defaults to invite.full_name
}): Promise<Result<{ destination: string }>> {
  const token = input.token?.trim();
  const password = input.password;
  if (!token)              return { ok: false, error: "Missing invite token." };
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const admin = createServiceRoleClient();

  // 1. Re-validate the invite.
  const { data: invite, error: inviteErr } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (inviteErr || !invite) {
    return { ok: false, error: "This invite link isn't valid." };
  }
  if (invite.status !== "pending") {
    return {
      ok: false,
      error:
        invite.status === "accepted"
          ? "This invite has already been used. Please sign in instead."
          : `This invite is ${invite.status}.`,
    };
  }
  if (isExpired(invite)) {
    return { ok: false, error: "This invite has expired. Ask your advisor for a new one." };
  }

  const email = invite.email;
  const fullName = (input.fullName ?? invite.full_name).trim() || invite.full_name;

  // The invite's target_role decides what profile shape we create and
  // where the user lands. Defaults to 'client' for any pre-Phase-K row
  // (the schema default covers backfills, this is belt-and-suspenders).
  const targetRole = (invite.target_role ?? "client") as "client" | "agent" | "admin";

  // 2. Refuse if an account with this email already exists. Linking
  //    silently would be a security risk; we surface a clear message.
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = usersList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    return {
      ok: false,
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  // 3. Create the auth user. email_confirm:true so they don't have to
  //    do another round-trip — they just chose a password on a verified
  //    invite link.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: targetRole },
  });
  if (createErr || !created.user) {
    console.error("[acceptInvite] createUser", createErr);
    return { ok: false, error: createErr?.message ?? "Could not create account." };
  }
  const newUserId = created.user.id;

  // 4. Insert the profile row. Service role bypasses RLS — profile
  //    creation on signup happens server-side, never from the client.
  const { error: profileErr } = await admin.from("profiles").insert({
    id: newUserId,
    organization_id: invite.organization_id,
    role: targetRole,
    full_name: fullName,
    email,
  });
  if (profileErr) {
    console.error("[acceptInvite] profile insert", profileErr);
    // Best-effort cleanup so we don't leave an orphaned auth user.
    await admin.auth.admin.deleteUser(newUserId);
    return { ok: false, error: profileErr.message };
  }

  // 5. CLIENT invites link the new user to the invite's transaction.
  //    Agent/admin invites have no transaction — skip this step.
  if (targetRole === "client" && invite.transaction_id) {
    const { error: txErr } = await admin
      .from("transactions")
      .update({ client_id: newUserId })
      .eq("id", invite.transaction_id);
    if (txErr) {
      console.error("[acceptInvite] tx link", txErr);
      // Don't roll back — the user + profile exist, the transaction
      // link is the only thing missing and an admin can fix it.
      return { ok: false, error: txErr.message };
    }
  }

  // 6. Mark invite accepted.
  await admin
    .from("invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: newUserId,
    })
    .eq("id", invite.id);

  // 7. Sign the new user in via the request-bound client so the response
  //    carries the auth cookie. Destination depends on the target role —
  //    agents/admins land on the team-facing dashboard, clients on the
  //    portal overview.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    console.error("[acceptInvite] signIn", signInErr);
    // Account exists; user can sign in manually.
    return { ok: true, data: { destination: "/login" } };
  }

  const destination =
    targetRole === "client" ? "/client/overview" : "/agent/dashboard";
  return { ok: true, data: { destination } };
}

// ─── createAgentInvite (Phase K — team management) ─────────────────────────

/**
 * Create a pending invite for a new agent or admin. Admin-only — the
 * action refuses callers whose `profiles.role` isn't 'admin'. RLS still
 * permits agents to read/write invite rows in their org as defense in
 * depth; this layer enforces the business rule with a clean error.
 *
 * Shape differs from `createInvite` in two ways:
 *   - no `transactionId` (team invites aren't transaction-bound)
 *   - `role` is the new member's intended role ('agent' or 'admin')
 *
 * Returns the same shape as `createInvite` so the modal UI can reuse
 * the "share link" / "email sent" rendering.
 */
export async function createAgentInvite(input: {
  email: string;
  fullName: string;
  role: "agent" | "admin";
}): Promise<Result<{ inviteId: string; token: string; url: string; email: InviteEmailStatus }>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email)    return { ok: false, error: "Email is required." };
  if (!fullName) return { ok: false, error: "Full name is required." };
  if (input.role !== "agent" && input.role !== "admin") {
    return { ok: false, error: "Role must be agent or admin." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Caller must be an admin. We fetch the full profile so we can stamp
  // `agent_id` on the invite row + populate the invite email's "from"
  // line with the inviter's name.
  const { data: caller } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller) return { ok: false, error: "Your profile couldn't be found." };
  if (caller.role !== "admin") {
    return { ok: false, error: "Only admins can invite team members." };
  }

  // Organization metadata for the invite email branding line.
  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", caller.organization_id)
    .maybeSingle();

  const token = newToken();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("invites")
    .insert({
      organization_id: caller.organization_id,
      agent_id: caller.id, // inviter
      transaction_id: null,
      target_role: input.role,
      email,
      full_name: fullName,
      token,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, token")
    .single();
  if (error || !data) {
    console.error("[createAgentInvite] insert failed", error);
    return { ok: false, error: error?.message ?? "Could not create invite." };
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const url = `${base}/invite/${data.token}`;

  // Compose + send the team-flavor invite email. Same template; we just
  // pass `targetRole` so the copy says "join the team" instead of
  // "for <property>".
  const { subject, html, text } = renderInviteEmail({
    brokerageName: org?.name ?? "DEED",
    agentName: caller.full_name,
    clientName: fullName, // recipient name; field name is historical
    propertyLabel: null,
    inviteUrl: url,
    supportEmail: org?.support_email ?? null,
    targetRole: input.role,
  });
  const sendRes = await sendEmail({
    to: email,
    subject,
    html,
    text,
    replyTo: caller.email ?? undefined,
  });
  const emailStatus: InviteEmailStatus = sendRes.ok
    ? { kind: "sent" }
    : sendRes.reason === "not_configured"
    ? { kind: "not_configured" }
    : { kind: "failed", detail: sendRes.detail };

  revalidateInvitePaths();
  return {
    ok: true,
    data: { inviteId: data.id, token: data.token, url, email: emailStatus },
  };
}

// ─── resendInvite (works for both client + agent/admin invites) ────────────

/**
 * Re-fire the invitation email for an existing pending invite. Used by
 * the Team page's row menu. No new token is minted — the existing link
 * is still valid until `expires_at`.
 */
export async function resendInvite(
  inviteId: string,
): Promise<Result<{ email: InviteEmailStatus }>> {
  if (!inviteId) return { ok: false, error: "Missing invite id." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // RLS scopes the SELECT to invites in the caller's org. If the row
  // isn't returned, either it doesn't exist or it's out of scope —
  // surface a generic error either way (don't leak existence).
  const { data: invite } = await supabase
    .from("invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.status !== "pending") {
    return { ok: false, error: `This invite is ${invite.status}; create a new one.` };
  }
  if (isExpired(invite)) {
    return { ok: false, error: "This invite has expired; revoke it and create a new one." };
  }

  // Caller profile + org for the email branding.
  const [{ data: caller }, { data: org }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("name, support_email")
      .eq("id", invite.organization_id)
      .maybeSingle(),
  ]);

  // Optional transaction context for client invites — agent/admin
  // invites have transaction_id = null.
  let propertyLabel: string | null = null;
  if (invite.target_role === "client" && invite.transaction_id) {
    const { data: tx } = await supabase
      .from("transactions")
      .select("address, city")
      .eq("id", invite.transaction_id)
      .maybeSingle();
    if (tx) propertyLabel = [tx.address, tx.city].filter(Boolean).join(" · ") || null;
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const url = `${base}/invite/${invite.token}`;

  const { subject, html, text } = renderInviteEmail({
    brokerageName: org?.name ?? "DEED",
    agentName: caller?.full_name ?? "Your advisor",
    clientName: invite.full_name,
    propertyLabel,
    inviteUrl: url,
    supportEmail: org?.support_email ?? null,
    targetRole: (invite.target_role ?? "client") as "client" | "agent" | "admin",
  });
  const sendRes = await sendEmail({
    to: invite.email,
    subject,
    html,
    text,
    replyTo: caller?.email ?? undefined,
  });
  const emailStatus: InviteEmailStatus = sendRes.ok
    ? { kind: "sent" }
    : sendRes.reason === "not_configured"
    ? { kind: "not_configured" }
    : { kind: "failed", detail: sendRes.detail };

  return { ok: true, data: { email: emailStatus } };
}
