"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { DeedMonogram } from "@/components/shared/DeedMonogram";
import { useBranding } from "@/lib/hooks/useBranding";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Set-new-password screen — the redirect target for Supabase
// `resetPasswordForEmail` links.
//
// Flow:
//   1. User clicks the link in the reset email. Supabase appends auth
//      tokens to the URL hash (#access_token=…&refresh_token=…&type=recovery).
//   2. The Supabase browser client picks those up on first call and
//      sets the recovery session — at which point `auth.getUser()`
//      returns the user.
//   3. We render the new-password form. Submitting calls
//      `auth.updateUser({ password })` and, on success, signs the user
//      out and bounces back to /login?notice=password_updated.
//
// If the user lands here WITHOUT the hash tokens (bookmark, link
// expired, etc.) `auth.getUser()` returns null and we show a calm
// "link expired" state with a CTA back to /login.
//
// The proxy lets /auth/* through without gating (only /agent, /client,
// /login, / are gated), so this page is reachable while authenticated
// AND while unauthenticated — exactly what we need for the brief
// recovery-session window between the email click and the password
// update.
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "loading" | "ready" | "expired" | "saving" | "done";

export default function UpdatePasswordPage() {
  const { settings } = useBranding();
  const brandName = settings.brokerageName?.trim() || "DEED";

  const [stage, setStage] = React.useState<Stage>("loading");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // On mount: ask the browser-side Supabase client whether a user is
  // present. The client auto-detects the recovery tokens in the URL
  // hash before this resolves.
  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setStage(data.user ? "ready" : "expired");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stage === "saving") return;

    // Read live DOM via FormData for iOS Safari autofill compatibility —
    // same pattern as LoginForm.
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (!pw || pw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pw !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setError(null);
    setStage("saving");

    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password: pw });
    if (updateErr) {
      console.error("[update-password] updateUser failed", updateErr);
      setError(updateErr.message || "Couldn't update password. Please try again.");
      setStage("ready");
      return;
    }

    // Sign out so the brief recovery session doesn't carry into a
    // signed-in portal. The user comes back through /login with the
    // role-tab gate enforcing where they're allowed to go.
    await supabase.auth.signOut();
    setStage("done");
    // Full-page navigation so the proxy re-reads the cleared session
    // cookies and the LoginForm picks up the ?notice= flag freshly.
    window.location.assign("/login?notice=password_updated");
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(180deg, #0F172A 0%, #14213d 100%)" }}
    >
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-7 text-white">
          <DeedMonogram className="w-48 h-48 mb-3" />
          <div className="serif text-[28px] tracking-[.04em]">{brandName.toUpperCase()}</div>
          <div className="text-[11px] uppercase tracking-[.18em] mt-1.5" style={{ color: "rgba(255,255,255,.55)" }}>
            Set a new password
          </div>
        </div>

        <div
          className="bg-white rounded-[12px] p-8"
          style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,.55), 0 6px 18px rgba(0,0,0,.25)" }}
        >
          {stage === "loading" ? (
            <div className="py-6 text-center text-[13px] text-muted">Verifying reset link…</div>
          ) : stage === "expired" ? (
            <ExpiredState />
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
              <div className="serif text-[22px] mb-1.5">Choose a new password</div>
              <div className="text-[13px] text-muted mb-2">
                Use at least 8 characters. After saving, you&apos;ll sign in
                with the new password.
              </div>

              <label className="text-[11.5px] font-medium text-muted">
                New password
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={stage === "saving"}
                  autoFocus
                  className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
                />
              </label>

              <label className="text-[11.5px] font-medium text-muted">
                Confirm password
                <input
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  enterKeyHint="go"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter the new password"
                  disabled={stage === "saving"}
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

              <Button
                type="submit"
                kind="dark"
                size="lg"
                className="mt-2 w-full"
                disabled={stage === "saving"}
                aria-busy={stage === "saving"}
              >
                {stage === "saving" ? "Updating…" : "Update password"}
              </Button>

              <div className="flex items-center gap-3 my-2 text-[11.5px] text-muted">
                <div className="flex-1 h-px bg-hairline" />
                <I.Lock size={11} />
                <span>Secure update</span>
                <div className="flex-1 h-px bg-hairline" />
              </div>

              <div className="text-[12.5px] text-muted text-center">
                Remembered your password?{" "}
                <Link href="/login" className="text-blue font-medium hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-6 text-[11.5px]" style={{ color: "rgba(255,255,255,.4)" }}>
          {settings.footerText}
        </div>
      </div>
    </div>
  );
}

// ─── Expired / invalid link state ───────────────────────────────────────────
const ExpiredState = () => (
  <div className="text-center">
    <div
      className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-4"
      style={{ background: "var(--status-warn-bg)", color: "var(--status-warn-fg)" }}
    >
      <I.Lock size={18} />
    </div>
    <div className="serif text-[20px] mb-2">Link expired</div>
    <div className="text-[13px] text-muted leading-[1.6] mb-6">
      This password reset link has expired or is invalid. Request a new one
      from the sign-in screen.
    </div>
    <Link href="/login">
      <Button kind="dark" size="lg" className="w-full">
        Back to sign in
      </Button>
    </Link>
  </div>
);
