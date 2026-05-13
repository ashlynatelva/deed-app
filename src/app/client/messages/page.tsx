import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  getTransactionForCurrentClient,
  getThreadsForCurrentUser,
} from "@/lib/supabase/queries";
import { mapThread } from "@/lib/supabase/message-shape";
import { deriveInitials, firstNameOf } from "@/lib/profile-utils";
import { ClientMessagesClient } from "./ClientMessagesClient";

export default async function ClientMessagesPage() {
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const tx = await getTransactionForCurrentClient();
  if (!tx) notFound();

  // Resolve the agent's display name from their profile via RLS. The
  // "Clients read their agent" policy from 0012 grants this read.
  const supabase = await createClient();
  const { data: agentProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", tx.agent_id)
    .maybeSingle();
  const agentName = agentProfile?.full_name ?? "your advisor";
  const agentFirstName = firstNameOf(agentName) || "your advisor";

  // Threads + messages for this user. We fetch full messages per thread
  // because the client portal inlines them all in the inbox view
  // (separate detail page is not part of the design).
  const summaries = await getThreadsForCurrentUser();

  // Load full message list for each thread the user is on. Per-thread
  // queries respect RLS and feel cheap for the small inbox sizes we
  // expect on a client portal.
  const fullThreads = await Promise.all(
    summaries.map(async (s) => {
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", s.thread.id)
        .order("created_at", { ascending: true });
      return mapThread(s.thread, messages ?? []);
    }),
  );

  return (
    <ClientMessagesClient
      clientUserId={profile.id}
      txId={tx.id}
      agentName={agentName}
      agentFirstName={agentFirstName}
      clientFullName={profile.full_name}
      clientInitials={deriveInitials(profile.full_name)}
      threads={fullThreads}
    />
  );
}
