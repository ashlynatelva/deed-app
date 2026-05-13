"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { createInvite, type InviteEmailStatus } from "@/lib/actions/invites";

type TxOption = { value: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  txOptions: TxOption[];
  /** Optional pre-selected transaction (e.g. invoked from a tx detail page). */
  defaultTxId?: string;
};

/**
 * "Send portal invite" flow. Two states inside one modal:
 *   1. Form — agent enters name, email, picks the transaction.
 *   2. Share — server returns a token; we render the resulting URL plus
 *      a copy-to-clipboard button. The agent forwards this link to the
 *      client through whatever channel they prefer (no email is sent
 *      from the app yet).
 *
 * On Save in state 1, we call the `createInvite` server action and
 * transition to state 2 if it succeeded. The action revalidates the
 * Clients page, so the modal closing reveals the new pending row.
 */
export const InviteClientModal = ({ open, onClose, txOptions, defaultTxId }: Props) => {
  const toast = useToast();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [txId, setTxId] = React.useState(defaultTxId ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [emailStatus, setEmailStatus] = React.useState<InviteEmailStatus | null>(null);
  const [sentToEmail, setSentToEmail] = React.useState<string | null>(null);

  // Reset every time the modal opens. Render-time check rather than an
  // effect so React Compiler doesn't flag a cascading setState.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFullName("");
      setEmail("");
      setTxId(defaultTxId ?? txOptions[0]?.value ?? "");
      setSubmitting(false);
      setError(null);
      setShareUrl(null);
      setEmailStatus(null);
      setSentToEmail(null);
    }
  }

  const canSubmit = !!fullName.trim() && !!email.trim() && !!txId && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const trimmedEmail = email.trim();
    const res = await createInvite({
      transactionId: txId,
      email: trimmedEmail,
      fullName: fullName.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShareUrl(res.data.url);
    setEmailStatus(res.data.email);
    setSentToEmail(trimmedEmail);
    // Toast message depends on whether the email actually went out — we
    // don't want to claim "sent" when the server just minted a link.
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

  // Vary the modal chrome + copy in the post-create state based on whether
  // the email actually went out. Three branches:
  //   - sent           : confirm + still surface the link for forwarding.
  //   - not_configured : current behavior — link is the delivery channel.
  //   - failed         : warn-toned banner with the reason, link as the
  //                      manual fallback.
  const status = emailStatus?.kind ?? null;
  const shareTitle =
    status === "sent" ? "Invite sent" : "Invite created";
  const shareSubtitle =
    status === "sent"
      ? `An invitation email is on its way to ${sentToEmail}.`
      : status === "failed"
      ? "Email send didn't go through — copy the link below to share it manually."
      : "Copy the link below and send it to your client through your preferred channel.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shareUrl ? shareTitle : "Send portal invite"}
      subtitle={shareUrl ? shareSubtitle : "Emails your client a private link they can open to set their password."}
      size="lg"
      footer={
        shareUrl ? (
          <Button kind="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button kind="secondary" onClick={onClose}>Cancel</Button>
            <Button kind="primary" onClick={submit} disabled={!canSubmit}>
              {submitting ? "Creating…" : "Create invite"}
            </Button>
          </>
        )
      }
    >
      {shareUrl ? (
        <div className="flex flex-col gap-4">
          {/* Failure banner — only renders when Resend rejected the send.
              The agent still has the link below, so this is informational. */}
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

          <div
            className="rounded-lg border border-hairline bg-[#FBFBFC] p-3.5 flex items-center gap-2.5"
          >
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
                The email contains the same link shown above — keep it handy in case
                your client doesn&apos;t see the message in their inbox. The link
                expires in 14 days.
              </>
            ) : (
              <>
                The link expires in 14 days. Once the client accepts, they&apos;ll appear
                as &ldquo;Active&rdquo; in your clients list and you&apos;ll be able to
                message them directly through the portal.
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Client name">
            <input
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              disabled={submitting}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={submitting}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </Field>
          <Field label="Assign to transaction">
            <select
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              disabled={submitting || txOptions.length === 0}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            >
              {txOptions.length === 0 ? (
                <option value="">No transactions available</option>
              ) : (
                <>
                  <option value="" disabled>Choose a transaction…</option>
                  {txOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </>
              )}
            </select>
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
