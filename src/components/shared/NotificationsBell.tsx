"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/Icon";
import { useNotificationsLive } from "@/lib/hooks/useNotificationsLive";
import { KIND_META, type ClientNotification } from "@/lib/supabase/notification-shape";
import { cn } from "@/lib/utils";

type Props = {
  role: "agent" | "client";
};

export const NotificationsBell = ({ role }: Props) => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, markRead } = useNotificationsLive();

  const historyHref = role === "agent" ? "/agent/notifications" : "/client/notifications";

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Clicking a notification: optimistically mark read, close the dropdown,
  // and route to the related page. Server action revalidates as backup.
  const openNotification = (n: ClientNotification) => {
    markRead(n.id);
    setOpen(false);
    router.push(n.href);
  };

  // The dropdown shows the most recent set; if all are read, show the
  // "you're caught up" state but still let the user browse history.
  const visibleSet = unreadCount > 0
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-9 h-9 rounded-lg border bg-white cursor-pointer flex items-center justify-center text-charcoal relative transition-colors",
          open ? "border-hairline bg-[#F3F4F6]" : "border-hairline hover:bg-[#FBFBFC]",
        )}
      >
        <I.Bell size={15} />
        {unreadCount > 0 && (
          <span
            className="absolute top-[7px] right-2 w-[7px] h-[7px] rounded-full border-[1.5px] border-white"
            style={{ background: "var(--brand-accent, var(--gold))" }}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          // Mobile: pin to viewport so the panel can't overflow the right edge
          // even when the bell sits inside a constrained nav cluster. Desktop
          // restores the original anchored-to-bell behavior via md: overrides.
          // Bounded height + internal-only scroll keeps the footer reachable on
          // short viewports; overscroll-contain prevents iOS bounce from
          // scrolling the page behind the open menu.
          className="fixed top-[3.5rem] right-4 md:absolute md:top-[calc(100%+8px)] md:right-0 z-30 w-[calc(100vw-2rem)] max-w-[360px] max-h-[calc(100vh-6rem)] md:max-h-none flex flex-col md:block bg-white border border-hairline rounded-[12px] overflow-hidden"
          style={{ boxShadow: "0 16px 48px -12px rgba(15,23,42,.22), 0 4px 12px rgba(15,23,42,.06)" }}
        >
          <div className="shrink-0 px-4 py-3.5 border-b border-hairline-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="serif text-[15px] text-ink">Notifications</div>
              <div className="text-[11.5px] text-muted mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : notifications.length === 0
                  ? "Nothing to show yet"
                  : "All read"}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[12px] text-blue hover:underline font-medium whitespace-nowrap"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:flex-none md:max-h-[420px]"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {unreadCount === 0 ? (
              <AllCaughtUp hasHistory={notifications.length > 0} historyHref={historyHref} onClose={() => setOpen(false)} />
            ) : (
              visibleSet.map((n, i) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  isLast={i === visibleSet.length - 1}
                  onClick={() => openNotification(n)}
                />
              ))
            )}
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-hairline-2 bg-[#FBFBFC]">
            <Link
              href={historyHref}
              onClick={() => setOpen(false)}
              className="text-[12.5px] text-blue hover:underline font-medium"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FBFBFC]",
        !isLast && "border-b border-hairline-2",
      )}
    >
      <span
        className="w-8 h-8 rounded-md inline-flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: meta.tint, color: meta.fg }}
      >
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "text-[13px] leading-[1.45] min-w-0 line-clamp-2",
              n.read ? "text-charcoal font-normal" : "text-ink font-medium",
            )}
          >
            {n.title}
          </div>
          {!n.read && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ background: "var(--brand-accent, var(--gold))" }}
              aria-label="Unread"
            />
          )}
        </div>
        {n.detail && <div className="text-[12px] text-muted mt-0.5 truncate">{n.detail}</div>}
        <div className="text-[11px] text-muted mt-1">{n.timestamp}</div>
      </div>
    </button>
  );
};

const AllCaughtUp = ({
  hasHistory,
  historyHref,
  onClose,
}: {
  hasHistory: boolean;
  historyHref: string;
  onClose: () => void;
}) => (
  <div className="px-6 py-10 text-center">
    <div
      className="w-11 h-11 rounded-full inline-flex items-center justify-center mb-3"
      style={{ background: "rgba(16,185,129,.10)" }}
    >
      <I.Check size={16} stroke={2.4} style={{ color: "#0f7a55" }} />
    </div>
    <div className="serif text-[15px] text-ink">You&apos;re all caught up.</div>
    <div className="text-[12px] text-muted mt-1 leading-[1.5]">
      {hasHistory ? (
        <>
          No new notifications.{" "}
          <Link
            href={historyHref}
            onClick={onClose}
            className="text-blue hover:underline font-medium"
          >
            View history
          </Link>
          .
        </>
      ) : (
        "When new activity happens, you'll see it here."
      )}
    </div>
  </div>
);
