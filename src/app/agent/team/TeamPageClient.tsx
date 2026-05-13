"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { InviteAgentModal } from "@/components/agent/InviteAgentModal";
import { revokeInvite, resendInvite } from "@/lib/actions/invites";
import { fmtDate } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Two row types in one table, mirroring the Clients page pattern:
//   - Seated team member (existing profile)
//   - Pending invite (row in `invites` with target_role in agent/admin)
//
// Both share the same column layout so the Role + Status columns tell
// the story at a glance.
// ─────────────────────────────────────────────────────────────────────────────

export type MemberRow = {
  kind: "member";
  id: string;
  name: string;
  email: string;
  role: "agent" | "admin";
  status: "active" | "inactive" | "deleted";
  isSelf: boolean;
};

export type InviteRow = {
  kind: "invite";
  inviteId: string;
  name: string;
  email: string;
  role: "agent" | "admin";
  shareUrl: string;
  expiresAt: string | null;
};

export type TeamRow = MemberRow | InviteRow;

type Props = {
  brokerageName: string;
  rows: TeamRow[];
};

const STATUS_STYLES: Record<MemberRow["status"], { bg: string; fg: string; dot: string; label: string }> = {
  active:   { bg: "var(--status-ok-bg)",   fg: "var(--status-ok-fg)",   dot: "#10B981", label: "Active"   },
  inactive: { bg: "var(--status-warn-bg)", fg: "var(--status-warn-fg)", dot: "var(--status-warn-fg)", label: "Inactive" },
  deleted:  { bg: "#F3F4F6",               fg: "var(--muted)",          dot: "#9CA3AF", label: "Removed"  },
};

const ROLE_LABEL: Record<"agent" | "admin", string> = {
  agent: "Agent",
  admin: "Admin",
};

export const TeamPageClient = ({ brokerageName, rows: initial }: Props) => {
  const [rows, setRows] = React.useState<TeamRow[]>(initial);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [pendingRevoke, setPendingRevoke] = React.useState<InviteRow | null>(null);
  const toast = useToast();

  // Resync local state when the server payload identity changes.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setRows(initial);
  }

  const memberCount = rows.filter((r) => r.kind === "member").length;
  const pendingCount = rows.filter((r) => r.kind === "invite").length;

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.push("Invite link copied to clipboard.", "success");
    } catch {
      toast.push("Could not copy link — select and copy manually.", "info");
    }
  };

  const onResend = async (inviteId: string) => {
    const res = await resendInvite(inviteId);
    if (!res.ok) {
      toast.push(res.error, "info");
      return;
    }
    const kind = res.data.email.kind;
    if (kind === "sent") {
      toast.push("Invite email resent.", "success");
    } else if (kind === "not_configured") {
      toast.push("Email isn't configured — share the link manually.", "info");
    } else {
      toast.push(`Email send failed: ${res.data.email.detail}`, "info");
    }
  };

  const confirmRevoke = async () => {
    if (!pendingRevoke) return;
    const res = await revokeInvite(pendingRevoke.inviteId);
    if (res.ok) {
      toast.push("Invite revoked.", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  return (
    <PageShell>
      <SectionTitle
        eyebrow="Team administration"
        title="Team"
        right={
          <Button kind="primary" icon={<I.Plus size={14} />} onClick={() => setInviteOpen(true)}>
            Invite agent
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-2">
          Organization
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className="serif text-[22px] tracking-[-0.01em]">{brokerageName}</div>
          <div className="text-[12.5px] text-muted">
            {memberCount} {memberCount === 1 ? "member" : "members"}
            {pendingCount > 0 && (
              <> · {pendingCount} pending {pendingCount === 1 ? "invite" : "invites"}</>
            )}
          </div>
        </div>
        <div className="text-[12.5px] text-muted mt-2 leading-[1.55]">
          Admins can invite new agents or fellow admins, resend pending invites, and revoke
          access. Invited team members complete onboarding through the same secure link flow
          your clients use.
        </div>
      </Card>

      <Card padded={false}>
        {/* Desktop header — hidden at mobile. */}
        <div className="hidden md:grid grid-cols-[2.2fr_2.2fr_1fr_1.1fr_1.2fr_40px] px-5 py-3 text-[11px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC]">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Status</div>
          <div>Detail</div>
          <div />
        </div>

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            No team members yet. Invite your first agent or admin to get started.
          </div>
        )}

        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          if (r.kind === "member") {
            const statusMeta = STATUS_STYLES[r.status];
            return (
              <React.Fragment key={r.id}>
                {/* Desktop row */}
                <div
                  className="hidden md:grid grid-cols-[2.2fr_2.2fr_1fr_1.1fr_1.2fr_40px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={r.name} size={32} tone={r.role === "admin" ? "navy" : "light"} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{r.name}</div>
                      {r.isSelf && (
                        <div className="text-[11px] text-muted mt-0.5">You</div>
                      )}
                    </div>
                  </div>
                  <div className="text-[13px] text-charcoal truncate">{r.email}</div>
                  <div className="text-[12.5px] text-charcoal">{ROLE_LABEL[r.role]}</div>
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px]"
                      style={{ color: statusMeta.fg }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted">—</div>
                  <div />
                </div>

                {/* Mobile card */}
                <div
                  className="md:hidden flex items-start gap-3 px-4 py-3.5"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <Avatar name={r.name} size={36} tone={r.role === "admin" ? "navy" : "light"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-[14px] font-medium text-ink truncate">{r.name}</div>
                      {r.isSelf && <span className="text-[10.5px] text-muted">(You)</span>}
                    </div>
                    <div className="text-[12px] text-muted truncate">{r.email}</div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[11.5px] text-charcoal">{ROLE_LABEL[r.role]}</span>
                      <span className="w-1 h-1 rounded-full bg-hairline" />
                      <span
                        className="inline-flex items-center gap-1.5 text-[11.5px]"
                        style={{ color: statusMeta.fg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          }
          // Pending invite row
          const detail = r.expiresAt
            ? `Expires ${fmtDate(r.expiresAt.slice(0, 10))}`
            : "Pending";
          return (
            <React.Fragment key={r.inviteId}>
              {/* Desktop row */}
              <div
                className="hidden md:grid grid-cols-[2.2fr_2.2fr_1fr_1.1fr_1.2fr_40px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={r.name} size={32} tone="light" />
                  <div className="text-[13.5px] font-medium truncate">{r.name}</div>
                </div>
                <div className="text-[13px] text-charcoal truncate">{r.email}</div>
                <div className="text-[12.5px] text-charcoal">{ROLE_LABEL[r.role]}</div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px]"
                    style={{ color: "var(--status-warn-fg)" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--status-warn-fg)" }}
                    />
                    Pending invite
                  </span>
                </div>
                <div className="text-[12px] text-muted">{detail}</div>
                <div className="flex justify-end">
                  <RowActionsMenu
                    ariaLabel={`Manage invite for ${r.name}`}
                    actions={[
                      { id: "copy",   label: "Copy invite link", icon: "Upload",
                        onSelect: () => copyLink(r.shareUrl) },
                      { id: "resend", label: "Resend invite",    icon: "Mail",
                        onSelect: () => onResend(r.inviteId) },
                      { id: "revoke", label: "Revoke invite",    icon: "Trash", destructive: true,
                        onSelect: () => setPendingRevoke(r) },
                    ]}
                  />
                </div>
              </div>

              {/* Mobile card */}
              <div
                className="md:hidden flex items-start gap-3 px-4 py-3.5"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <Avatar name={r.name} size={36} tone="light" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink truncate">{r.name}</div>
                  <div className="text-[12px] text-muted truncate">{r.email}</div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[11.5px] text-charcoal">{ROLE_LABEL[r.role]}</span>
                    <span className="w-1 h-1 rounded-full bg-hairline" />
                    <span
                      className="inline-flex items-center gap-1.5 text-[11.5px]"
                      style={{ color: "var(--status-warn-fg)" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--status-warn-fg)" }}
                      />
                      Pending
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">{detail}</div>
                </div>
                <RowActionsMenu
                  ariaLabel={`Manage invite for ${r.name}`}
                  actions={[
                    { id: "copy",   label: "Copy invite link", icon: "Upload",
                      onSelect: () => copyLink(r.shareUrl) },
                    { id: "resend", label: "Resend invite",    icon: "Mail",
                      onSelect: () => onResend(r.inviteId) },
                    { id: "revoke", label: "Revoke invite",    icon: "Trash", destructive: true,
                      onSelect: () => setPendingRevoke(r) },
                  ]}
                />
              </div>
            </React.Fragment>
          );
        })}
      </Card>

      <InviteAgentModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <ConfirmDeleteModal
        open={!!pendingRevoke}
        onClose={() => setPendingRevoke(null)}
        onConfirm={confirmRevoke}
        title="Revoke this invite?"
        body="The share link will stop working immediately. You can send a fresh invite afterwards."
        confirmLabel="Revoke invite"
        itemName={pendingRevoke?.name}
      />
    </PageShell>
  );
};
