import { notFound } from "next/navigation";

import {
  getThreadsForCurrentUser,
  getClientsForCurrentAgent,
  getCurrentProfile,
} from "@/lib/supabase/queries";
import { AgentMessagesClient, type InboxRow, type AgentClientOption } from "./AgentMessagesClient";

export default async function AgentMessagesPage() {
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const [summaries, clients] = await Promise.all([
    getThreadsForCurrentUser(),
    getClientsForCurrentAgent(),
  ]);

  // The inbox view shows only threads where the signed-in agent is the
  // agent side. RLS would already enforce this, but filtering here keeps
  // the row count truthful (a future admin role would see everything).
  const rows: InboxRow[] = summaries
    .filter(({ thread }) => thread.agent_id === profile.id)
    .map(({ thread, lastMessage, unreadCount }) => {
      const client = clients.find((c) => c.profile.id === thread.client_id);
      return {
        threadId: thread.id,
        transactionId: thread.transaction_id,
        subject: thread.subject,
        relatedProperty: thread.related_property ?? "—",
        status: thread.status,
        clientName: client?.profile.full_name ?? "Client",
        preview: lastMessage?.body ?? "",
        previewFromAgent: lastMessage?.sender_role === "agent",
        lastAt: lastMessage?.created_at ?? null,
        unreadCount,
      };
    });

  const clientOptions: AgentClientOption[] = clients
    .filter((c) => !!c.transaction)
    .map((c) => ({
      value: c.profile.id,
      label: c.profile.full_name,
      txId: c.transaction!.id,
    }));

  return (
    <AgentMessagesClient
      agentUserId={profile.id}
      rows={rows}
      clientOptions={clientOptions}
    />
  );
}
