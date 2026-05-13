import * as React from "react";
import { Card } from "@/components/ui/Card";
import { I } from "@/components/ui/Icon";
import type { Transaction } from "@/lib/types";

type ItemStatus = "done" | "pending" | "action";

type Item = {
  id: string;
  label: string;
  status: ItemStatus;
  actionNote?: string;
};

const Bullet = ({ status }: { status: ItemStatus }) => {
  if (status === "done") {
    return (
      <span
        className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: "rgba(16,185,129,.10)" }}
      >
        <I.Check size={11} stroke={2.4} style={{ color: "#0f7a55" }} />
      </span>
    );
  }
  if (status === "action") {
    return (
      <span
        className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0"
        style={{
          background: "rgba(217,119,6,.10)",
          border: "1px solid rgba(217,119,6,.30)",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(180,99,5,.85)" }} />
      </span>
    );
  }
  return (
    <span
      className="w-5 h-5 rounded-full bg-white inline-flex items-center justify-center shrink-0"
      style={{ border: "1.5px solid var(--hairline)" }}
    />
  );
};

const StatusTag = ({ status }: { status: ItemStatus }) => {
  if (status === "done") {
    return (
      <span
        className="text-[11px] py-0.5 px-2 rounded-full font-medium whitespace-nowrap"
        style={{ background: "rgba(16,185,129,.08)", color: "#0f7a55" }}
      >
        Completed
      </span>
    );
  }
  if (status === "action") {
    return (
      <span
        className="text-[11px] py-0.5 px-2 rounded-full font-medium whitespace-nowrap"
        style={{ background: "rgba(217,119,6,.10)", color: "#8a5a08" }}
      >
        Action needed
      </span>
    );
  }
  return <span className="text-[11px] text-muted whitespace-nowrap">Pending</span>;
};

export const ClosingReadiness = ({ tx }: { tx: Transaction }) => {
  const s = tx.stages || {};
  const isDone = (k: keyof typeof s) => s[k]?.state === "done";
  const insurDone =
    tx.documents?.some((d) => /insurance/i.test(d.name) && (d.status === "reviewed" || d.status === "submitted")) ?? false;

  const items: Item[] = [
    { id: "psa",   label: "Purchase agreement received",   status: isDone("contract")   ? "done" : "pending" },
    { id: "em",    label: "Earnest money confirmed",        status: isDone("earnest")    ? "done" : "pending" },
    { id: "ins",   label: "Insurance binder uploaded",      status: insurDone            ? "done" : "pending" },
    { id: "insp",  label: "Inspection completed",           status: isDone("inspection") ? "done" : "pending" },
    { id: "apprz", label: "Appraisal completed",            status: isDone("appraisal")  ? "done" : "pending" },
    { id: "loan",  label: "Loan approval pending",          status: isDone("loan")       ? "done" : "pending" },
    { id: "wire",  label: "Wire instructions pending",      status: "action", actionNote: "Upload wire confirmation before May 18." },
    { id: "pkg",   label: "Final closing package pending",  status: isDone("closing")    ? "done" : "pending" },
  ];

  const done = items.filter((i) => i.status === "done").length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);
  const actionItem = items.find((i) => i.status === "action");

  return (
    <Card padded={false}>
      <div className="px-6 pt-5 pb-4 border-b border-hairline-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="serif text-[19px] tracking-[-0.01em]">On your way to closing</div>
            <div className="text-[12.5px] text-muted mt-1 leading-[1.5] max-w-[460px]">
              A calm view of what&apos;s done — and what&apos;s left — before the keys are in your hand.
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="num serif text-[22px] text-ink tracking-[-0.01em] leading-none">
              {done} <span className="text-muted font-normal">/ {total}</span>
            </div>
            <div className="text-[11px] uppercase tracking-[.1em] text-muted mt-1.5 font-medium">
              Steps complete
            </div>
          </div>
        </div>

        <div className="mt-4 h-1 bg-[#F1F2F4] rounded-full overflow-hidden">
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: "rgba(16,122,85,.55)" }}
          />
        </div>
        <div className="text-[11.5px] text-muted mt-2">
          {done} of {total} steps complete on the way to closing
        </div>
      </div>

      {actionItem && (
        <div
          className="mt-3.5 mx-6 px-3.5 py-3 rounded-md flex gap-2.5 items-start"
          style={{
            background: "rgba(217,119,6,.05)",
            border: "1px solid rgba(217,119,6,.18)",
          }}
        >
          <span
            className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 mt-px"
            style={{ background: "rgba(217,119,6,.12)" }}
          >
            <I.Bell size={12} style={{ color: "#8a5a08" }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold" style={{ color: "#6b4604" }}>
              Action needed
            </div>
            <div className="text-[12.5px] leading-[1.5] mt-0.5" style={{ color: "#6b4604" }}>
              {actionItem.actionNote}
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pt-1.5 pb-4">
        {items.map((it, i) => (
          <div
            key={it.id}
            className="flex items-center gap-3 py-3"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--hairline-2)" }}
          >
            <Bullet status={it.status} />
            <div
              className="flex-1 text-[13.5px] leading-[1.5]"
              style={{
                color:
                  it.status === "done"
                    ? "var(--muted)"
                    : it.status === "action"
                    ? "var(--ink)"
                    : "var(--charcoal)",
                textDecoration: it.status === "done" ? "line-through" : "none",
                textDecorationColor: "rgba(15,23,42,.18)",
                fontWeight: it.status === "action" ? 500 : 400,
              }}
            >
              {it.label}
            </div>
            <StatusTag status={it.status} />
          </div>
        ))}
      </div>
    </Card>
  );
};
