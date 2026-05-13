"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { MockFormModal } from "@/components/shared/MockFormModal";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { useMessagesRealtime } from "@/lib/hooks/useMessagesRealtime";
import { createThread, deleteThread } from "@/lib/actions/messages";
import { fmtShort } from "@/lib/format";

const statusStyles = {
  needs_response: { bg: "var(--status-warn-bg)", fg: "var(--status-warn-fg)", label: "Needs response" },
  resolved:       { bg: "var(--status-ok-bg)",   fg: "var(--status-ok-fg)",   label: "Resolved" },
};

export type InboxRow = {
  threadId: string;
  transactionId: string;
  subject: string;
  relatedProperty: string;
  status: "needs_response" | "resolved";
  clientName: string;
  preview: string;
  previewFromAgent: boolean;
  lastAt: string | null;
  unreadCount: number;
};

export type AgentClientOption = { value: string; label: string; txId: string };

type Props = {
  agentUserId: string;
  rows: InboxRow[];
  clientOptions: AgentClientOption[];
};

/**
 * Inbox UI shell. Receives the materialized row set from the server
 * page; mutations route through Phase-F server actions. The realtime
 * subscription refreshes the parent server component whenever a new
 * message lands so the inbox updates without polling.
 */
export const AgentMessagesClient = ({ agentUserId, rows, clientOptions }: Props) => {
  useMessagesRealtime({ kind: "inbox", userId: agentUserId });

  const [newMsgOpen, setNewMsgOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<InboxRow | null>(null);
  const toast = useToast();

  const needsResponse = rows.filter((t) => t.status === "needs_response");

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const res = await deleteThread(pendingDelete.threadId);
    if (res.ok) toast.push("Message deleted", "success");
    else        toast.push(res.error, "info");
  };

  return (
    <PageShell>
      <SectionTitle
        eyebrow="Conversations"
        title="Messages"
        right={
          <Button kind="primary" icon={<I.Plus size={14} />} onClick={() => setNewMsgOpen(true)}>
            New message
          </Button>
        }
      />

      <div className="text-[12.5px] text-muted mb-3">
        Two-way client conversations only. Internal team chat lives in your team&apos;s own tools.
      </div>

      <Card padded={false}>
        <div className="px-5 py-3 border-b border-hairline flex items-center justify-between">
          <div className="text-[13px] font-medium">
            Inbox{" "}
            <span className="text-muted font-normal">
              · {rows.length} {rows.length === 1 ? "thread" : "threads"},{" "}
              {needsResponse.length} need response
            </span>
          </div>
        </div>

        {rows.map((m, i) => {
          const s = statusStyles[m.status];
          const previewPrefix = m.previewFromAgent ? "You: " : "";
          return (
            <div
              key={m.threadId}
              className="flex gap-4 px-5 py-4 items-start hover:bg-[#FBFBFC] transition-colors"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--hairline-2)" }}
            >
              <Avatar name={m.clientName} size={36} tone="light" />

              <div className="flex-1 min-w-0">
                <Link
                  href={`/agent/messages/${m.threadId}`}
                  className="block group"
                  aria-label={`Open conversation: ${m.subject}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <div className="text-[13.5px] font-medium text-ink group-hover:text-blue transition-colors">
                        {m.subject}
                      </div>
                      <span
                        className="text-[11px] rounded-full px-2 py-px font-medium"
                        style={{ background: s.bg, color: s.fg }}
                      >
                        {s.label}
                      </span>
                      {m.unreadCount > 0 && (
                        <span
                          className="text-[10.5px] rounded-full px-1.5 py-px font-semibold"
                          style={{ background: "var(--navy)", color: "white" }}
                          title={`${m.unreadCount} unread`}
                        >
                          {m.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-muted shrink-0">
                      {m.lastAt ? fmtShort(m.lastAt) : ""}
                    </div>
                  </div>
                  <div className="text-[12.5px] text-muted mt-0.5">{m.clientName}</div>
                  <div className="text-[13px] text-charcoal mt-2 line-clamp-2 leading-[1.5]">
                    {previewPrefix && <span className="text-muted">{previewPrefix}</span>}
                    {m.preview}
                  </div>
                </Link>

                <Link
                  href={`/agent/transactions/${m.transactionId}`}
                  className="inline-flex items-center gap-1 mt-3 text-[11.5px] text-muted hover:text-blue transition-colors"
                >
                  <I.Building size={11} />
                  <span className="underline-offset-2 hover:underline">{m.relatedProperty}</span>
                </Link>
              </div>

              <div className="shrink-0 flex items-start pt-0.5">
                <RowActionsMenu
                  ariaLabel={`Manage thread: ${m.subject}`}
                  actions={[
                    { id: "open",    label: "Open conversation", icon: "Mail",
                      onSelect: () => { window.location.href = `/agent/messages/${m.threadId}`; } },
                    { id: "view-tx", label: "View transaction",  icon: "Building",
                      onSelect: () => { window.location.href = `/agent/transactions/${m.transactionId}`; } },
                    { id: "delete",  label: "Delete message",    icon: "Trash", destructive: true,
                      onSelect: () => setPendingDelete(m) },
                  ]}
                />
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            No messages in your inbox.
          </div>
        )}
      </Card>

      <MockFormModal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        title="New message"
        submitLabel="Send"
        onSubmit={async (v) => {
          if (!v.subject || !v.body || !v.clientId) return;
          const client = clientOptions.find((c) => c.value === v.clientId);
          if (!client) return;
          const res = await createThread({
            transactionId: client.txId,
            subject: v.subject,
            body: v.body,
          });
          if (res.ok) toast.push("Message sent", "success");
          else        toast.push(res.error, "info");
        }}
        fields={[
          { key: "clientId", label: "To client", type: "select",
            placeholder: "Choose a client…",
            options: clientOptions.map((c) => ({ value: c.value, label: c.label })),
          },
          { key: "subject", label: "Subject", placeholder: "Quick question about your file" },
          { key: "body",    label: "Message", type: "textarea", placeholder: "Hi — wanted to follow up on…" },
        ]}
      />

      <ConfirmDeleteModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this message?"
        body="This message will be removed from the conversation view."
        confirmLabel="Delete message"
        itemName={pendingDelete?.subject}
      />
    </PageShell>
  );
};
