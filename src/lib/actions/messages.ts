"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase F — Messages + threads server actions.
//
// The 0001 `messages_on_insert` trigger handles all the downstream effects
// of a new message insert:
//   1. Notification fan-out to the other party.
//   2. Auto-reopen of a resolved thread when the client replies.
//   3. Bumps `message_threads.updated_at` for inbox sort.
//   4. Activity-log entry.
//
// So app code only needs to do the bare writes — DB triggers do the rest.
//
// RLS gates (from 0002, recursion-safe):
//   - message_threads: select/update/delete via `agent_id = auth.uid()
//     OR client_id = auth.uid()`. Insert is split into agent / client
//     variants enforcing transaction ownership (now via the helper).
//   - messages: select via `thread_id IN (threads I'm on)`, insert via
//     `sender_id = auth.uid() AND thread_id IN (threads I'm on)`,
//     update same gate (used to flip read flags).
// ─────────────────────────────────────────────────────────────────────────────

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const revalidateMessagePaths = (threadId?: string) => {
  revalidatePath("/agent/messages");
  revalidatePath("/client/messages");
  if (threadId) revalidatePath(`/agent/messages/${threadId}`);
};

// ─── sendMessage ────────────────────────────────────────────────────────────

/**
 * Append a message to an existing thread. RLS enforces that the sender
 * is on the thread; the messages_on_insert trigger handles notifications
 * + status flip + updated_at + activity log.
 *
 * The role is derived server-side from the user's profile rather than
 * trusted from the client — clients can't masquerade as agents.
 */
export async function sendMessage(
  threadId: string,
  body: string,
): Promise<Result<{ id: string }>> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Message body is empty." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };

  const senderRole: Tables<"messages">["sender_role"] =
    profile.role === "client" ? "client" : "agent";

  const { data, error } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_role: senderRole,
      sender_name: profile.full_name,
      body: trimmed,
      // The sender has obviously read their own message; the other side
      // is unread until they open the thread.
      read_by_agent:  senderRole === "agent",
      read_by_client: senderRole === "client",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[sendMessage]", error);
    return { ok: false, error: error?.message ?? "Could not send message." };
  }

  revalidateMessagePaths(threadId);
  return { ok: true, data: { id: data.id } };
}

// ─── createThread ───────────────────────────────────────────────────────────

/**
 * Create a new thread on a transaction with an initial message. The
 * inserting role is derived from the user's profile:
 *   - agents create threads on their own transactions
 *   - clients create threads on their own transaction
 * RLS enforces both.
 */
export async function createThread(input: {
  transactionId: string;
  subject: string;
  body: string;
}): Promise<Result<{ threadId: string }>> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) return { ok: false, error: "Subject is required." };
  if (!body)    return { ok: false, error: "Message body is required." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };

  // Look up the transaction so we can populate the thread's denormalized
  // fields (agent_id, client_id, related_property) without trusting the
  // caller for them. Soft-deleted transactions are off-limits — a thread
  // shouldn't be created against a deal that's been removed.
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, agent_id, client_id, address")
    .eq("id", input.transactionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (txErr || !tx) {
    return { ok: false, error: txErr?.message ?? "Transaction not found." };
  }
  if (!tx.client_id) {
    return { ok: false, error: "This transaction doesn't have a client yet." };
  }

  // Insert thread.
  const { data: thread, error: threadErr } = await supabase
    .from("message_threads")
    .insert({
      transaction_id: tx.id,
      client_id: tx.client_id,
      agent_id: tx.agent_id,
      subject,
      related_property: tx.address,
      status: "needs_response",
    })
    .select("id")
    .single();
  if (threadErr || !thread) {
    console.error("[createThread] thread", threadErr);
    return { ok: false, error: threadErr?.message ?? "Could not create thread." };
  }

  // Insert the first message — trigger fires fan-out.
  const senderRole: Tables<"messages">["sender_role"] =
    profile.role === "client" ? "client" : "agent";
  const { error: msgErr } = await supabase.from("messages").insert({
    thread_id: thread.id,
    sender_id: user.id,
    sender_role: senderRole,
    sender_name: profile.full_name,
    body,
    read_by_agent:  senderRole === "agent",
    read_by_client: senderRole === "client",
  });
  if (msgErr) {
    console.error("[createThread] message", msgErr);
    // Best-effort cleanup so we don't leave an empty thread.
    await supabase.from("message_threads").delete().eq("id", thread.id);
    return { ok: false, error: msgErr.message };
  }

  revalidateMessagePaths(thread.id);
  return { ok: true, data: { threadId: thread.id } };
}

// ─── markThreadRead ─────────────────────────────────────────────────────────

/**
 * Flip the user's read flag to `true` on every message in the thread.
 * Called when the user visits the thread detail page (or, for the
 * client portal, the messages index since it inlines all threads).
 */
export async function markThreadRead(threadId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };

  // Agents flip read_by_agent; clients flip read_by_client.
  const patch =
    profile.role === "client"
      ? { read_by_client: true }
      : { read_by_agent: true };

  const readColumn = profile.role === "client" ? "read_by_client" : "read_by_agent";

  // Update only the not-yet-read rows — and skip messages the user sent
  // themselves (those were marked read on insert).
  const { error } = await supabase
    .from("messages")
    .update(patch)
    .eq("thread_id", threadId)
    .eq(readColumn, false)
    .neq("sender_id", user.id);
  if (error) {
    console.error("[markThreadRead]", error);
    return { ok: false, error: error.message };
  }

  revalidateMessagePaths(threadId);
  return { ok: true, data: undefined };
}

// ─── setThreadStatus ────────────────────────────────────────────────────────

export async function setThreadStatus(
  threadId: string,
  status: "needs_response" | "resolved",
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_threads")
    .update({ status })
    .eq("id", threadId);
  if (error) {
    console.error("[setThreadStatus]", error);
    return { ok: false, error: error.message };
  }
  revalidateMessagePaths(threadId);
  return { ok: true, data: undefined };
}

// ─── deleteThread ───────────────────────────────────────────────────────────

export async function deleteThread(threadId: string): Promise<Result> {
  const supabase = await createClient();
  // Cascade is set in the schema — messages auto-delete with the thread.
  const { error } = await supabase
    .from("message_threads")
    .delete()
    .eq("id", threadId);
  if (error) {
    console.error("[deleteThread]", error);
    return { ok: false, error: error.message };
  }
  revalidateMessagePaths();
  return { ok: true, data: undefined };
}
