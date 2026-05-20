"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createTransaction } from "@/lib/actions/transactions";
import { STAGES } from "@/lib/mock/stages";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * New-transaction creation form. The visual design intentionally mirrors
 * the old `MockFormModal` two-column layout the dashboard + transactions
 * pages already used — same field styling, same spacing, same Cancel /
 * primary-button footer — so nothing on the page shifts when the modal
 * goes from mock to real.
 *
 * Behavior differences from the mock:
 *   - Submit is async (busy state on the primary button while the
 *     server action runs).
 *   - Errors surface inline above the footer rather than as a toast,
 *     so the user can fix the field and re-submit without losing
 *     context.
 *   - On success: toast + router.refresh() (the server action also
 *     revalidates the dashboard / transactions / clients pages, so the
 *     new row appears without a manual reload).
 *
 * `client_id` is intentionally NOT a form field — every new transaction
 * starts unlinked, and the Phase H invite flow attaches the client on
 * acceptance.
 */
// Derive stage options from the single source of truth in
// lib/mock/stages.ts so adding/renaming a stage doesn't drift across
// files.
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

// Phase N — primary workflow signal. Buyer/seller use Sale price;
// tenant variants use Rental price. The DB trigger also seeds
// different stage arrays based on this.
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

export const NewTransactionModal = ({ open, onClose }: Props) => {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset every time the modal opens. Render-time check rather than an
  // effect so React Compiler doesn't flag a cascading setState.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(EMPTY_DRAFT);
      setSubmitting(false);
      setError(null);
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const canSubmit = !!draft.address.trim() && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const res = await createTransaction({
      address: draft.address,
      city: draft.city,
      clientType: draft.clientType,
      // Server-side, only the price field matching the clientType is
      // persisted; sending both is harmless but we send only the
      // relevant one for clarity in network inspection.
      price: isLeasing(draft.clientType) ? "" : draft.price,
      rentalPrice: isLeasing(draft.clientType) ? draft.rentalPrice : "",
      representation: draft.representation,
      stageKey: draft.stageKey,
      status: draft.status,
      closing: draft.closing,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.push(`Transaction created for ${draft.address.trim()}.`, "success");
    // The server action already revalidated; this triggers an immediate
    // server-component re-render so the new row appears the moment the
    // modal closes.
    router.refresh();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="New transaction"
      subtitle="Creates a new transaction on your pipeline. Attach a client later via the invite flow."
      size="lg"
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button kind="primary" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create transaction"}
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
