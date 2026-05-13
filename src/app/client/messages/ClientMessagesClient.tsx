"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { useMessagesRealtime } from "@/lib/hooks/useMessagesRealtime";
import {
  createThread,
  sendMessage,
  markThreadRead,
} from "@/lib/actions/messages";
import { fmtShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Message, MessageThread } from "@/lib/types";

const statusStyles = {
  needs_response: { bg: "var(--status-warn-bg)", fg: "var(--status-warn-fg)", label: "Awaiting reply" },
  resolved:       { bg: "var(--status-ok-bg)",   fg: "var(--status-ok-fg)",   label: "Resolved" },
};

type Props = {
  clientUserId: string;
  txId: string;
  agentName: string;
  agentFirstName: string;
  clientFullName: string;
  clientInitials: string;
  threads: MessageThread[];
};

export const ClientMessagesClient = ({
  clientUserId,
  txId,
  agentName,
  agentFirstName,
  clientFullName,
  clientInitials,
  threads,
}: Props) => {
  useMessagesRealtime({ kind: "inbox", userId: clientUserId });

  const toast = useToast();

  // New-thread composer state.
  const [subject, setSubject] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Inline reply state — one open reply box at a time.
  const [activeReplyThreadId, setActiveReplyThreadId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState("");
  const [replying, setReplying] = React.useState(false);

  // Visiting the messages page marks every unread message read for the
  // client. One server action per thread that actually has unread mail.
  React.useEffect(() => {
    threads.forEach((t) => {
      if (t.messages.some((m) => !m.readByClient && m.senderRole !== "client")) {
        void markThreadRead(t.threadId);
      }
    });
    // Deliberately not depending on `threads` — that would re-fire on
    // every realtime refresh and create a write loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendNewThread = async () => {
    if (!subject.trim() || !draft.trim() || creating) return;
    setCreating(true);
    const res = await createThread({
      transactionId: txId,
      subject: subject.trim(),
      body: draft.trim(),
    });
    setCreating(false);
    if (res.ok) {
      setSubject("");
      setDraft("");
      toast.push("Message sent", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  const sendReply = async (threadId: string) => {
    const trimmed = replyDraft.trim();
    if (!trimmed || replying) return;
    setReplying(true);
    const res = await sendMessage(threadId, trimmed);
    setReplying(false);
    if (res.ok) {
      setReplyDraft("");
      setActiveReplyThreadId(null);
      toast.push("Message sent", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  return (
    <PageShell width="narrow">
      <SectionTitle eyebrow="Conversations" title={`Your conversation with ${agentFirstName}`} />

      <Card className="mb-5">
        <div className="serif text-[16px] mb-1">Ask {agentFirstName} a question</div>
        <div className="text-[12.5px] text-muted mb-3.5">
          {agentName} typically replies within a few hours during business days.
        </div>
        <input
          placeholder="What's this about? (e.g. wire instructions, insurance binder)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none mb-2.5 focus:border-blue/60"
        />
        <textarea
          placeholder="Type your message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[100px] p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none resize-y focus:border-blue/60"
        />
        <div className="flex justify-end mt-3">
          <Button
            kind="primary"
            disabled={!draft.trim() || !subject.trim() || creating}
            onClick={sendNewThread}
          >
            {creating ? "Sending…" : "Send message"}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        {threads.length === 0 && (
          <Card>
            <div className="text-[13px] text-muted">
              No conversations yet. Send your first message above and {agentFirstName} will reply here.
            </div>
          </Card>
        )}

        {threads.map((thread) => {
          const last = thread.messages[thread.messages.length - 1];
          const status = statusStyles[thread.status];
          const isReplying = activeReplyThreadId === thread.threadId;
          return (
            <Card key={thread.threadId}>
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink">{thread.subject}</div>
                  <div className="text-[11.5px] text-muted mt-0.5">{thread.relatedProperty}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[11px] rounded-full px-2 py-px font-medium whitespace-nowrap"
                    style={{ background: status.bg, color: status.fg }}
                  >
                    {status.label}
                  </span>
                  <div className="text-[11px] text-muted">{fmtShort(last?.createdAt ?? "")}</div>
                </div>
              </div>

              <ThreadMessages
                thread={thread}
                agentName={agentName}
                clientName={clientFullName}
                clientInitials={clientInitials}
              />

              <div className="mt-3 pt-3 border-t border-hairline-2">
                {isReplying ? (
                  <div>
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && replyDraft.trim()) {
                          e.preventDefault();
                          void sendReply(thread.threadId);
                        }
                      }}
                      autoFocus
                      disabled={replying}
                      placeholder={`Reply to ${agentFirstName}…`}
                      className="w-full min-h-[90px] p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none resize-y focus:border-blue/60 disabled:opacity-60"
                    />
                    <div className="flex justify-end gap-2 mt-2.5">
                      <Button
                        kind="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveReplyThreadId(null);
                          setReplyDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        kind="primary"
                        size="sm"
                        disabled={!replyDraft.trim() || replying}
                        onClick={() => sendReply(thread.threadId)}
                      >
                        {replying ? "Sending…" : "Send reply"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveReplyThreadId(thread.threadId);
                      setReplyDraft("");
                    }}
                  >
                    Reply
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
};

const ThreadMessages = ({
  thread,
  agentName,
  clientName,
  clientInitials,
}: {
  thread: MessageThread;
  agentName: string;
  clientName: string;
  clientInitials: string;
}) => (
  <div className="flex flex-col gap-3">
    {thread.messages.map((msg) => {
      const isAgent = msg.senderRole === "agent";
      const displayName = isAgent ? msg.senderName || agentName : clientName;
      return (
        <div
          key={msg.id}
          className={cn(
            "flex gap-3 items-start",
            isAgent && "pl-4 ml-2 border-l border-hairline-2",
          )}
        >
          <Avatar
            name={displayName}
            initials={isAgent ? undefined : clientInitials}
            size={28}
            tone={isAgent ? "navy" : "light"}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-muted mb-0.5">
              <span className="font-medium text-charcoal">{displayName}</span>
              <span className="mx-1.5">·</span>
              {fmtShort(msg.createdAt)}
            </div>
            <div className="text-[13px] text-charcoal leading-[1.55] whitespace-pre-wrap">
              {msg.body}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

// Re-export so unused-import warnings stay quiet if a parent imports the type.
export type _MessageRef = Message;
