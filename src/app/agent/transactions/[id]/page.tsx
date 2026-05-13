import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { I } from "@/components/ui/Icon";
import { PageShell } from "@/components/shared/PageShell";
import { TransactionTimeline } from "@/components/shared/TransactionTimeline";
import { TransactionDetailActions } from "@/components/agent/TransactionDetailActions";
import { TransactionDocumentsCard } from "@/components/agent/TransactionDocumentsCard";
import { AdvanceStageButton } from "@/components/agent/AdvanceStageButton";
import { getEnrichedTransaction, getDocumentsForTransaction } from "@/lib/supabase/queries";
import { mapTransaction } from "@/lib/supabase/transaction-shape";
import { mapDocument } from "@/lib/supabase/document-shape";
import { fmtDate, fmtShort, formatCurrency, daysFromNow } from "@/lib/format";

export default async function AgentTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enriched = await getEnrichedTransaction(id);
  if (!enriched) notFound();

  // Pull the document list in parallel with the transaction payload. Notes
  // (message threads) and per-tx task lists still come from Phase F/D paths.
  const docRows = await getDocumentsForTransaction(enriched.id);
  const docs = docRows.map(mapDocument);
  const tx = mapTransaction({ tx: enriched });

  const closingIn = daysFromNow(tx.closing) ?? 0;
  const clientEmail = enriched.client?.email ?? "client@example.com";
  const clientPhone = enriched.client?.phone ?? "(617) 555-0100";

  return (
    <PageShell>
      <div className="mb-4">
        <Link
          href="/agent/transactions"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
        >
          <span className="inline-flex rotate-180">
            <I.Right size={12} />
          </span>
          Back to transactions
        </Link>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6 mb-6">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[.14em] text-muted mb-2">
            {tx.type} · {tx.representation.replace("_", " ")}
          </div>
          <div className="serif text-[22px] md:text-[28px] tracking-[-0.01em] leading-snug">{tx.address}</div>
          <div className="text-[13px] text-muted mt-1">
            {tx.city} · {formatCurrency(tx.price)}
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <StatusBadge status={tx.status} />
            <span className="text-[12px] text-muted">
              Closing in <span className="text-charcoal font-medium">{closingIn} days</span> · {fmtDate(tx.closing)}
            </span>
          </div>
        </div>
        <TransactionDetailActions txId={tx.id} clientName={tx.clientName} />
      </div>

      {/* Stacks at mobile: timeline + docs + internal notes first, then
          client/tasks/team rail. */}
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-5">
        <div className="flex flex-col gap-5">
          <Card padded={false}>
            <CardHeader
              title="Transaction timeline"
              subtitle="Internal stage notes — only you see these"
              right={<AdvanceStageButton txId={tx.id} currentStage={tx.stageKey} />}
            />
            <div className="px-6 pt-4 pb-2">
              <TransactionTimeline tx={tx} variant="agent" />
            </div>
          </Card>

          <TransactionDocumentsCard txId={tx.id} txAddress={tx.address} docs={docs} />

          <Card padded={false}>
            <CardHeader title="Internal notes" subtitle="Compliance & operational — not shown to the client" />
            <div className="px-5 py-2">
              {tx.updates.filter((u) => !u.visible).map((u, i) => (
                <div
                  key={u.id}
                  className="py-3.5"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <div className="text-[13px] font-medium text-ink">{u.title}</div>
                  <div className="text-[12.5px] text-charcoal mt-1 leading-[1.5]">{u.body}</div>
                  <div className="text-[11px] text-muted mt-1.5">{fmtShort(u.time.split("T")[0])}</div>
                </div>
              ))}
              {tx.updates.filter((u) => !u.visible).length === 0 && (
                <div className="py-4 text-[12.5px] text-muted">No internal notes yet.</div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-3">Client</div>
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={tx.clientName} size={40} tone="light" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">{tx.clientName}</div>
                <div className="text-[12px] text-muted">Buyer · Single point of contact</div>
              </div>
            </div>
            <div className="border-t border-hairline-2 pt-3 flex flex-col gap-2 text-[13px]">
              <a className="flex items-center gap-2.5 text-charcoal">
                <I.Mail size={13} className="text-muted" />
                {clientEmail}
              </a>
              <a className="flex items-center gap-2.5 text-charcoal num">
                <I.Phone size={13} className="text-muted" />
                {clientPhone}
              </a>
            </div>
          </Card>

          <Card>
            <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-3">Tasks for this file</div>
            {tx.tasks.length === 0 ? (
              <div className="text-[12.5px] text-muted">No open tasks.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {tx.tasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full border border-hairline mt-0.5 shrink-0"
                      style={{ background: t.state === "done" ? "var(--navy)" : "transparent" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink">{t.name}</div>
                      <div className="text-[11.5px] text-muted mt-0.5">Due {fmtShort(t.due)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-3">Team</div>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex items-center gap-2.5">
                <Avatar name={tx.listingAgent ?? enriched.agent.full_name} size={26} />
                <div>
                  <div className="text-ink">{tx.listingAgent ?? enriched.agent.full_name}</div>
                  <div className="text-[11px] text-muted">Listing advisor</div>
                </div>
              </div>
              {tx.coAgent && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={tx.coAgent} size={26} tone="light" />
                  <div>
                    <div className="text-ink">{tx.coAgent}</div>
                    <div className="text-[11px] text-muted">Co-agent</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
