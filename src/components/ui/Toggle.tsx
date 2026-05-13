"use client";

import * as React from "react";

export const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="relative inline-block w-9 h-5 rounded-full cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
    style={{ background: checked ? "var(--blue)" : "#D1D5DB" }}
  >
    <span
      className="absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-[left] duration-150"
      style={{ left: checked ? 18 : 2 }}
    />
  </button>
);
