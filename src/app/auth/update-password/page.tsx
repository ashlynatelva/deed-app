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
//   1. User clicks the link in the reset email. Supabase verifies the
//      token then redirects to this page. Two URL shapes are possible:
//        a. PKCE flow (default in @supabase/ssr ≥ 0.4):
//             /auth/update-password?code=<auth-code>
//           We MUST call `auth.exchangeCodeForSession(code)` explicitly
//           to establish the recovery session — the browser client does
//           NOT auto-exchange this for us.
//        b. Implicit flow (legacy):
//             /auth/update-password#access_token=…&refresh_token=…&type=recovery
//           The browser client auto-detects the hash on first call.
//      If Supabase rejected the token (expired, malformed, replayed),
//      the URL instead contains `?error=…&error_code=…&error_description=…`.
//   2. Once a session is established, we render the new-password form.
//      Submitting calls `auth.updateUser({ password })` and, on success,
//      signs the user out and bounces back to
//      /login?notice=password_updated.
//   3. If the user lands here without any of those URL params (bookmark,
//      link expired, link reused), we show a calm "link expired" state
//      with a CTA back to /login.
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

  // On mount: figure out which auth-link shape Supabase used and turn
  // it into a recovery session before we try to render the form.
  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      // Supabase puts the failure reason in either ?error=… or
      // ?error_code=…; surface either as "expired".
      const linkError =
        url.searchParams.get("error") ??
        url.searchParams.get("error_code");

      if (linkError) {
        console.warn("[update-password] Supabase returned link error", {
          error: linkError,
          description: url.searchParams.get("error_description"),
        });
        if (!cancelled) setStage("expired");
        return;
      }

      // PKCE flow: explicitly exchange the auth code for a recovery
      // session. The Supabase browser client does NOT do this for us
      // when the code is in a `?code=` query param (only the hash
      // form is auto-detected).
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeErr) {
          console.warn("[update-password] exchangeCodeForSession failed", exchangeErr);
          setStage("expired");
          return;
        }
        // Strip the code from the URL so a refresh / back-navigation
        // doesn't try to re-exchange (which would 400 — codes are
        // one-shot).
        window.history.replaceState({}, "", url.pathname);
      }

      // Final check: did we end up with a real recovery session?
      // - PKCE path: exchange above just set it.
      // - Implicit/hash path: the browser client auto-detected
      //   #access_token=… on construction and set it.
      // - Already-signed-in user visiting directly: also valid; they
      //   can update their own password.
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
