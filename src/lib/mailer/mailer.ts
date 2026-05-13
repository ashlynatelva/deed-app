// ─────────────────────────────────────────────────────────────────────────────
// Minimal email-send adapter (Resend via REST).
//
// Why Resend, why no SDK:
//   Resend is the canonical Next.js partner — clean REST API, generous
//   free tier, one-shot domain verification. The REST surface we need is
//   POST /emails, which fits in ~20 lines via plain fetch. Skipping the
//   `resend` npm package keeps the bundle small and the dependency
//   surface trivially auditable.
//
// Configuration (server-only env vars):
//   RESEND_API_KEY      — Resend secret key. When unset, every send()
//                         call returns `{ ok: false, reason: "not_configured" }`
//                         and the caller falls back to the manual share-link UX.
//   RESEND_FROM_EMAIL   — verified sender, e.g. "invites@yourdomain.com".
//                         Required only if RESEND_API_KEY is set.
//
// Failure mode:
//   send() never throws. It returns a discriminated result so the caller
//   can branch on "sent" / "not_configured" / "failed" and surface the
//   right UX (success toast vs. copy-link prompt).
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendInput = {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback. Recommended for spam-filter friendliness. */
  text?: string;
  /** Override the default sender (rarely needed). */
  from?: string;
  /** Reply-To header — usually the agent's address so client replies route correctly. */
  replyTo?: string;
};

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured"; detail?: string }
  | { ok: false; reason: "failed"; detail: string };

const isEmailConfigured = (): boolean =>
  !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;

export async function sendEmail(input: SendInput): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      detail:
        "Set RESEND_API_KEY and RESEND_FROM_EMAIL to enable outbound email. " +
        "Until then, the share link is the delivery channel.",
    };
  }

  const from = input.from ?? process.env.RESEND_FROM_EMAIL!;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    // Resend returns { id: "..." } on success and { name, message, statusCode }
    // on failure. We surface the message so the action's error toast says
    // something useful instead of a bare status code.
    const json = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string; statusCode?: number }
      | null;

    if (!res.ok) {
      const detail = json?.message ?? `${res.status} ${res.statusText}`;
      console.error("[mailer] Resend rejected send", { status: res.status, json });
      return { ok: false, reason: "failed", detail };
    }
    if (!json?.id) {
      return { ok: false, reason: "failed", detail: "Resend did not return an id." };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[mailer] send threw", err);
    return { ok: false, reason: "failed", detail };
  }
}
