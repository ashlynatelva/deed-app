"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { PageShell } from "@/components/shared/PageShell";
import { TxTable } from "@/components/agent/TxTable";
import { NewTransactionModal } from "@/components/agent/NewTransactionModal";
import {
  TransactionsFilterPanel,
  EMPTY_FILTERS,
  type FilterState,
} from "@/components/agent/TransactionsFilterPanel";
import type { Transaction, TransactionStatus } from "@/lib/types";
import { daysFromNow } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | TransactionStatus;

/**
 * Client-side wrapper around the agent transactions table.
 *
 * Why split: filter chips + "New transaction" modal need client state, but
 * the row data comes from Supabase via the parent server component. Keeping
 * the data fetch on the server side lets RLS scope the rows and avoids
 * shipping the Supabase client for a list view.
 *
 * Filtering layers (in evaluation order):
 *   1. Panel filters — stage / clientType / closing-window dimensions from
 *      the popover, plus the panel's own status checkbox set.
 *   2. The horizontal status tab chip (`all` / `on_track` / `needs_attention`
 *      / `at_risk`) sitting above the table.
 *
 * The tab counts shown next to each chip reflect step 1's output, so the
 * numbers stay truthful as the panel narrows the population — e.g. if the
 * agent picks "stage = Inspection", every chip shows the count of inspection
 * tx broken down by status.
 */
export const TransactionsClient = ({ rows: all }: { rows: Transaction[] }) => {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [panel, setPanel] = React.useState<FilterState>(EMPTY_FILTERS);
  const [newTxOpen, setNewTxOpen] = React.useState(false);

  // Apply only the panel filters here. The tab chip is layered on after,
  // so we can compute per-chip counts off this intermediate set.
  const panelFiltered = React.useMemo(
    () => all.filter((t) => matchesPanel(t, panel)),
    [all, panel],
  );

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all",             label: "All",             count: panelFiltered.length },
    { id: "on_track",        label: "On track",        count: panelFiltered.filter((t) => t.status === "on_track").length },
    { id: "needs_attention", label: "Needs attention", count: panelFiltered.filter((t) => t.status === "needs_attention").length },
    { id: "at_risk",         label: "At risk",         count: panelFiltered.filter((t) => t.status === "at_risk").length },
  ];

  const rows = filter === "all"
    ? panelFiltered
    : panelFiltered.filter((t) => t.status === filter);

  return (
    <PageShell>
      <SectionTitle
        eyebrow="Pipeline"
        title="Transactions"
        right={
          <div className="flex gap-2">
            <TransactionsFilterPanel
              value={panel}
              onChange={setPanel}
              onClear={() => setPanel(EMPTY_FILTERS)}
            />
            <Button kind="primary" icon={<I.Plus size={14} />} onClick={() => setNewTxOpen(true)}>
              New transaction
            </Button>
          </div>
        }
      />

      {/* Filter chip strip. Horizontally scrollable at mobile if it
          overflows; container is sized to content at desktop. */}
      <div className="flex gap-1 mb-4 p-1 bg-white border border-hairline rounded-[10px] w-fit max-w-full overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3.5 py-1.5 text-[12.5px] font-medium rounded-[7px] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap",
              filter === f.id ? "bg-navy text-white" : "text-charcoal hover:bg-[#F3F4F6]",
            )}
          >
            {f.label}
            <span className="text-[11px] opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            No transactions match the current filters.
          </div>
        ) : (
          <TxTable rows={rows} />
        )}
      </Card>

      <NewTransactionModal open={newTxOpen} onClose={() => setNewTxOpen(false)} />
    </PageShell>
  );
};

// ─── filter predicate ───────────────────────────────────────────────────────

/**
 * Apply every dimension in `FilterState` to a single transaction.
 * Each section is independent: an empty Set (or `closing: "any"`) means
 * "no constraint on this dimension". Returns true iff the tx passes every
 * active constraint.
 */
function matchesPanel(tx: Transaction, f: FilterState): boolean {
  if (f.status.size > 0 && !f.status.has(tx.status)) return false;
  if (f.stage.size  > 0 && !f.stage.has(tx.stageKey)) return false;

  if (f.clientType.size > 0) {
    const side: "buyer" | "seller" = tx.representation.startsWith("buyer")
      ? "buyer"
      : "seller";
    if (!f.clientType.has(side)) return false;
  }

  if (f.closing !== "any") {
    const days = daysFromNow(tx.closing);
    const cap = Number(f.closing);
    if (days === null || days < 0 || days > cap) return false;
  }

  return true;
}
