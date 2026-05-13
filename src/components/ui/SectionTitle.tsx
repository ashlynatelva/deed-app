import * as React from "react";

export const SectionTitle = ({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  right?: React.ReactNode;
}) => (
  // Stacks vertically at mobile so the right slot (which usually holds
  // action buttons) gets full width without crowding the title. Desktop
  // keeps the original side-by-side baseline-aligned layout.
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4 mb-4">
    <div className="flex-1 min-w-0">
      {eyebrow && (
        <div className="text-[11px] tracking-[.12em] uppercase text-muted mb-1.5">
          {eyebrow}
        </div>
      )}
      <div className="serif text-[22px] text-ink">{title}</div>
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);
