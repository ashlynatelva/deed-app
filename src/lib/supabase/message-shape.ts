/**
 * Mapper: Supabase `message_threads` / `messages` rows → the legacy
 * `MessageThread` / `Message` shapes the prototype pages were built
 * against (`src/lib/types.ts`).
 *
 * Legacy uses camelCase + bundled messages array on the thread; the
 * Supabase rows use snake_case + a separate `messages` table.
 */

import type { MessageRow, ThreadRow } from "./queries";
import type { Message, MessageThread } from "@/lib/types";

/** ISO date-only when present (legacy createdAt is a YYYY-MM-DD string). */
const toDayString = (ts: string): string => ts.slice(0, 10);

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    body: row.body,
    createdAt: toDayString(row.created_at),
    readByAgent: row.read_by_agent,
    readByClient: row.read_by_client,
  };
}

export function mapThread(thread: ThreadRow, messages: MessageRow[]): MessageThread {
  return {
    threadId: thread.id,
    transactionId: thread.transaction_id,
    clientId: thread.client_id,
    agentId: thread.agent_id,
    subject: thread.subject,
    relatedProperty: thread.related_property ?? "",
    status: thread.status,
    messages: messages.map(mapMessage),
  };
}
