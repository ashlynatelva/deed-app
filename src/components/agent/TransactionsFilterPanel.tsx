"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { StageKey, TransactionStatus } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Advanced filters popover for the agent Transactions page.
//
// The trigger button (the existing "Filter" pill in the page header) toggles
// the panel; changes apply live to the transactions list so the user sees
// results as they tick boxes. "Apply filters" doubles as a Done/Close button.
// "Clear filters" empties every section back to defaults.
//
// Status options here are the same set the tab chips above the table show.
// When a status is selected here, the chips and the table both react to it.
// The chip counts in TransactionsClient.tsx are computed off the same
// `filtered` set (minus the chip's own status), so the numbers stay
// truthful as the filter narrows the population.
//
// Stage list intentionally omits "earnest" and "closing" per the product
// brief — agents rarely filter on those, and including all nine would push
// the panel taller than its sibling page content.
// ─────────────────────────────────────────────────────────────────────────────

export type ClosingWindow = "any" | "7" | "14" | "30";

export type FilterState = {
  status: Set<TransactionStatus>;
  stage:  Set<StageKey>;
  clientType: Set<"buyer" | "seller">;
  closing: ClosingWindow;
};

export const EMPTY_FILTERS: FilterState = {
  status: new Set(),
  stage:  new Set(),
  clientType: new Set(),
  closing: "any",
};

const STATUS_OPTIONS: { key: TransactionStatus; label: string; dot: string }[] = [
  { key: "on_track",        label: "On track",        dot: "var(--status-ok-fg)" },
  { key: "needs_attention", label: "Needs attention", dot: "var(--status-warn-fg)" },
  { key: "at_risk",         label: "At risk",         dot: "var(--status-risk-fg)" },
];

const STAGE_OPTIONS: { key: StageKey; label: string }[] = [
  { key: "offer",      label: "Offer sent" },
  { key: "contract",   label: "Under contract" },
  { key: "inspection", label: "Inspection" },
  { key: "appraisal",  label: "Appraisal" },
  { key: "loan",       label: "Loan approval" },
  { key: "ctc",        label: "Clear to close" },
  { key: "walk",       label: "Final walkthrough" },
];

const CLOSING_OPTIONS: { key: ClosingWindow; label: string }[] = [
  { key: "any", label: "Any time" },
  { key: "7",   label: "Next 7 days" },
  { key: "14",  label: "Next 14 days" },
  { key: "30",  label: "Next 30 days" },
];

/** Count of dimensions with at least one active selection — used for the badge. */
export const activeFilterCount = (f: FilterState): number =>
  (f.status.size > 0 ? 1 : 0) +
  (f.stage.size  > 0 ? 1 : 0) +
  (f.clientType.size > 0 ? 1 : 0) +
  (f.closing !== "any" ? 1 : 0);

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onClear:  () => void;
};

export const TransactionsFilterPanel = ({ value, onChange, onClear }: Props) => {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — same pattern as RowActionsMenu.
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = <K extends TransactionStatus | StageKey | "buyer" | "seller">(
    bucket: "status" | "stage" | "clientType",
    key: K,
  ) => {
    const next = new Set(value[bucket] as Set<K>);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ ...value, [bucket]: next });
  };

  const setClosing = (k: ClosingWindow) => onChange({ ...value, closing: k });

  const activeCount = activeFilterCount(value);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <Button
        kind="secondary"
        icon={<I.Filter size={14} />}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Filter
        {activeCount > 0 && (
          <span
            className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold"
            style={{ background: "var(--navy)", color: "white" }}
          >
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter transactions"
          // Mobile: anchor to viewport so the 340px panel can't push off the
          // right edge of a narrow phone. Desktop keeps the original
          // `right-0` anchor to the trigger.
          className="fixed top-[3.5rem] right-4 md:absolute md:top-[calc(100%+6px)] md:right-0 z-30 w-[calc(100vw-2rem)] max-w-[340px] md:w-[340px] bg-white border border-hairline rounded-[12px] overflow-hidden"
          style={{ boxShadow: "0 24px 56px -16px rgba(15,23,42,.22), 0 4px 14px rgba(15,23,42,.06)" }}
        >
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4 flex flex-col gap-5">
            <Section title="Status">
              <div className="flex flex-col gap-1.5">
                {STATUS_OPTIONS.map((o) => (
                  <CheckRow
                    key={o.key}
                    checked={value.status.has(o.key)}
                    onChange={() => toggle("status", o.key)}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: o.dot }} />
                        {o.label}
                      </span>
                    }
                  />
                ))}
              </div>
            </Section>

            <Section title="Stage">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {STAGE_OPTIONS.map((o) => (
                  <CheckRow
                    key={o.key}
                    checked={value.stage.has(o.key)}
                    onChange={() => toggle("stage", o.key)}
                    label={o.label}
                  />
                ))}
              </div>
            </Section>

            <Section title="Client type">
              <div className="flex gap-2">
                <CheckRow
                  checked={value.clientType.has("buyer")}
                  onChange={() => toggle("clientType", "buyer")}
                  label="Buyer"
                />
                <CheckRow
                  checked={value.clientType.has("seller")}
                  onChange={() => toggle("clientType", "seller")}
                  label="Seller"
                />
              </div>
            </Section>

            <Section title="Closing date">
              <div className="flex flex-col gap-1.5">
                {CLOSING_OPTIONS.map((o) => (
                  <RadioRow
                    key={o.key}
                    name="closing-window"
                    checked={value.closing === o.key}
                    onChange={() => setClosing(o.key)}
                    label={o.label}
                  />
                ))}
              </div>
            </Section>
          </div>

          <div className="px-4 py-3 border-t border-hairline-2 flex items-center justify-between gap-2 bg-[#FBFBFC]">
            <Button kind="ghost" size="sm" onClick={onClear} disabled={activeCount === 0}>
              Clear filters
            </Button>
            <Button kind="primary" size="sm" onClick={() => setOpen(false)}>
              Apply filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── primitives ─────────────────────────────────────────────────────────────

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10.5px] uppercase tracking-[.1em] text-muted font-medium mb-2">
      {title}
    </div>
    {children}
  </div>
);

const CheckRow = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) => (
  <label
    className={cn(
      "flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
      "hover:bg-[#F3F4F6]",
    )}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 accent-navy cursor-pointer"
    />
    <span className="text-[13px] text-ink">{label}</span>
  </label>
);

const RadioRow = ({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) => (
  <label
    className={cn(
      "flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
      "hover:bg-[#F3F4F6]",
    )}
  >
    <input
      type="radio"
      name={name}
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 accent-navy cursor-pointer"
    />
    <span className="text-[13px] text-ink">{label}</span>
  </label>
);
