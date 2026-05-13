import "server-only";

// ─────────────────────────────────────────────────────────────────────────────
// Invite email template.
//
// Plain inlined HTML + text fallback. Email clients are a hostile
// rendering target — no CSS frameworks, no external stylesheets, no
// JavaScript. Everything is inline styles, table-based layout where it
// matters (button is a `<a>` styled as a button so it survives the
// Outlook desktop renderer), and a sober palette that doesn't fight
// the brokerage brand.
//
// Branches by `targetRole`:
//   - 'client'        — "invited you to your secure portal for <property>"
//   - 'agent'|'admin' — "invited you to join the team at <brokerage>"
//
// Tokens we accept:
//   - brokerageName  : Drives the wordmark and the from-line copy.
//   - agentName      : Who's inviting (used in the greeting + signature).
//   - clientName     : Recipient's name (used in the greeting). Field
//                      name is historical — applies to team invites too.
//   - propertyLabel  : Optional context line for client invites only.
//   - inviteUrl      : The /invite/<token> URL the recipient clicks.
//   - supportEmail   : Optional. Renders a quiet "Reply to <addr>" line.
//   - targetRole     : 'client' | 'agent' | 'admin'. Drives subject +
//                      eyebrow + body copy. Defaults to 'client' for
//                      backwards compat.
// ─────────────────────────────────────────────────────────────────────────────

export type InviteEmailTokens = {
  brokerageName: string;
  agentName: string;
  clientName: string;
  propertyLabel: string | null;
  inviteUrl: string;
  supportEmail?: string | null;
  targetRole?: "client" | "agent" | "admin";
};

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderInviteEmail(t: InviteEmailTokens): { subject: string; html: string; text: string } {
  const targetRole = t.targetRole ?? "client";
  const isTeam = targetRole === "agent" || targetRole === "admin";

  // Subject + eyebrow + body copy vary by branch. Everything else
  // (wordmark, CTA button, footer, plain-text fallback structure) is
  // shared so the visual language stays consistent.
  const subject = isTeam
    ? `${t.agentName} invited you to join the team at ${t.brokerageName}`
    : `${t.agentName} invited you to your ${t.brokerageName} portal`;

  const eyebrow = isTeam ? "Team invitation" : "Client portal invitation";

  const firstName = t.clientName.split(/\s|&/)[0] || t.clientName;

  // Body paragraph 1 — branches by role. For clients, mentions the
  // property if we have one; for team members, names the brokerage.
  const propertyLine = t.propertyLabel
    ? `for <strong style="color:#0F172A">${escape(t.propertyLabel)}</strong>`
    : "for your transaction";

  const bodyPara1 = isTeam
    ? `<strong style="color:#0F172A">${escape(t.agentName)}</strong> has invited
       you to join the ${escape(t.brokerageName)} team as
       ${targetRole === "admin" ? "an admin" : "an agent"}. You'll be
       able to manage transactions, message clients, and collaborate
       with the rest of the team from your ${escape(t.brokerageName)} workspace.`
    : `<strong style="color:#0F172A">${escape(t.agentName)}</strong> has invited
       you to a secure portal ${propertyLine}. You'll use it to track your
       transaction, share documents, and message ${escape(firstName)}'s
       advisor team directly.`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:#F3F4F6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color:#1E293B;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:#F3F4F6; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="520" style="max-width:520px; width:100%; background:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow: 0 6px 16px rgba(15,23,42,.06);">
            <tr>
              <td style="padding:28px 36px 8px 36px; background:linear-gradient(180deg,#0F172A 0%,#14213d 100%); color:#FFFFFF; text-align:center;">
                <div style="font-family: Georgia, 'Times New Roman', serif; font-size:24px; letter-spacing:.04em;">${escape(t.brokerageName.toUpperCase())}</div>
                <div style="font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.55); margin-top:6px; padding-bottom:24px;">
                  ${eyebrow}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px 8px 36px;">
                <h1 style="margin:0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size:22px; font-weight:normal; color:#0F172A;">
                  Welcome, ${escape(firstName)}.
                </h1>
                <p style="margin:0 0 16px 0; font-size:14.5px; line-height:1.6; color:#334155;">
                  ${bodyPara1}
                </p>
                <p style="margin:0 0 24px 0; font-size:14.5px; line-height:1.6; color:#334155;">
                  Click below to set a password and get started.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 24px 36px;" align="center">
                <a href="${escape(t.inviteUrl)}"
                   style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none; padding:13px 28px; font-size:14px; font-weight:600; border-radius:10px; letter-spacing:.01em;">
                  Accept invitation
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 8px 36px;">
                <p style="margin:0; font-size:12.5px; line-height:1.55; color:#64748B;">
                  If the button doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="margin:6px 0 0 0; font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size:12px; word-break:break-all; color:#475569;">
                  ${escape(t.inviteUrl)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 28px 36px; border-top:1px solid #E5E7EB; margin-top:16px;">
                <p style="margin:16px 0 0 0; font-size:12px; line-height:1.55; color:#64748B;">
                  This invitation expires in 14 days. If you weren't expecting it,
                  it's safe to ignore — no account is created until you accept.
                </p>
                ${
                  t.supportEmail
                    ? `<p style="margin:10px 0 0 0; font-size:12px; line-height:1.55; color:#64748B;">
                         Questions? Reply to this email or reach out to
                         <a href="mailto:${escape(t.supportEmail)}" style="color:#0F172A;">${escape(t.supportEmail)}</a>.
                       </p>`
                    : ""
                }
              </td>
            </tr>
          </table>
          <div style="margin-top:18px; font-size:11px; color:#94A3B8;">
            © ${new Date().getFullYear()} ${escape(t.brokerageName)}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Plain-text fallback — same structure, no markup. Branches by role
  // so the body matches the HTML.
  const textBody = isTeam
    ? `${t.agentName} has invited you to join the ${t.brokerageName} team as ${
        targetRole === "admin" ? "an admin" : "an agent"
      }.`
    : `${t.agentName} has invited you to the secure ${t.brokerageName} client portal${
        t.propertyLabel ? ` for ${t.propertyLabel}` : ""
      }.`;

  const text = [
    `Welcome, ${firstName}.`,
    "",
    textBody,
    "",
    "Accept your invitation:",
    t.inviteUrl,
    "",
    "This invitation expires in 14 days. If you weren't expecting it, it's safe to ignore — no account is created until you accept.",
    t.supportEmail ? `\nQuestions? Reach out to ${t.supportEmail}.` : "",
    "",
    `© ${new Date().getFullYear()} ${t.brokerageName}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
