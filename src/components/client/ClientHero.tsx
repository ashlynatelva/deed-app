import * as React from "react";
import { Card } from "@/components/ui/Card";
import { STAGES } from "@/lib/mock/stages";
import { fmtDate, daysFromNow } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export const ClientHero = ({ tx }: { tx: Transaction }) => {
  const idx = STAGES.findIndex((s) => s.key === tx.stageKey);
  const pct = ((idx + 0.5) / STAGES.length) * 100;
  const stage = STAGES.find((s) => s.key === tx.stageKey);
  const days = daysFromNow(tx.closing) ?? 0;

  return (
    <Card padded={false} className="overflow-hidden mb-5">
      <div
        className="px-5 md:px-8 py-6 md:py-7 text-white relative"
        style={{ background: "linear-gradient(180deg, #0F172A 0%, #14213d 100%)" }}
      >
        <div
          className="absolute top-0 left-5 md:left-8 h-[2px] w-14"
          style={{ background: "var(--brand-accent, var(--gold))" }}
        />
        {/* Stacks vertically at mobile: address + stage/closing in a row
            below. Desktop keeps the original side-by-side layout. */}
        <div className="flex flex-col gap-5 md:flex-row md:justify-between md:items-start md:gap-6 md:flex-wrap">
          <div className="min-w-0">
            <div
              className="text-[11px] uppercase tracking-[.14em] mb-2"
              style={{ color: "rgba(255,255,255,.55)" }}
            >
              {tx.type.startsWith("Buyer") ? "Your home purchase" : "Your home sale"}
            </div>
            <div className="serif text-[22px] md:text-[30px] tracking-[-0.01em] leading-snug">{tx.address}</div>
            <div className="text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,.6)" }}>
              {tx.city}
            </div>
          </div>
          <div className="flex gap-6 md:gap-9 justify-between md:justify-start">
            <div>
              <div
                className="text-[11px] uppercase tracking-[.12em] mb-1.5"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                Where you are now
              </div>
              <div className="serif text-[18px]" style={{ color: "var(--brand-accent, var(--gold))" }}>
                {stage?.label}
              </div>
              <div className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,.6)" }}>
                Step {idx + 1} of {STAGES.length}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-[11px] uppercase tracking-[.12em] mb-1.5"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                Closing in
              </div>
              <div className="serif num text-[28px] md:text-[32px] leading-none tracking-[-0.02em]">
                {days} <span className="text-[15px] md:text-[16px]" style={{ color: "rgba(255,255,255,.6)" }}>days</span>
              </div>
              <div className="text-[12px] mt-1.5" style={{ color: "rgba(255,255,255,.6)" }}>
                {fmtDate(tx.closing)}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,.1)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: pct + "%",
                // Solid accent — gradient is visually inconsistent across non-gold accents.
                background: "var(--brand-accent, var(--gold))",
              }}
            />
          </div>
          <div
            className="flex justify-between mt-2.5 text-[11px]"
            style={{ color: "rgba(255,255,255,.55)" }}
          >
            <span>Offer accepted</span>
            <span>Closing day</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
