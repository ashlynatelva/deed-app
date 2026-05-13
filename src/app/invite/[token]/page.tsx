import { getInvitePreview } from "@/lib/actions/invites";
import { InviteAcceptForm } from "./InviteAcceptForm";

/**
 * Public invite-acceptance page. Reachable without authentication so the
 * link the agent shares with a new client just works in any tab. The
 * proxy already lets /invite/* through unauthenticated (the matcher
 * passes everything but only gates /, /login, /agent/*, /client/*).
 *
 * The preview lookup runs server-side via the service role so the page
 * can render the right state even before the visitor has a session.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getInvitePreview(token);

  return <InviteAcceptForm token={token} preview={preview} />;
}
