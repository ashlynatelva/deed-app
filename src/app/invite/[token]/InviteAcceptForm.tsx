"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useBranding } from "@/lib/hooks/useBranding";
import { acceptInvite } from "@/lib/actions/invites";
import type { InvitePreview } from "@/lib/actions/invites";

type Props = {
  token: string;
  preview: InvitePreview;
};

const isBlocked = (
  status: InvitePreview["status"],
): status is "accepted" | "expired" | "revoked" | "not_found" =>
  status !== "pending";

/**
 * The acceptance UI. Splits the work between two states:
 *   - "pending": form to set a password and confirm full name
 *   - everything else: explanatory dead-end (no form)
 *
 * On a successful accept the server action signs the user in and we
 * full-page navigate to /client/overview so the proxy sees the fresh
 * cookies on the next request.
 */
export const InviteAcceptForm = ({ token, preview }: Props) => {
  const { settings, palette } = useBranding();
  const brandName = preview.brokerageName || settings.brokerageName?.trim() || "DEED";

  const [fullName, setFullName] = React.useState(preview.fullName ?? "");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Sign-up pipeline, callable from both the form's onSubmit (Enter key) AND
   * the button's onClick (tap). Decoupling from the implicit click→submit
   * chain mirrors the login fix in `LoginForm` — needed because that chain
   * was being silently suppressed on this stack (React Compiler / Next 16).
   */
  const performAccept = async (form: HTMLFormElement) => {
    if (submitting) return;

    // Read live DOM values so iOS Safari password-manager autofill (which
    // doesn't always fire React's onChange) still produces a valid submission.
    const fd = new FormData(form);
    const fullNameValue = String(fd.get("fullName") ?? "").trim();
    const passwordValue = String(fd.get("password") ?? "");

    if (!fullNameValue || !passwordValue) {
      setError("Enter your full name and a password to continue.");
      return;
    }
    if (passwordValue.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (fullNameValue !== fullName) setFullName(fullNameValue);
    if (passwordValue !== password) setPassword(passwordValue);

    setError(null);
    setSubmitting(true);
    const res = await acceptInvite({ token, password: passwordValue, fullName: fullNameValue });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Full-page navigation so the proxy sees the just-set session cookie.
    window.location.assign(res.data.destination);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void performAccept(e.currentTarget);
  };

  const onAcceptClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    if (!form) return;
    e.preventDefault();
    void performAccept(form);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(180deg, #0F172A 0%, #14213d 100%)" }}
    >
      <div className="w-full max-w-[460px]">
        {/* Wordmark — matches the login screen so accepted invites land in a
            familiar visual environment. */}
        <div className="flex flex-col items-center mb-10 text-white">
          {/* Brokerage logo if uploaded; otherwise the DEED platform mark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.logoDataUrl || "/logo.png"}
            alt={brandName}
            className="w-12 h-12 rounded-md object-cover mb-4"
          />
          <span className="sr-only">{brandName.charAt(0).toUpperCase()}</span>
          <div className="serif text-[28px] tracking-[.04em]">{brandName.toUpperCase()}</div>
          <div className="text-[11px] uppercase tracking-[.18em] mt-2" style={{ color: "rgba(255,255,255,.55)" }}>
            {preview.targetRole === "agent" || preview.targetRole === "admin"
              ? "Team invitation"
              : "Client portal invitation"}
          </div>
        </div>

        <div
          className="bg-white rounded-[12px] p-8"
          style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,.55), 0 6px 18px rgba(0,0,0,.25)" }}
        >
          {isBlocked(preview.status) ? (
            <BlockedState preview={preview} />
          ) : (
            <>
              <div className="serif text-[22px] mb-1.5">Welcome.</div>
              <div className="text-[13px] text-muted mb-6 leading-[1.6]">
                {preview.targetRole === "agent" || preview.targetRole === "admin" ? (
                  // Team-invite copy. Mentions the brokerage + the role
                  // they're joining as. No property — team members aren't
                  // transaction-bound.
                  preview.agentName ? (
                    <>
                      <span className="text-charcoal font-medium">{preview.agentName}</span>{" "}
                      has invited you to join the{" "}
                      <span className="text-charcoal">{brandName}</span> team as{" "}
                      {preview.targetRole === "admin" ? "an admin" : "an agent"}. Set a password to continue.
                    </>
                  ) : (
                    <>Set a password to join the team.</>
                  )
                ) : preview.agentName ? (
                  <>
                    <span className="text-charcoal font-medium">{preview.agentName}</span> has
                    invited you to the secure portal for{" "}
                    {preview.propertyLabel ? (
                      <span className="text-charcoal">{preview.propertyLabel}</span>
                    ) : (
                      <span>your transaction</span>
                    )}
                    . Set a password to continue.
                  </>
                ) : (
                  <>Set a password to access your portal.</>
                )}
              </div>

              <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
                <label className="text-[11.5px] font-medium text-muted">
                  Email
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={preview.email ?? ""}
                    disabled
                    className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-[#FBFBFC] outline-none opacity-80"
                  />
                </label>

                <label className="text-[11.5px] font-medium text-muted">
                  Full name
                  <input
                    type="text"
                    name="fullName"
                    autoComplete="name"
                    enterKeyHint="next"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting}
                    className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
                  />
                </label>

                <label className="text-[11.5px] font-medium text-muted">
                  Choose a password
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    enterKeyHint="go"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
                  />
                </label>

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

                {/* Disabled is `submitting`-only — empty-field check happens
                    inside performAccept against the live DOM values, so iOS
                    autofill that bypasses React onChange can't strand the
                    user with a non-clickable button. */}
                <Button
                  type="submit"
                  kind="dark"
                  size="lg"
                  className="mt-2 w-full"
                  disabled={submitting}
                  aria-busy={submitting}
                  onClick={onAcceptClick}
                >
                  {submitting ? "Accepting invite…" : "Accept invite"}
                </Button>
              </form>

              <div className="flex items-center gap-3 my-6 text-[11.5px] text-muted">
                <div className="flex-1 h-px bg-hairline" />
                <I.Lock size={11} />
                <span>Secure invitation</span>
                <div className="flex-1 h-px bg-hairline" />
              </div>

              <div className="text-[12.5px] text-muted text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-blue font-medium hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-6 text-[11.5px]" style={{ color: "rgba(255,255,255,.4)" }}>
          {settings.footerText}
        </div>
      </div>
    </div>
  );
};

/**
 * Dead-end states. We don't show a form here — the visitor either
 * already has an account or needs a fresh invite. Each variant points
 * them at the right next step.
 */
const BlockedState = ({ preview }: { preview: InvitePreview }) => {
  let title: string;
  let body: React.ReactNode;
  let cta: React.ReactNode;
  switch (preview.status) {
    case "accepted":
      title = "Invitation already used";
      body = (
        <>
          This invite has been accepted. If that was you, you can sign in
          with the email on file.
        </>
      );
      cta = (
        <Link href="/login">
          <Button kind="dark" size="lg" className="w-full">
            Go to sign in
          </Button>
        </Link>
      );
      break;
    case "expired":
      title = "Invitation expired";
      body = <>This invitation is no longer valid. Ask your advisor to send you a fresh one.</>;
      cta = (
        <Link href="/login">
          <Button kind="secondary" size="lg" className="w-full">
            Back to sign in
          </Button>
        </Link>
      );
      break;
    case "revoked":
      title = "Invitation revoked";
      body = <>Your advisor cancelled this invitation. They&apos;ll send a new one if needed.</>;
      cta = (
        <Link href="/login">
          <Button kind="secondary" size="lg" className="w-full">
            Back to sign in
          </Button>
        </Link>
      );
      break;
    default:
      title = "Invitation not found";
      body = (
        <>
          We couldn&apos;t find this invitation. Double-check the link your
          advisor sent you, or ask them for a new one.
        </>
      );
      cta = (
        <Link href="/login">
          <Button kind="secondary" size="lg" className="w-full">
            Back to sign in
          </Button>
        </Link>
      );
  }
  return (
    <div className="text-center">
      <div
        className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-4"
        style={{ background: "var(--status-warn-bg)", color: "var(--status-warn-fg)" }}
      >
        <I.Bell size={18} />
      </div>
      <div className="serif text-[20px] mb-2">{title}</div>
      <div className="text-[13px] text-muted leading-[1.6] mb-6">{body}</div>
      {cta}
    </div>
  );
};
