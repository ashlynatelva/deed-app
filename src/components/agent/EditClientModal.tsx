"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateClient } from "@/lib/actions/clients";

type Props = {
  open: boolean;
  onClose: () => void;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  } | null;
};

type Draft = {
  fullName: string;
  email: string;
  phone: string;
};

// Lightweight regex — matches what the RPC server-side checks. We're
// not trying to be RFC-strict; just catching obvious typos before the
// round trip.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Edit-client modal. Mirrors the look + structure of NewTransactionModal
 * (two-column grid on lg, footer with Cancel + Save changes). The fields
 * are intentionally narrow: name, contact email, phone. Role / status /
 * portal-access lifecycle are deliberately NOT exposed here — those are
 * managed by the existing Remove portal access / Delete client actions.
 *
 * Helper copy under the email field calls out that this updates the
 * agent-facing contact email, NOT the sign-in email — the latter lives
 * in Supabase Auth and isn't changed by this RPC.
 */
export const EditClientModal = ({ open, onClose, client }: Props) => {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = React.useState<Draft>({ fullName: "", email: "", phone: "" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Whenever the modal opens (or the targeted client changes while open),
  // re-seed the draft from the row data. Render-time check so the React
  // Compiler doesn't flag the cascading setState.
  const [lastClientId, setLastClientId] = React.useState<string | null>(null);
  if (open && client && client.id !== lastClientId) {
    setLastClientId(client.id);
    setDraft({
      fullName: client.fullName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
    });
    setError(null);
    setSubmitting(false);
  }
  if (!open && lastClientId !== null) {
    // Clear stale state when the modal closes so the next open re-seeds
    // even if it's the same client.
    setLastClientId(null);
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const validate = (): string | null => {
    if (!draft.fullName.trim()) return "Full name is required.";
    if (!draft.email.trim()) return "Email is required.";
    if (!EMAIL_RE.test(draft.email.trim())) return "Please enter a valid email address.";
    return null;
  };

  const canSubmit = !!client && !submitting;

  const submit = async () => {
    if (!canSubmit || !client) return;
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await updateClient(client.id, {
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.push("Client updated.", "success");
    // Re-fetch server-rendered props so the row reflects the new values
    // without a manual reload.
    router.refresh();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Edit client"
      subtitle="Update the client's name, contact email, or phone."
      size="lg"
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button kind="primary" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" full>
          <input
            autoFocus
            name="fullName"
            autoComplete="name"
            value={draft.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Whitney Hall"
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          />
        </Field>

        <Field label="Contact email" full>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="whitney@example.com"
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          />
          <p className="text-[11.5px] text-muted mt-1.5 leading-[1.5]">
            This updates the contact email shown on transactions. Their sign-in
            email is managed in Supabase Auth and stays the same.
          </p>
        </Field>

        <Field label="Phone" full>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(617) 555-0142"
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          />
        </Field>

        {error && (
          <div
            role="alert"
            className="col-span-2 text-[12.5px] rounded-lg px-3 py-2 leading-[1.5]"
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
    </Modal>
  );
};

const Field = ({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) => (
  <label className={`block ${full ? "col-span-2" : "col-span-1"}`}>
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    {children}
  </label>
);
