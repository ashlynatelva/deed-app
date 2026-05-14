"use client";

import * as React from "react";
import Link from "next/link";
import { I } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, StageDot } from "@/components/ui/Badges";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { EditTransactionModal } from "@/components/agent/EditTransactionModal";
import { deleteTransaction } from "@/lib/actions/transactions";
import { formatCurrency, fmtShort } from "@/lib/format";
import { STAGES } from "@/lib/mock/stages";
import type { Transaction } from "@/lib/types";

type Props = {
  rows: Transaction[];
  /**
   * Compact mode is the dashboard preview — narrower row with just
   * property + closing. Keeps the menu rendered (still need delete)
   * but in a smaller form factor.
   */
  compact?: boolean;
};

/**
 * Agent-side transaction list. Renders the same row data at three
 * surfaces — compact dashboard preview, full desktop grid, mobile card
 * stack — each with its own layout but sharing the row-actions menu so
 * delete is reachable everywhere a transaction is shown.
 *
 * Soft-delete via `deleteTransaction` (migration 0019). The action
 * routes through a SECURITY DEFINER RPC that scopes by org + ownership
 * — no client-side gating beyond hiding the menu is needed for safety,
 * but the rendered surface is itself agent-only (`/agent/*`) so clients
 * never see the menu in the first place.
 */
export const TxTable = ({ rows, compact = false }: Props) => {
  const [pendingDelete, setPendingDelete] = React.useState<Transaction | null>(null);
  const [pendingEdit, setPendingEdit] = React.useState<Transaction | null>(null);
  const toast = useToast();

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    const res = await deleteTransaction(pendingDelete.id);
    if (res.ok) {
      toast.push("Transaction removed", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  // Row-actions menu definition is identical at every breakpoint —
  // factored out so the three layouts below stay declarative.
  const buildActions = (t: Transaction) => [
    {
      id: "view",
      label: "View transaction",
      icon: "Eye" as const,
      onSelect: () => { window.location.href = `/agent/transactions/${t.id}`; },
    },
    {
      id: "edit",
      label: "Edit transaction",
      icon: "Cog" as const,
      onSelect: () => setPendingEdit(t),
    },
    {
      id: "delete",
      label: "Delete transaction",
      icon: "Trash" as const,
      destructive: true,
      onSelect: () => setPendingDelete(t),
    },
  ];

  if (compact) {
    return (
      <>
        <div>
          <div className="px-5 py-2.5 text-[10.5px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC] flex justify-between">
            <div>Property</div>
            <div>Closing</div>
          </div>
          {rows.map((t, i) => (
            <div
              key={t.id}
              className="flex gap-3.5 px-5 py-3 items-center hover:bg-[#FBFBFC] transition-colors"
              style={{
                borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--hairline-2)",
              }}
            >
              {/* `contents` makes the Link layout-transparent so the row
                  menu can sit as a sibling instead of being a nested
                  interactive element inside the Link. */}
              <Link href={`/agent/transactions/${t.id}`} className="contents">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink truncate">{t.address}</div>
                  <div className="flex gap-2.5 items-center mt-1">
                    <span className="text-[11.5px] text-muted truncate">{t.clientName}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-hairline shrink-0" />
                    <span className="text-[11.5px] text-charcoal whitespace-nowrap">
                      {STAGES.find((s) => s.key === t.stageKey)?.label}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="num text-[12.5px] text-charcoal font-medium">{fmtShort(t.closing)}</div>
                  <div className="mt-1">
                    <StatusBadge status={t.status} size="sm" />
                  </div>
                </div>
              </Link>
              <RowActionsMenu
                ariaLabel={`Manage ${t.address}`}
                actions={buildActions(t)}
              />
            </div>
          ))}
        </div>
        <DeleteModal pending={pendingDelete} onClose={() => setPendingDelete(null)} onConfirm={onConfirmDelete} />
        <EditTransactionModal
          open={!!pendingEdit}
          onClose={() => setPendingEdit(null)}
          transaction={pendingEdit ? toEditShape(pendingEdit) : null}
        />
      </>
    );
  }

  return (
    <>
      <div>
        {/* Desktop: 6-column grid (unchanged from before). Hidden at < md
            to give the mobile card view below the full width. The last
            column was a chevron — now it's the row-actions menu. */}
        <div className="hidden md:grid grid-cols-[2.4fr_1.6fr_1.4fr_1fr_1fr_40px] px-5 py-2.5 text-[11px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC]">
          <div>Property</div>
          <div>Client</div>
          <div>Stage</div>
          <div>Closing</div>
          <div>Status</div>
          <div />
        </div>
        {rows.map((t, i) => (
          <div
            key={t.id}
            className="hidden md:grid grid-cols-[2.4fr_1.6fr_1.4fr_1fr_1fr_40px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
            style={{
              borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--hairline-2)",
            }}
          >
            <Link href={`/agent/transactions/${t.id}`} className="contents">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-ink truncate">{t.address}</div>
                <div className="text-[11.5px] text-muted mt-0.5">
                  {t.city} · {formatCurrency(t.price)}
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={t.clientName} size={26} tone="light" />
                <div className="min-w-0">
                  <div className="text-[13px] text-ink truncate">{t.clientName}</div>
                  <div className="text-[11px] text-muted">{t.type.split(" · ")[0]}</div>
                </div>
              </div>
              <div>
                <StageDot label={STAGES.find((s) => s.key === t.stageKey)?.label ?? ""} />
              </div>
              <div className="num text-[13px] text-charcoal">{fmtShort(t.closing)}</div>
              <div>
                <StatusBadge status={t.status} size="sm" />
              </div>
            </Link>
            <div className="flex justify-end">
              <RowActionsMenu
                ariaLabel={`Manage ${t.address}`}
                actions={buildActions(t)}
              />
            </div>
          </div>
        ))}

        {/* Mobile cards: vertical stack of property tiles. Same row data,
            just folded onto a smaller surface. The action menu sits in
            the top-right of each card; the rest of the card is the
            navigation tap target. */}
        <div className="md:hidden">
          {rows.map((t, i) => (
            <div
              key={t.id}
              className="flex items-start gap-3 px-4 py-3.5 active:bg-[#FBFBFC] transition-colors"
              style={{
                borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--hairline-2)",
              }}
            >
              <Link
                href={`/agent/transactions/${t.id}`}
                className="flex-1 min-w-0 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink leading-snug">{t.address}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">
                      {t.city} · {formatCurrency(t.price)}
                    </div>
                  </div>
                  <StatusBadge status={t.status} size="sm" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Avatar name={t.clientName} size={22} tone="light" />
                    <div className="text-[12.5px] text-charcoal truncate">{t.clientName}</div>
                    <span className="w-[3px] h-[3px] rounded-full bg-hairline shrink-0" />
                    <div className="text-[12px] text-muted whitespace-nowrap">
                      {STAGES.find((s) => s.key === t.stageKey)?.label}
                    </div>
                  </div>
                  <div className="num text-[12px] text-charcoal whitespace-nowrap">
                    {fmtShort(t.closing)}
                  </div>
                </div>
              </Link>
              <RowActionsMenu
                ariaLabel={`Manage ${t.address}`}
                actions={buildActions(t)}
              />
            </div>
          ))}
        </div>
      </div>
      <DeleteModal pending={pendingDelete} onClose={() => setPendingDelete(null)} onConfirm={onConfirmDelete} />
    </>
  );
};

const DeleteModal = ({
  pending,
  onClose,
  onConfirm,
}: {
  pending: Transaction | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) => (
  <ConfirmDeleteModal
    open={!!pending}
    onClose={onClose}
    onConfirm={onConfirm}
    title="Delete this transaction?"
    body="This will remove the transaction from your active dashboard. Related history will be preserved for audit purposes."
    confirmLabel="Delete transaction"
    itemName={pending?.address}
  />
);

// The camelCase `Transaction` shape mapped from Supabase carries extra
// per-page fields (stages, documents, tasks…) that the edit modal
// doesn't need. This helper narrows to just the editable surface,
// keeping the modal contract tight.
const toEditShape = (t: Transaction) => ({
  id: t.id,
  address: t.address,
  city: t.city ?? null,
  price: t.price ?? null,
  representation: t.representation ?? null,
  stageKey: t.stageKey,
  status: t.status,
  closing: t.closing ?? null,
});
