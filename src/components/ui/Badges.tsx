import * as React from "react";
import { cn } from "@/lib/utils";
import type { DocumentStatus, TransactionStatus } from "@/lib/types";
import { STATUS_LABEL, DOC_LABEL } from "@/lib/mock/stages";

const txMap: Record<TransactionStatus, { bg: string; fg: string; dot: string }> = {
  on_track:        { bg: "var(--status-ok-bg)",   fg: "var(--status-ok-fg)",   dot: "#10B981" },
  needs_attention: { bg: "var(--status-warn-bg)", fg: "var(--status-warn-fg)", dot: "#D97706" },
  at_risk:         { bg: "var(--status-risk-bg)", fg: "var(--status-risk-fg)", dot: "#DC2626" },
};

export const StatusBadge = ({
  status,
  size = "md",
}: {
  status: TransactionStatus;
  size?: "sm" | "md";
}) => {
  const s = txMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full whitespace-nowrap font-medium",
        size === "sm" ? "py-[2px] px-2 text-[11px]" : "py-1 px-2.5 text-[12px]",
      )}
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {STATUS_LABEL[status]}
    </span>
  );
};

const docMap: Record<DocumentStatus, { bg: string; fg: string }> = {
  needed:    { bg: "#F3F4F6",                fg: "#374151" },
  submitted: { bg: "var(--status-info-bg)",  fg: "var(--status-info-fg)" },
  received:  { bg: "var(--status-info-bg)",  fg: "var(--status-info-fg)" },
  reviewed:  { bg: "var(--status-ok-bg)",    fg: "var(--status-ok-fg)" },
  revision:  { bg: "var(--status-warn-bg)",  fg: "var(--status-warn-fg)" },
};

export const DocBadge = ({ status }: { status: DocumentStatus }) => {
  const s = docMap[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11.5px] font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {DOC_LABEL[status]}
    </span>
  );
};

export const StageDot = ({ label }: { label: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 bg-[#F3F4F6] text-charcoal border border-hairline rounded-full text-[12px] font-medium whitespace-nowrap">
    {label}
  </span>
);
