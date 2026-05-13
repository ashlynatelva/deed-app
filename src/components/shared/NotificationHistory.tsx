"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { useNotificationsLive } from "@/lib/hooks/useNotificationsLive";
import {
  KIND_META,
  RELATED_AREA,
  type ClientNotification,
} from "@/lib/supabase/notification-shape";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Full notification history view, shared by /agent/notifications and
// /client/notifications. Backed by the live Supabase notifications channel
// via `useNotificationsLive` — new notifications appear without refresh.
// ─────────────────────────────────────────────────────────────────────────────

type Filter = "all" | "unread" | "read";

export const NotificationHistory = ({ role }: { role: "agent" | "client" }) => {
  const router = useRouter();
  // Pull a larger window for history than the bell uses by default.
  const { notifications, unreadCount, markAllRead, markRead } = useNotificationsLive(100);
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("all");

  const filtered = React.useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (filter === "read")   return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, filter]);

  const handleRowClick = (n: ClientNotification) => {
    markRead(n.id);
    router.push(n.href);
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all",    label: "All",    count: notifications.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "read",   label: "Read",   count: notifications.length - unreadCount },
  ];

  return (
    <PageShell width="narrow">
      <SectionTitle
        eyebrow="Activity"
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <Button
              kind="secondary"
              icon={<I.Check size={13} stroke={2.4} />}
              onClick={() => {
                markAllRead();
                toast.push("All notifications marked as read.", "success");
              }}
            >
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <div className="text-[12.5px] text-muted mb-3">
        Every event from your {role === "agent" ? "transactions and clients" : "advisor"}. Click any
        notification to jump to the related page.
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-white border border-hairline rounded-[10px] w-fit">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3.5 py-1.5 text-[12.5px] font-medium rounded-[7px] inline-flex items-center gap-1.5 transition-colors",
              filter === f.id ? "bg-navy text-white" : "text-charcoal hover:bg-[#F3F4F6]",
            )}
          >
            {f.label}
            <span className="text-[11px] opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filtered.map((n, i) => (
            <NotificationRow
              key={n.id}
              n={n}
              isLast={i === filtered.length - 1}
              onClick={() => handleRowClick(n)}
            />
          ))
        )}
      </Card>
    </PageShell>
  );
};

// ─── Row ────────────────────────────────────────────────────────────────────

const NotificationRow = ({
  n,
  isLast,
  onClick,
}: {
  n: ClientNotification;
  isLast: boolean;
  onClick: () => void;
}) => {
  const meta = KIND_META[n.kind];
  const Icon = I[meta.icon];
  const areaLabel = RELATED_AREA[n.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-[#FBFBFC]",
        !isLast && "border-b border-hairline-2",
      )}
    >
      <span
        className="w-9 h-9 rounded-md inline-flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: meta.tint, color: meta.fg }}
      >
        <Icon size={15} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className={cn(
                "text-[13.5px] leading-[1.4]",
                n.read ? "text-charcoal font-normal" : "text-ink font-semibold",
              )}
            >
              {n.title}
            </div>
            {n.detail && (
              <div className="text-[12.5px] text-muted mt-0.5 leading-[1.5]">{n.detail}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted">
              <span
                className="inline-flex items-center px-1.5 py-px rounded-full font-medium uppercase tracking-[.04em] text-[10px]"
                style={{ background: meta.tint, color: meta.fg }}
              >
                {areaLabel}
              </span>
              <span className="w-1 h-1 rounded-full bg-hairline" />
              <span>{n.timestamp}</span>
            </div>
          </div>
          {!n.read && (
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-1.5"
              style={{ background: "var(--brand-accent, var(--gold))" }}
              aria-label="Unread"
            />
          )}
        </div>
      </div>
    </button>
  );
};

// ─── Empty state ────────────────────────────────────────────────────────────

const EmptyState = ({ filter }: { filter: Filter }) => (
  <div className="px-6 py-12 text-center">
    <div
      className="w-11 h-11 rounded-full inline-flex items-center justify-center mb-3"
      style={{ background: "rgba(16,185,129,.10)" }}
    >
      <I.Check size={16} stroke={2.4} style={{ color: "#0f7a55" }} />
    </div>
    <div className="serif text-[16px] text-ink">
      {filter === "unread" ? "You're all caught up." :
       filter === "read"   ? "Nothing read yet." :
       "No notifications yet."}
    </div>
    <div className="text-[12.5px] text-muted mt-1 leading-[1.5] max-w-[360px] mx-auto">
      {filter === "unread"
        ? "When new activity happens, it'll appear here."
        : filter === "read"
        ? "Notifications you've opened will show up here."
        : "When new activity happens — uploads, messages, deadlines — it'll appear here."}
    </div>
  </div>
);
