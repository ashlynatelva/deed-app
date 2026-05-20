"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateTransaction } from "@/lib/actions/transactions";
import { STAGES } from "@/lib/mock/stages";

type Props = {
  open: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    address: string;
    city: string | null;
    /** Sale price in whole dollars; null when no price or leasing. */
    price: number | null;
    /** Phase N — monthly rent in whole dollars; null for sale workflows. */
    rentalPrice?: number | null;
    representation: string | null;
    /** Phase N — workflow signal. */
    clientType?: string | null;
    stageKey: string;
    status: string;
    /** YYYY-MM-DD or null. */
    closing: string | null;
  } | null;
};

// Stage list comes from the canonical STAGES so adding/renaming flows
// through automatically.
const STAGE_OPTIONS = STAGES.map((s) => ({ value: s.key, label: s.label }));

const STATUS_OPTIONS = [
  { value: "on_track",        label: "On track" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "at_risk",         label: "At risk" },
];

const REPRESENTATION_OPTIONS = [
  { value: "buyer_client",    label: "Buyer · Client" },
  { value: "buyer_customer",  label: "Buyer · Customer" },
  { value: "seller_client",   label: "Seller · Client" },
  { value: "seller_customer", label: "Seller · Customer" },
];

// Phase N — keep aligned with CLIENT_TYPE_OPTIONS in NewTransactionModal.
const CLIENT_TYPE_OPTIONS = [
  { value: "buyer",              label: "Buyer" },
  { value: "seller",             label: "Seller" },
  { value: "residential_tenant", label: "Residential tenant" },
  { value: "commercial_tenant",  label: "Commercial tenant" },
];

const isLeasing = (clientType: string): boolean =>
  clientType === "residential_tenant" || clientType === "commercial_tenant";

type Draft = {
  address: string;
  city: string;
  clientType: string;
  representation: string;
  price: string;
  rentalPrice: string;
  closing: string;
  stageKey: string;
  status: string;
};

const EMPTY_DRAFT: Draft = {
  address: "",
  city: "",
  clientType: "buyer",
  representation: "",
  price: "",
  rentalPrice: "",
  closing: "",
  stageKey: "offer",
  status: "on_track",
};

const fmtPrice = (n: number | null): string =>
  n === null || n === undefined ? "" : `$${n.toLocaleString("en-US")}`;

/**
 * Edit-transaction modal. Visually a mirror of NewTransactionModal so
 * the create / edit experience is identical — same field order, same
 * grid, same Cancel / primary footer. Backed by the `updateTransaction`
 * server action (direct RLS UPDATE; no SECURITY DEFINER RPC needed
 * because the transactions table's RLS already permits owner / admin
 * writes).
 *
 * Soft-deleted transactions can't reach this modal — the kebab menu
 * doesn't render on them (rows are filtered out by `is("deleted_at",
 * null)`) and the server action also enforces it.
 *
 * After save: toast + router.refresh() picks up the new server state.
 * Sidebar KPIs update live via the existing `useAgentKpiSummary`
 * realtime channel (postgres_changes on transactions).
 */
export const EditTransactionModal = ({ open, onClose, transaction }: Props) => {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed the draft each time the modal opens with a different
  // transaction. Render-time check rather than effect so the React
  // Compiler doesn't flag a cascading setState.
  const [lastTxId, setLastTxId] = React.useState<string | null>(null);
  if (open && transaction && transaction.id !== lastTxId) {
    setLastTxId(transaction.id);
    setDraft({
      address: transaction.address ?? "",
      city: transaction.city ?? "",
      clientType: transaction.clientType ?? "buyer",
      representation: transaction.representation ?? "",
      price: fmtPrice(transaction.price),
      rentalPrice: fmtPrice(transaction.rentalPrice ?? null),
      closing: transaction.closing ?? "",
      stageKey: transaction.stageKey ?? "offer",
      status: transaction.status ?? "on_track",
    });
    setError(null);
    setSubmitting(false);
  }
  if (!open && lastTxId !== null) {
    setLastTxId(null);
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  // Validation — same gates the server action enforces, surfaced
  // synchronously so the user can fix the input without a round trip.
  const validate = (): string | null => {
    if (!draft.address.trim()) return "Property address is required.";
    const priceField = isLeasing(draft.clientType) ? draft.rentalPrice : draft.price;
    if (priceField.trim()) {
      const cleaned = priceField.replace(/[^0-9.]/g, "");
      if (!cleaned || !Number.isFinite(Number(cleaned))) {
        return "Price must be a number.";
      }
    }
    if (draft.closing.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(draft.closing.trim())) {
      return "Closing date must be a valid date.";
    }
    return null;
  };

  const canSubmit = !!transaction && !submitting;

  const submit = async () => {
    if (!canSubmit || !transaction) return;
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    // Whichever price field doesn't apply to the current client type
    // gets explicitly cleared to keep the row consistent (e.g. flipping
    // a tx from buyer to residential_tenant null-outs the sale price).
    const res = await updateTransaction(transaction.id, {
      address: draft.address,
      city: draft.city,
      clientType: draft.clientType,
      price: isLeasing(draft.clientType) ? "" : draft.price,
      rentalPrice: isLeasing(draft.clientType) ? draft.rentalPrice : "",
      representation: isLeasing(draft.clientType) ? "" : draft.representation,
      stageKey: draft.stageKey,
      status: draft.status,
      closing: draft.closing,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.push("Transaction updated.", "success");
    router.refresh();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Edit transaction"
      subtitle="Update any detail on this transaction. Deleted transactions can't be edited."
      size="lg"
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button kind="primary" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Property address" full>
          <input
            autoFocus
            value={draft.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="412 Linden Crescent"
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          />
        </Field>

        <Field label="City / state / ZIP">
          <input
            value={draft.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Brookline, MA 02446"
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          />
        </Field>

        <Field label="Client type">
          <select
            value={draft.clientType}
            onChange={(e) => set("clientType", e.target.value)}
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          >
            {CLIENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Representation">
          <select
            value={draft.representation}
            onChange={(e) => set("representation", e.target.value)}
            disabled={submitting || isLeasing(draft.clientType)}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          >
            <option value="">
              {isLeasing(draft.clientType) ? "—" : "Choose representation…"}
            </option>
            {REPRESENTATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {isLeasing(draft.clientType) ? (
          <Field label="Rental price (monthly)">
            <input
              value={draft.rentalPrice}
              onChange={(e) => set("rentalPrice", e.target.value)}
              placeholder="$4,500"
              disabled={submitting}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </Field>
        ) : (
          <Field label="Sale price">
            <input
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="$1,295,000"
              disabled={submitting}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
            />
          </Field>
        )}

        <Field label="Target closing">
          <input
            type="date"
            value={draft.closing}
            onChange={(e) => set("closing", e.target.value)}
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          />
        </Field>

        <Field label="Stage">
          <select
            value={draft.stageKey}
            onChange={(e) => set("stageKey", e.target.value)}
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select
            value={draft.status}
            onChange={(e) => set("status", e.target.value)}
            disabled={submitting}
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {error && (
          <div
            role="alert"
            className="col-span-2 text-[12.5px] rounded-lg px-3 py-2 leading-[1.5]"
            style={{
              background: "var(--status-risk-bg)",
              color: "var(--status-risk-fg)",
              border: "1px solid var(--status-risk-bg)",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

const Field = ({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) => (
  <label className={`block ${full ? "col-span-2" : "col-span-1"}`}>
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    {children}
  </label>
);
