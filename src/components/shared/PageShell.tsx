import * as React from "react";
import { cn } from "@/lib/utils";

export const PageShell = ({
  children,
  width = "default",
  className,
}: {
  children: React.ReactNode;
  /** "default" = 1320 (agent dashboards). "client" = 1180 (calmer/narrower portal). "narrow" = 880. */
  width?: "default" | "client" | "narrow";
  className?: string;
}) => {
  const max =
    width === "narrow" ? "max-w-[880px]" : width === "client" ? "max-w-[1180px]" : "max-w-[1320px]";
  return (
    // Mobile gets a tighter gutter (px-4) so content actually fits on
    // narrow viewports. Desktop keeps the original px-10. Vertical
    // rhythm tightens the same way (py-6 → py-8).
    <div className={cn("mx-auto py-6 px-4 md:py-8 md:px-10", max, className)}>{children}</div>
  );
};
