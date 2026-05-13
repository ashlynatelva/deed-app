"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Consistent clickable document title — a button styled to look like text, with
 * a clear hover affordance so users know it opens a preview.
 */
export const DocumentTitle = ({ children, onClick, className, size = "md" }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "text-left font-medium text-ink hover:text-blue cursor-pointer transition-colors max-w-full truncate hover:underline underline-offset-2 decoration-blue/60",
      size === "sm" ? "text-[12.5px]" : "text-[13.5px]",
      className,
    )}
  >
    {children}
  </button>
);
