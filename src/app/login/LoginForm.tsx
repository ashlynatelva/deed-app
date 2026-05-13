"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useBranding } from "@/lib/hooks/useBranding";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

type Role = "agent" | "client";

/**
 * Sign-in form. Lives in its own client component so `page.tsx` can wrap it
 * in a Suspense boundary — required because `useSearchParams()` forces this
 * subtree to render on the client.
 *
 * Wires Supabase email+password sign-in to the existing UI. The role pills
 * stay (preserve the design) and act as a visual hint — actual routing
 * comes from `profiles.role` so users always land on the correct surface
 * regardless of which pill they picked.
 *
 * Post-sign-in:
 *   1. Look up the user's profile role.
 *   2. If the proxy bounced us here with `?redirectTo=/path`, honor it when
 *      the path prefix matches the role; otherwise go to role home.
 *   3. Use a full-page navigation (window.location.assign) so the proxy
 *      sees the fresh session cookies on the next request.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const { settings, palette } = useBranding();
  const toast = useToast();

  const [role, setRole] = React.useState<Role>("agent");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const brandName = settings.brokerageName?.trim() || "DEED";
  const initial = brandName.charAt(0).toUpperCase();

  // If middleware redirected us here with an explicit error flag, surface a
  // friendly message instead of a silent navigation. Render-time check
  // (rather than an effect) so React Compiler doesn't flag a cascading
  // setState — the search-param value is stable across renders unless the
  // URL actually changes.
  const errorFlag = searchParams.get("error");
  const [lastErrorFlag, setLastErrorFlag] = React.useState<string | null>(null);
  if (errorFlag !== lastErrorFlag) {
    setLastErrorFlag(errorFlag);
    if (errorFlag === "missing_profile") {
      setError("Your account isn't fully set up yet. Reach out to your advisor for an invite.");
    } else if (errorFlag === "revoked") {
      setError("Your portal access has been removed. Contact your advisor if you think this is a mistake.");
    }
  }

  /**
   * The sign-in pipeline. Driven from both `<form onSubmit>` (Enter / Go key
   * inside an input) and the Continue button's `onClick` so neither path
   * relies on the other.
   */
  const performSignIn = async (form: HTMLFormElement) => {
    if (submitting) return;

    // Source of truth: read the live DOM via FormData. iOS Safari's password
    // manager / autofill can populate inputs without firing React `onChange`,
    // so controlled state may not reflect what the user actually sees.
    const fd = new FormData(form);
    const emailValue = String(fd.get("email") ?? "").trim();
    const passwordValue = String(fd.get("password") ?? "");

    if (!emailValue || !passwordValue) {
      setError("Enter your email and password to continue.");
      return;
    }

    // Mirror back into React state so disabled inputs / placeholders behave
    // correctly during the in-flight request.
    if (emailValue !== email) setEmail(emailValue);
    if (passwordValue !== password) setPassword(passwordValue);

    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue,
    });

    if (authError || !data.user) {
      setSubmitting(false);
      const msg = authError?.message ?? "";
      // Normalize Supabase's various invalid-credential strings into a single
      // calm message; surface anything else verbatim.
      setError(
        /invalid|credentials|password/i.test(msg)
          ? "Email or password is incorrect."
          : msg || "Sign in failed. Please try again.",
      );
      return;
    }

    // Look up role + lifecycle status. Role drives the post-login
    // destination; status enforces the soft-delete revoke flow — even if
    // sign-in succeeded, an inactive profile means the agent revoked
    // portal access, so we sign them back out immediately rather than
    // letting them land on the portal and bounce on the next request.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile && profile.status !== "active") {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError("Your portal access has been removed. Contact your advisor if you think this is a mistake.");
      return;
    }

    const home = profile?.role === "client" ? "/client/overview" : "/agent/dashboard";

    const redirectTo = searchParams.get("redirectTo");
    const honorRedirect =
      redirectTo &&
      ((profile?.role === "client" && redirectTo.startsWith("/client")) ||
        (profile?.role !== "client" && redirectTo.startsWith("/agent")));
    const destination = honorRedirect && redirectTo ? redirectTo : home;

    // Full-page navigation so middleware re-runs with the new session cookie.
    window.location.assign(destination);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void performSignIn(e.currentTarget);
  };

  const handleContinueClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    if (!form) return;
    // Prevent the browser's default click→submit chain. We call performSignIn
    // ourselves so we don't risk running the pipeline twice if onSubmit also
    // fires.
    e.preventDefault();
    void performSignIn(form);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(180deg, #0F172A 0%, #14213d 100%)" }}
    >
      <div className="w-full max-w-[420px]">
        {/* Wordmark — reflects the brokerage's saved branding. */}
        <div className="flex flex-col items-center mb-10 text-white">
          {/* Brokerage logo if uploaded; otherwise the DEED platform mark
              from /public/logo.png. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.logoDataUrl || "/logo.png"}
            alt={brandName}
            className="w-12 h-12 rounded-md object-cover mb-4"
          />
          <span className="sr-only">{initial}</span>
          <div className="serif text-[28px] tracking-[.04em]">{brandName.toUpperCase()}</div>
          <div className="text-[11px] uppercase tracking-[.18em] mt-2" style={{ color: "rgba(255,255,255,.55)" }}>
            Real estate advisor platform
          </div>
        </div>

        <div
          className="bg-white rounded-[12px] p-8"
          style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,.55), 0 6px 18px rgba(0,0,0,.25)" }}
        >
          <div className="serif text-[22px] mb-1.5">Sign in</div>
          <div className="text-[13px] text-muted mb-6">Welcome back.</div>

          {/* Role selector — visual hint only; the DB decides where the user lands. */}
          <div
            className="text-[10.5px] uppercase tracking-[.14em] text-muted font-medium mb-2"
          >
            Sign in as
          </div>
          <div
            className="grid grid-cols-2 mb-6 rounded-[10px] overflow-hidden border border-hairline"
            role="tablist"
            aria-label="Sign in as"
          >
            {(["agent", "client"] as const).map((r, i) => {
              const isActive = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setRole(r)}
                  className="h-11 text-[13px] font-medium tracking-[.01em] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
                  style={{
                    background: isActive ? "var(--navy)" : "#fff",
                    color: isActive ? "#fff" : "var(--charcoal)",
                    borderLeft: i === 1 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  {r === "agent" ? "Agent" : "Client"}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            <label className="text-[11.5px] font-medium text-muted">
              Email
              {/*
                `name` + `autoComplete` are required for iOS Safari password
                manager / Keychain autofill to recognize the field and dispatch
                proper input events. `inputMode="email"` shows the @-friendly
                keyboard. `enterKeyHint="next"` makes the Return key say
                "Next" so users move into the password field naturally.
                `autoFocus` is removed: on mobile it pops the keyboard at
                first paint, which can swallow the first tap on Continue when
                a user transitions focus quickly.
              */}
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === "agent" ? "you@brokerage.com" : "you@example.com"}
                disabled={submitting}
                className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
              />
            </label>

            <label className="text-[11.5px] font-medium text-muted">
              <div className="flex items-center justify-between">
                <span>Password</span>
                {/* Rendered as a <button> so it's reliably interactive on
                    mobile (a bare `<a>` with no href isn't a real link).
                    Inline-styled to keep the exact "anchor look" — design
                    is preserved. */}
                <button
                  type="button"
                  onClick={() => {
                    toast.push(
                      "Password reset isn't available yet — contact your advisor.",
                      "info",
                    );
                  }}
                  className="text-[11.5px] text-blue hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium"
                >
                  Forgot?
                </button>
              </div>
              {/* `enterKeyHint="go"` turns the iOS Return key into "Go" so
                  pressing it submits the form directly. */}
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className="mt-1.5 w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
              />
            </label>

            {/* Inline error — only rendered when set, calm soft-red. */}
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

            {/*
              Critically, the button is NOT disabled based on whether email /
              password look empty in React state. iOS Safari + password
              managers sometimes populate inputs without firing onChange — the
              fields look filled but our state is still "". A disabled button
              would silently no-op the tap. Validation happens inside
              handleSubmit using FormData, which reflects the real DOM.
            */}
            <Button
              type="submit"
              kind="dark"
              size="lg"
              className="mt-2 w-full"
              disabled={submitting}
              aria-busy={submitting}
              onClick={handleContinueClick}
            >
              {submitting ? "Signing in…" : "Continue"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6 text-[11.5px] text-muted">
            <div className="flex-1 h-px bg-hairline" />
            <I.Lock size={11} />
            <span>Secure sign-in</span>
            <div className="flex-1 h-px bg-hairline" />
          </div>

          <div className="text-[12.5px] text-muted text-center">
            Need access?{" "}
            <Link href="#" className="text-blue font-medium hover:underline">
              Request an invite
            </Link>
          </div>
        </div>

        <div className="text-center mt-6 text-[11.5px]" style={{ color: "rgba(255,255,255,.4)" }}>
          {settings.footerText}
        </div>
      </div>
    </div>
  );
}
