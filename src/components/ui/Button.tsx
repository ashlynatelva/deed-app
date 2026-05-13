import * as React from "react";
import { cn } from "@/lib/utils";

type Kind = "primary" | "secondary" | "ghost" | "dark" | "danger" | "destructive";
type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, string> = {
  sm: "h-[30px] px-[10px] text-[12.5px]",
  md: "h-9 px-[14px] text-[13px]",
  lg: "h-[42px] px-[18px] text-[13.5px]",
};

const kindMap: Record<Kind, string> = {
  primary:
    "bg-blue text-white border-blue hover:bg-blue-hover hover:border-blue-hover",
  secondary:
    "bg-white text-ink border-hairline hover:bg-[#F3F4F6]",
  ghost:
    "bg-transparent text-ink border-transparent hover:bg-[#F3F4F6]",
  dark:
    "bg-navy text-white border-navy hover:bg-[#1c2540]",
  danger:
    "bg-white text-[var(--status-risk-fg)] border-hairline hover:bg-[#FEF2F2]",
  destructive:
    "bg-[#B91C1C] text-white border-[#B91C1C] hover:bg-[#991B1B] hover:border-[#991B1B]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  size?: Size;
  icon?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ kind = "primary", size = "md", icon, className, children, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border rounded-lg font-medium cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        sizeMap[size],
        kindMap[kind],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
