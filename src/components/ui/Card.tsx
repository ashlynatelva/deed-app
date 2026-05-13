import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  hover?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padded = true, hover = false, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card border border-hairline rounded-[var(--radius-card)] shadow-card transition-[box-shadow,border-color] duration-150",
        padded && "p-5",
        hover && "hover:shadow-card-hover hover:border-[#d8dde3] cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
);
Card.displayName = "Card";

export const CardHeader = ({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("px-5 py-4 border-b border-hairline flex items-center justify-between gap-3", className)}>
    <div className="min-w-0">
      <div className="serif text-[17px] text-ink">{title}</div>
      {subtitle && <div className="text-[12px] text-muted mt-0.5">{subtitle}</div>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);
