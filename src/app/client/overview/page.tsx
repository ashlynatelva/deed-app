import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { PageShell } from "@/components/shared/PageShell";
import { TransactionTimeline } from "@/components/shared/TransactionTimeline";
import { ClientHero } from "@/components/client/ClientHero";
import { NextStepCard } from "@/components/client/NextStepCard";
import { ClosingReadiness } from "@/components/client/ClosingReadiness";
import { AgentContactCard } from "@/components/client/AgentContactCard";
import { ClientOverviewDocumentsCard } from "@/components/client/ClientOverviewDocumentsCard";
import { ClientWelcomeGreeting } from "@/components/client/ClientWelcomeGreeting";
import {
  getTransactionForCurrentClient,
  getEnrichedTransaction,
  getClientVisibleDocumentsForTransaction,
} from "@/lib/supabase/queries";
import { mapTransaction } from "@/lib/supabase/transaction-shape";
import { mapDocument } from "@/lib/supabase/document-shape";
import { fmtShort } from "@/lib/format";

export default async function ClientOverviewPage() {
  // RLS scopes this to the signed-in client's transaction.
  const base = await getTransactionForCurrentClient();
  if (!base) notFound();

  // Pull the full enriched payload (stages + updates + agent profile) for
  // the timeline + recent-updates rail.
  const enriched = await getEnrichedTransaction(base.id);
  if (!enriched) notFound();

  const docRows = await getClientVisibleDocumentsForTransaction(base.id);
  const docs = docRows.map(mapDocument);

  const tx = mapTransaction({ tx: enriched });
  const visibleUpdates = tx.updates.filter((u) => u.visible).slice(0, 2);

  return (
    <PageShell width="client">
      <ClientWelcomeGreeting />

      <ClientHero tx={tx} />

      {/* Two-column at desktop (timeline + side rail). Stacks at mobile
          so the timeline gets full width and the side rail (docs, agent
          contact, recent updates) appears below. */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-5">
        <div className="flex flex-col gap-5">
          <NextStepCard tx={tx} docs={docs} />

          <Card padded={false}>
            <CardHeader title="Your journey to closing" subtitle="Each step is what your lender, attorneys, and inspectors are working on behind the scenes." />
            <div className="px-6 pt-5 pb-2">
              <TransactionTimeline tx={tx} variant="client" />
            </div>
          </Card>

          {/* Client-only feature: Closing Readiness checklist */}
          <ClosingReadiness tx={tx} />
        </div>

        <div className="flex flex-col gap-4">
          <ClientOverviewDocumentsCard txId={tx.id} txAddress={tx.address} docs={docs} />

          <AgentContactCard
            agent={{
              name:  enriched.agent.full_name,
              title: enriched.agent.title ?? "Advisor",
              email: enriched.agent.email,
              phone: enriched.agent.phone ?? "—",
            }}
          />

          <Card padded={false}>
            <CardHeader
              title="Recent updates"
              right={
                <Link href="/client/updates">
                  <Button kind="ghost" size="sm">
                    All <I.Right size={11} />
                  </Button>
                </Link>
              }
            />
            <div className="py-1">
              {visibleUpdates.length === 0 ? (
                <div className="px-4 py-4 text-[12.5px] text-muted">No updates yet.</div>
              ) : (
                visibleUpdates.map((u, i, arr) => (
                  <div
                    key={u.id}
                    className="px-4 py-3.5"
                    style={{
                      borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hairline-2)",
                    }}
                  >
                    <div className="text-[13px] font-semibold">{u.title}</div>
                    <div className="text-[12.5px] text-charcoal mt-1 leading-[1.5]">{u.body}</div>
                    <div className="text-[11px] text-muted mt-1.5">
                      {fmtShort(u.time.split("T")[0])}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
