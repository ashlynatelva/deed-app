import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KPI } from "@/components/ui/KPI";
import { I } from "@/components/ui/Icon";
import { PageShell } from "@/components/shared/PageShell";
import { TxTable } from "@/components/agent/TxTable";
import { DashboardHeaderActions } from "@/components/agent/DashboardHeaderActions";
import { AgentDashboardGreeting } from "@/components/agent/AgentDashboardGreeting";
import {
  getTransactionsForCurrentAgent,
  getNotificationsForCurrentUser,
  getUpcomingDeadlinesForCurrentAgent,
} from "@/lib/supabase/queries";
import { mapTransactionRow } from "@/lib/supabase/transaction-shape";
import { mapNotification, KIND_META } from "@/lib/supabase/notification-shape";
import { createClient } from "@/lib/supabase/server";
import { daysFromNow } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

export default async function AgentDashboardPage() {
  const supabase = await createClient();

  // Transactions for the signed-in agent. RLS scopes the row set.
  const txRows = await getTransactionsForCurrentAgent();

  // Batch-fetch client profile names so each row in TxTable can render
  // a real client name instead of "Client (invite pending)" fallback.
  const clientIds = Array.from(
    new Set(txRows.map((t) => t.client_id).filter((v): v is string => Boolean(v))),
  );
  let clientById = new Map<string, Tables<"profiles">>();
  if (clientIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", clientIds);
    clientById = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  const txs = txRows.map((tx) =>
    mapTransactionRow({ tx, client: clientById.get(tx.client_id ?? "") ?? null }),
  );

  // "Documents needed" — single count query against the documents table.
  // RLS scopes to docs on the agent's transactions; we filter by status here
  // so the round trip returns just a number, not row data.
  const { count: docsNeededCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("status", "needed");

  // "Recent activity" — most recent notifications addressed to the agent.
  // The dashboard renders the 5 newest; the bell + history page render
  // the full list. Triggers fan-out new rows from message + stage events,
  // so this stays in sync without any code-side bookkeeping.
  const notificationRows = await getNotificationsForCurrentUser(5);
  const recentActivity = notificationRows.map((r) => mapNotification(r, "agent"));

  // Upcoming deadlines — closings, non-done stage due dates, and open
  // tasks all surface here, unioned and sorted, capped at 5.
  const upcoming = await getUpcomingDeadlinesForCurrentAgent(14, 5);

  const active = txs.length;
  const docsNeeded = docsNeededCount ?? 0;
  const upcomingDeadlines = upcoming.length;
  const atRisk = txs.filter((t) => t.status === "at_risk").length;

  // Derived metrics for the hero sentence + KPI hints. All computed
  // from the already-fetched, RLS-scoped row set — no extra round
  // trips, no hard-coded fallbacks.
  const needsAttentionCount =
    atRisk +
    txs.filter((t) => t.status === "needs_attention").length +
    docsNeeded;
  const closingsSoonCount = txs.filter((t) => {
    const d = daysFromNow(t.closing);
    return d !== null && d >= 0 && d <= 14;
  }).length;
  // Distinct YYYY-MM buckets across the agent's active transactions —
  // powers the "Across N closing months" hint on the Active KPI.
  const closingMonthsCount = new Set(
    txs
      .map((t) => (t.closing ?? "").slice(0, 7))
      .filter((m) => m.length === 7),
  ).size;

  // Zero state: a brand-new agent who has never created a transaction
  // sees every KPI at 0. We surface a calm "all caught up" hero
  // instead of the dynamic count sentence, plus a nudge to create
  // their first transaction.
  const allCountsZero =
    active === 0 && docsNeeded === 0 && upcomingDeadlines === 0 && atRisk === 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <PageShell>
      {/* Header: greeting + actions. Stacks vertically at mobile so the
          action buttons get full width without crowding the greeting;
          desktop keeps the original side-by-side layout. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6 md:mb-7">
        <div>
          <div className="text-[11px] uppercase tracking-[.14em] text-muted mb-2">{today}</div>
          <AgentDashboardGreeting />
          {allCountsZero ? (
            <div className="mt-1.5">
              <div className="text-ink text-[14px]">You&apos;re all caught up.</div>
              <div className="text-muted text-[13px] mt-0.5">
                Start your first transaction to begin tracking activity.
              </div>
            </div>
          ) : (
            <div className="text-muted mt-1.5 text-[14px]">
              You have{" "}
              <span className="text-ink font-medium">
                {needsAttentionCount} {needsAttentionCount === 1 ? "item" : "items"}
              </span>{" "}
              needing attention this week and{" "}
              <span className="text-ink font-medium">
                {closingsSoonCount} {closingsSoonCount === 1 ? "closing" : "closings"}
              </span>{" "}
              in the next 14 days.
            </div>
          )}
        </div>
        <DashboardHeaderActions />
      </div>

      {/* KPIs: 2x2 at mobile, 1x4 at desktop. Hints describe what the
          number means in context — most are static descriptions, but
          the Active-transactions hint is dynamically computed from the
          set of distinct closing months in the agent's pipeline. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <KPI
          label="Active transactions"
          value={active}
          hint={
            closingMonthsCount === 0
              ? "No active deals yet"
              : `Across ${closingMonthsCount} closing ${closingMonthsCount === 1 ? "month" : "months"}`
          }
          accent
        />
        <KPI label="Documents needed"    value={docsNeeded} hint="Awaiting client or third party" />
        <KPI label="Upcoming deadlines"  value={upcomingDeadlines} hint="In the next 14 days" tone="warn" />
        <KPI label="At-risk deals"       value={atRisk} hint="Lender or contingency issues" tone="risk" />
      </div>

      {/* 2-col layout stacks at mobile so the active-transactions
          table gets full width, then upcoming deadlines + recent
          activity render below. */}
      <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-5">
        <Card padded={false}>
          <CardHeader
            title="Active transactions"
            subtitle="Overdue & at-risk surfaced first"
            right={
              <Link href="/agent/transactions">
                <Button kind="ghost" size="sm">
                  View all <I.Right size={12} />
                </Button>
              </Link>
            }
          />
          <TxTable rows={txs} compact />
        </Card>

        <div className="flex flex-col gap-5">
          <Card padded={false}>
            <CardHeader title="Upcoming deadlines" subtitle="Next 14 days" />
            <div className="px-5 pb-3 pt-1">
              {upcoming.length === 0 && (
                <div className="py-6 text-[12.5px] text-muted text-center">
                  Nothing due in the next 14 days.
                </div>
              )}
              {upcoming.map((u, i) => {
                const days = daysFromNow(u.date) ?? 0;
                const tone =
                  days <= 3 ? "var(--status-risk-fg)" : days <= 7 ? "var(--status-warn-fg)" : "var(--charcoal)";
                const dateObj = new Date(u.date + "T12:00:00");
                return (
                  <div
                    key={u.id}
                    className="flex gap-3.5 items-center py-3"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline-2)",
                    }}
                  >
                    <div className="w-11 text-center">
                      <div className="serif num text-[18px] leading-none" style={{ color: tone }}>
                        {dateObj.toLocaleDateString("en-US", { day: "numeric" })}
                      </div>
                      <div className="text-[10px] uppercase tracking-[.1em] text-muted mt-1">
                        {dateObj.toLocaleDateString("en-US", { month: "short" })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink font-medium truncate">{u.label}</div>
                      <div className="text-[12px] text-muted mt-0.5">{u.who}</div>
                    </div>
                    <div className="text-[11px] text-muted">
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padded={false}>
            <CardHeader title="Recent activity" subtitle="From your transactions and clients" />
            <div className="px-5 pb-3 pt-1">
              {recentActivity.length === 0 && (
                <div className="py-6 text-[12.5px] text-muted text-center">
                  No recent activity yet.
                </div>
              )}
              {recentActivity.map((a, i) => {
                const meta = KIND_META[a.kind];
                const Icon = I[meta.icon];
                return (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="py-3 flex gap-3 items-start hover:bg-[#FBFBFC] -mx-5 px-5 transition-colors"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline-2)",
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-md inline-flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: meta.tint, color: meta.fg }}
                    >
                      <Icon size={13} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink leading-[1.4]">
                        <span className={a.read ? "font-normal" : "font-medium"}>{a.title}</span>
                      </div>
                      {a.detail && (
                        <div className="text-[11.5px] text-muted mt-0.5 truncate">{a.detail}</div>
                      )}
                      <div className="text-[11px] text-muted mt-1">{a.timestamp}</div>
                    </div>
                    {!a.read && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                        style={{ background: "var(--brand-accent, var(--gold))" }}
                        aria-label="Unread"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
