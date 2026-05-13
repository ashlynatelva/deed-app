import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { PageShell } from "@/components/shared/PageShell";
import { getTransactionForCurrentClient, getEnrichedTransaction } from "@/lib/supabase/queries";
import { mapTransaction } from "@/lib/supabase/transaction-shape";
import { fmtDate } from "@/lib/format";

export default async function ClientUpdatesPage() {
  const base = await getTransactionForCurrentClient();
  if (!base) notFound();

  const enriched = await getEnrichedTransaction(base.id);
  if (!enriched) notFound();

  const tx = mapTransaction({ tx: enriched });
  // Only client-visible updates — internal compliance notes are filtered out.
  const updates = tx.updates.filter((u) => u.visible);

  return (
    <PageShell width="narrow">
      <SectionTitle eyebrow="From your advisor" title="Updates" />

      {updates.length === 0 ? (
        <Card>
          <div className="text-[13px] text-muted">No updates yet. Avery will post here as your transaction progresses.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {updates.map((u) => (
            <Card key={u.id} className="flex gap-3.5 items-start">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--brand-accent-soft, rgba(201,168,76,.12))" }}
              >
                <I.Bell size={14} style={{ color: "var(--brand-accent, #8a7426)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink">{u.title}</div>
                <div className="text-[13px] text-charcoal mt-1 leading-[1.55]">{u.body}</div>
                <div className="text-[11.5px] text-muted mt-2">{fmtDate(u.time.split("T")[0])}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
