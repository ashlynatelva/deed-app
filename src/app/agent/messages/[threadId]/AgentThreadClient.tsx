"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { useMessagesRealtime } from "@/lib/hooks/useMessagesRealtime";
import {
  sendMessage,
  setThreadStatus,
  deleteThread,
  markThreadRead,
} from "@/lib/actions/messages";
import { fmtShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Message, MessageThread } from "@/lib/types";

const statusStyles = {
  needs_response: { bg: "var(--status-warn-bg)", fg: "var(--status-warn-fg)", label: "Needs response" },
  resolved:       { bg: "var(--status-ok-bg)",   fg: "var(--status-ok-fg)",   label: "Resolved" },
};

type Props = {
  thread: MessageThread;
  clientName: string;
  agentFirstName: string;
};

export const AgentThreadClient = ({ thread, clientName, agentFirstName }: Props) => {
  // Realtime: refresh when a new message lands in this specific thread.
  useMessagesRealtime({ kind: "thread", threadId: thread.threadId });

  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // After messages append, scroll the conversation pane to the newest entry.
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.messages.length]);

  // Visiting the thread page marks every message read for the agent.
  // Fire-and-forget — the server action revalidates the page after.
  React.useEffect(() => {
    if (thread.messages.some((m) => !m.readByAgent)) {
      void markThreadRead(thread.threadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.threadId]);

  const status = statusStyles[thread.status];
  const otherStatus: typeof thread.status =
    thread.status === "resolved" ? "needs_response" : "resolved";

  const sendReply = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const res = await sendMessage(thread.threadId, trimmed);
    setSending(false);
    if (res.ok) {
      setDraft("");
      toast.push("Message sent", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  const toggleStatus = async () => {
    const res = await setThreadStatus(thread.threadId, otherStatus);
    if (res.ok) {
      toast.push(
        otherStatus === "resolved" ? "Thread marked as resolved." : "Thread reopened.",
        "success",
      );
    } else {
      toast.push(res.error, "info");
    }
  };

  const onDelete = async () => {
    const res = await deleteThread(thread.threadId);
    if (res.ok) {
      toast.push("Message deleted", "success");
      router.push("/agent/messages");
    } else {
      toast.push(res.error, "info");
    }
  };

  return (
    <PageShell width="narrow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/agent/messages"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
        >
          <span className="inline-flex rotate-180"><I.Right size={12} /></span>
          Back to messages
        </Link>

        <RowActionsMenu
          ariaLabel="Thread actions"
          actions={[
            { id: "view-tx", label: "View transaction", icon: "Building",
              onSelect: () => router.push(`/agent/transactions/${thread.transactionId}`) },
            { id: "delete",  label: "Delete message",   icon: "Trash", destructive: true,
              onSelect: () => setPendingDelete(true) },
          ]}
        />
      </div>

      <Card padded={false} className="mb-4">
        <div className="px-6 pt-5 pb-4 border-b border-hairline">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="serif text-[22px] tracking-[-0.01em]">{thread.subject}</div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-2 text-[12.5px] text-charcoal">
                  <Avatar name={clientName} size={20} tone="light" />
                  {clientName}
                </div>
                <span className="w-1 h-1 rounded-full bg-hairline" />
                <Link
                  href={`/agent/transactions/${thread.transactionId}`}
                  className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-blue transition-colors"
                >
                  <I.Building size={12} />
                  <span className="underline-offset-2 hover:underline">{thread.relatedProperty}</span>
                </Link>
              </div>
            </div>
            <span
              className="text-[11.5px] rounded-full px-2.5 py-1 font-medium whitespace-nowrap"
              style={{ background: status.bg, color: status.fg }}
            >
              {status.label}
            </span>
          </div>
        </div>

        <div ref={scrollRef} className="px-6 py-5 max-h-[60vh] overflow-y-auto bg-[#FBFBFC]">
          <div className="flex flex-col gap-3.5">
            {thread.messages.map((msg) => (
              <Bubble key={msg.id} message={msg} />
            ))}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-hairline bg-white">
          <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-2 font-medium">
            Reply as {agentFirstName}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) {
                e.preventDefault();
                void sendReply();
              }
            }}
            disabled={sending}
            placeholder="Write your reply…"
            className="w-full min-h-[110px] p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none resize-y focus:border-blue/60 disabled:opacity-60"
          />
          <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
            <Button
              kind="secondary"
              size="sm"
              onClick={toggleStatus}
              icon={thread.status === "resolved" ? <I.Bell size={12} /> : <I.Check size={12} />}
            >
              {thread.status === "resolved" ? "Mark needs response" : "Mark resolved"}
            </Button>
            <Button kind="primary" disabled={!draft.trim() || sending} onClick={sendReply} icon={<I.Mail size={13} />}>
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </div>
          <div className="text-[11px] text-muted mt-2">
            Press <kbd className="px-1 py-px rounded border border-hairline text-[10px] bg-[#FBFBFC]">⌘</kbd>
            +<kbd className="px-1 py-px rounded border border-hairline text-[10px] bg-[#FBFBFC]">Enter</kbd> to send.
          </div>
        </div>
      </Card>

      <ConfirmDeleteModal
        open={pendingDelete}
        onClose={() => setPendingDelete(false)}
        onConfirm={onDelete}
        title="Delete this message?"
        body="This permanently deletes the entire conversation and all its messages."
        confirmLabel="Delete message"
        itemName={thread.subject}
      />
    </PageShell>
  );
};

const Bubble = ({ message }: { message: Message }) => {
  const isAgent = message.senderRole === "agent";
  return (
    <div className={cn("flex gap-2.5 items-start", isAgent ? "flex-row-reverse" : "flex-row")}>
      <Avatar name={message.senderName} size={28} tone={isAgent ? "navy" : "light"} />
      <div className={cn("max-w-[78%]", isAgent ? "text-right" : "text-left")}>
        <div className="text-[11px] text-muted mb-1">
          <span className="font-medium text-charcoal">{message.senderName}</span>
          <span className="mx-1.5">·</span>
          {fmtShort(message.createdAt)}
        </div>
        <div
          className="inline-block px-3.5 py-2.5 text-[13.5px] leading-[1.55] rounded-[12px] text-left"
          style={{
            background: isAgent ? "#0F172A" : "#FFFFFF",
            color: isAgent ? "#FFFFFF" : "var(--ink)",
            border: isAgent ? "1px solid #0F172A" : "1px solid var(--hairline)",
            borderBottomRightRadius: isAgent ? 4 : 12,
            borderBottomLeftRadius: isAgent ? 12 : 4,
          }}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
};
