import * as React from "react";

type Tone = "default" | "warn" | "risk";

export const KPI = ({
  label,
  value,
  hint,
  accent = false,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
  tone?: Tone;
}) => {
  // KPI accents (top bar + status dot) follow the brokerage's brand color
  // when a BrandingProvider is mounted, falling back to platform gold.
  const dotColor =
    tone === "warn" ? "#D97706"
    : tone === "risk" ? "#DC2626"
    : "var(--brand-accent, var(--gold))";
  return (
    <div className="relative overflow-hidden bg-white border border-hairline rounded-[var(--radius-card)] px-5 py-[18px] shadow-card">
      {accent && (
        <div
          className="absolute top-0 left-0 h-[2px] w-9"
          style={{ background: "var(--brand-accent, var(--gold))" }}
        />
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] text-muted font-medium">{label}</div>
        {tone !== "default" && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: dotColor }}
          />
        )}
      </div>
      <div className="serif num text-[32px] leading-[1.1] text-ink tracking-[-0.02em]">
        {value}
      </div>
      {hint && <div className="text-[12px] text-muted mt-1.5">{hint}</div>}
    </div>
  );
};
