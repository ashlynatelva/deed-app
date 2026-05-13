import { notFound } from "next/navigation";

import {
  getCurrentProfile,
  getDefaultOrganization,
  getTeamMembers,
  getPendingAgentInvitesForCurrentOrg,
} from "@/lib/supabase/queries";
import {
  TeamPageClient,
  type MemberRow,
  type InviteRow,
  type TeamRow,
} from "./TeamPageClient";

/**
 * /agent/team — admin-only team management surface.
 *
 * Gate stack:
 *   1. proxy.ts already redirects clients away from /agent/*. We only see
 *      agents + admins here.
 *   2. This page filters again at the server-component level: non-admins
 *      get a 404 rather than a redirect, so an agent who guesses the URL
 *      doesn't even see "Team" exists.
 *
 * Both members and pending agent/admin invites render in one table.
 */
export default async function AgentTeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) notFound();
  if (profile.role !== "admin") notFound();

  const [org, members, invites] = await Promise.all([
    getDefaultOrganization(),
    getTeamMembers(),
    getPendingAgentInvitesForCurrentOrg(),
  ]);

  const brokerageName = org?.name ?? "DEED";

  const memberRows: MemberRow[] = members.map((m) => ({
    kind: "member",
    id: m.id,
    name: m.full_name,
    email: m.email,
    role: m.role === "admin" ? "admin" : "agent",
    status: m.status,
    isSelf: m.id === profile.id,
  }));

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  const inviteRows: InviteRow[] = invites.map((inv) => ({
    kind: "invite",
    inviteId: inv.id,
    name: inv.full_name,
    email: inv.email,
    role: inv.target_role === "admin" ? "admin" : "agent",
    shareUrl: `${base}/invite/${inv.token}`,
    expiresAt: inv.expires_at,
  }));

  // Pending invites first (they need action), then seated members.
  const rows: TeamRow[] = [...inviteRows, ...memberRows];

  return <TeamPageClient brokerageName={brokerageName} rows={rows} />;
}
