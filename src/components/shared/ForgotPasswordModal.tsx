"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Forgot-password modal — opened from the "Forgot?" link on /login.
//
// Two states inside a single Modal:
//   1. "request"       — email input + Send reset link button.
//   2. "sent"          — non-enumerating confirmation copy.
//
// Non-enumeration: regardless of whether Supabase returns success, an
// invalid-email error, or a rate-limit error, we surface the SAME copy:
//
//     "If an account exists for that email, we'll send password reset
//      instructions."
//
// Real Supabase errors are logged to the browser console for ops
// debugging but never surfaced to the user. This prevents an attacker
// from probing whether a given email is a DEED account.
//
// Redirect URL:
//   We resolve `NEXT_PUBLIC_SITE_URL` first (Vercel-provided in
//   production), falling back to `window.location.origin` so dev /
//   preview environments work without extra config. The full target is
//   `${origin}/auth/update-password` — that page must be in Supabase
//   Auth's Redirect URLs allow-list, otherwise the email link will
//   bounce the user to a different URL.
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "request" | "sent";

type Props = {
  open: boolean;
  onClose: () => void;
};

const resolveRedirectTarget = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const fromBrowser =
    typeof window !== "undefined" ? window.location.origin : "";
  const base = fromEnv || fromBrowser || "";
  return `${base}/auth/update-password`;
};

export const ForgotPasswordModal = ({ open, onClose }: Props) => {
  const [stage, setStage] = React.useState<Stage>("request");
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  // Soft client-side error band — used ONLY for genuine input problems
  // (empty / malformed email). Server-side errors stay silent for
  // non-enumeration; they're logged and the user still sees the generic
  // "if an account exists" message.
  const [softError, setSoftError] = React.useState<string | null>(null);

  // Reset internal state every time the modal opens so a previous
  // attempt's "sent" confirmation doesn't show up on the next open.
  React.useEffect(() => {
    if (open) {
      setStage("request");
      setEmail("");
      setSubmitting(false);
      setSoftError(null);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const value = String(fd.get("email") ?? "").trim();
    if (!value) {
      setSoftError("Enter your email to continue.");
      return;
    }
    // Lightweight format check. Don't over-validate — Supabase rejects
    // bad addresses on its end; we just want to catch obvious typos.
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setSoftError("That doesn't look like a valid email address.");
      return;
    }

    setSoftError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: resolveRedirectTarget(),
    });
    if (error) {
      // Non-enumerating: we don't surface whether the address exists.
      // Network / rate-limit errors are logged so ops can spot them.
      console.warn("[ForgotPasswordModal] resetPasswordForEmail error", error);
    }
    setEmail(value);
    setSubmitting(false);
    setStage("sent");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={stage === "request" ? "Reset your password" : "Check your inbox"}
      size="md"
      footer={
        stage === "request" ? (
          <>
            <Button kind="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              kind="dark"
              type="submit"
              form="forgot-password-form"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </>
        ) : (
          <Button kind="dark" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {stage === "request" ? (
        <form
          id="forgot-password-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-3.5"
          noValidate
        >
          <p className="text-[13px] text-charcoal leading-[1.55] -mt-1">
            Enter the email associated with your DEED account and we&apos;ll
            send password reset instructions.
          </p>
          <label className="text-[11.5px] font-medium text-muted">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="go"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brokerage.com"
              disabled={submitting}
              autoFocus
              className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </label>
          {softError && (
            <div
              role="alert"
              className="text-[12.5px] rounded-lg px-3 py-2 leading-[1.5]"
              style={{
                background: "var(--status-risk-bg)",
                color: "var(--status-risk-fg)",
                border: "1px solid var(--status-risk-bg)",
              }}
            >
              {softError}
            </div>
          )}
        </form>
      ) : (
        <div className="flex gap-4 items-start">
          <div
            className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0"
            style={{ background: "rgba(16,185,129,.10)" }}
          >
            <I.Check size={18} stroke={2.4} style={{ color: "#0f7a55" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] text-charcoal leading-[1.55]">
              If an account exists for that email, we&apos;ll send password
              reset instructions. The link expires in 60 minutes.
            </p>
            <p className="text-[12.5px] text-muted leading-[1.55] mt-2">
              Didn&apos;t see it? Check your spam folder, or try again in a
              few minutes.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
};
