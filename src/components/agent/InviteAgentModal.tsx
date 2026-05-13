"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { createAgentInvite, type InviteEmailStatus } from "@/lib/actions/invites";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Team-invite modal. Mirrors `InviteClientModal`'s two-state shape
 * (form → share link / success) so admins get the same calm flow whether
 * they're onboarding clients or fellow team members.
 *
 * Field set differs from the client modal:
 *   - Full name (recipient)
 *   - Email
 *   - Role (agent | admin)
 *   - No transaction picker (team invites aren't transaction-bound)
 */
export const InviteAgentModal = ({ open, onClose }: Props) => {
  const toast = useToast();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"agent" | "admin">("agent");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [emailStatus, setEmailStatus] = React.useState<InviteEmailStatus | null>(null);
  const [sentToEmail, setSentToEmail] = React.useState<string | null>(null);

  // Reset on each open. Render-time check rather than an effect to keep
  // the React Compiler quiet about cascading setState.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFullName("");
      setEmail("");
      setRole("agent");
      setSubmitting(false);
      setError(null);
      setShareUrl(null);
      setEmailStatus(null);
      setSentToEmail(null);
    }
  }

  const canSubmit = !!fullName.trim() && !!email.trim() && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const trimmedEmail = email.trim();
    const res = await createAgentInvite({
      email: trimmedEmail,
      fullName: fullName.trim(),
      role,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShareUrl(res.data.url);
    setEmailStatus(res.data.email);
    setSentToEmail(trimmedEmail);
    if (res.data.email.kind === "sent") {
      toast.push(`Invite emailed to ${trimmedEmail}.`, "success");
    } else {
      toast.push("Invite created. Share the link below.", "success");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.push("Link copied to clipboard.", "success");
    } catch {
      toast.push("Could not copy — select the link and copy manually.", "info");
    }
  };

  const status = emailStatus?.kind ?? null;
  const shareTitle = status === "sent" ? "Invite sent" : "Invite created";
  const shareSubtitle =
    status === "sent"
      ? `An invitation email is on its way to ${sentToEmail}.`
      : status === "failed"
      ? "Email send didn't go through — copy the link below to share it manually."
      : "Copy the link below and send it to the new team member through your preferred channel.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shareUrl ? shareTitle : "Invite team member"}
      subtitle={
        shareUrl
          ? shareSubtitle
          : "Emails the invitee a private link they can open to set their password."
      }
      size="lg"
      footer={
        shareUrl ? (
          <Button kind="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button kind="secondary" onClick={onClose}>Cancel</Button>
            <Button kind="primary" onClick={submit} disabled={!canSubmit}>
              {submitting ? "Creating…" : "Send invite"}
            </Button>
          </>
        )
      }
    >
      {shareUrl ? (
        <div className="flex flex-col gap-4">
          {status === "failed" && emailStatus && "detail" in emailStatus && (
            <div
              role="alert"
              className="text-[12.5px] rounded-lg px-3 py-2 leading-[1.5]"
              style={{
                background: "var(--status-warn-bg)",
                color: "var(--status-warn-fg)",
                border: "1px solid var(--status-warn-bg)",
              }}
            >
              <span className="font-medium">Email send failed:</span>{" "}
              {emailStatus.detail}
            </div>
          )}

          <div className="rounded-lg border border-hairline bg-[#FBFBFC] p-3.5 flex items-center gap-2.5">
            <I.Lock size={14} className="text-muted shrink-0" />
            <div
              className="flex-1 min-w-0 font-mono text-[12.5px] text-charcoal truncate select-all"
              title={shareUrl}
            >
              {shareUrl}
            </div>
            <Button kind="secondary" size="sm" icon={<I.Upload size={12} />} onClick={copyLink}>
              Copy
            </Button>
          </div>

          <div className="text-[12px] text-muted leading-[1.6]">
            {status === "sent" ? (
              <>
                The email contains the same link shown above — keep it handy in case the
                recipient doesn&apos;t see the message in their inbox. The link expires in 14 days.
              </>
            ) : (
              <>
                The link expires in 14 days. Once accepted, the new team member will appear
                as &ldquo;Active&rdquo; in your team list and gain access to the agent
                workspace immediately.
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Full name">
            <input
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Daniel Park"
              disabled={submitting}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="daniel@yourbrokerage.com"
              disabled={submitting}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </Field>
          <Field label="Role">
            <div
              className="grid grid-cols-2 rounded-[10px] overflow-hidden border border-hairline"
              role="tablist"
              aria-label="Role"
            >
              {(["agent", "admin"] as const).map((r, i) => {
                const isActive = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setRole(r)}
                    disabled={submitting}
                    className="h-10 text-[13px] font-medium tracking-[.01em] transition-colors duration-150 outline-none disabled:opacity-60"
                    style={{
                      background: isActive ? "var(--navy)" : "#fff",
                      color: isActive ? "#fff" : "var(--charcoal)",
                      borderLeft: i === 1 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    {r === "agent" ? "Agent" : "Admin"}
                  </button>
                );
              })}
            </div>
            <div className="text-[11.5px] text-muted mt-1.5 leading-[1.55]">
              {role === "admin"
                ? "Admins can invite team members, manage the organization, and access every transaction."
                : "Agents can run transactions and message clients. They can't invite others or manage the team."}
            </div>
          </Field>

          {error && (
            <div
              role="alert"
              className="text-[12.5px] rounded-lg px-3 py-2 leading-[1.5]"
              style={{
                background: "var(--status-risk-bg)",
                color: "var(--status-risk-fg)",
                border: "1px solid var(--status-risk-bg)",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    {children}
  </label>
);
