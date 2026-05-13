import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getThreadWithMessages, getCurrentProfile } from "@/lib/supabase/queries";
import { mapThread } from "@/lib/supabase/message-shape";
import { firstNameOf } from "@/lib/profile-utils";
import { AgentThreadClient } from "./AgentThreadClient";

export default async function AgentMessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const [profile, payload] = await Promise.all([
    getCurrentProfile(),
    getThreadWithMessages(threadId),
  ]);
  if (!profile || !payload) notFound();

  // Look up the client's display name from their profile row. RLS lets
  // the agent read profiles in their org (incl. the client on this
  // thread), so a direct `.eq("id", client_id)` works.
  const supabase = await createClient();
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", payload.thread.client_id)
    .maybeSingle();

  const thread = mapThread(payload.thread, payload.messages);

  return (
    <AgentThreadClient
      thread={thread}
      clientName={clientProfile?.full_name ?? "Client"}
      agentFirstName={firstNameOf(profile.full_name) || "you"}
    />
  );
}
