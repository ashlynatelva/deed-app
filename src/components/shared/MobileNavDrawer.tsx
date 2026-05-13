"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I, type IconKey } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: IconKey;
  badge?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Brokerage / brand name shown in the drawer header. */
  brandName: string;
  /** Optional logo image; falls back to the initial chip. */
  brandLogoUrl?: string;
  /** Two-line subtitle, e.g. "Advisor" / "Your portal". */
  subtitle: string;
  /** Section label above the nav list. */
  sectionLabel: string;
  /** The exact nav items rendered in the desktop sidebar for this role. */
  items: MobileNavItem[];
  /**
   * Optional footer card content (e.g. the agent's KPI summary). Wrapped
   * in the same translucent card chrome the desktop sidebar uses so the
   * value parity between breakpoints is visible.
   */
  footer?: React.ReactNode;
};

/**
 * Mobile slide-out navigation. Shown only at < md breakpoints — the
 * desktop `Sidebar` covers everything ≥ md. Mirrors the navy chrome of
 * the desktop sidebar so the brand feel survives the breakpoint.
 *
 * Behavior:
 *   - Opens from the left, full-height, ~280px wide
 *   - Click on the overlay or any nav item closes it
 *   - Esc closes
 *   - Body scroll-locks while open so the page underneath doesn't drift
 */
export const MobileNavDrawer = ({
  open,
  onClose,
  brandName,
  brandLogoUrl,
  subtitle,
  sectionLabel,
  items,
  footer,
}: Props) => {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const initial = (brandName?.trim() || "DEED").charAt(0).toUpperCase();

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 md:hidden transition-opacity duration-200",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,23,42,.55)" }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Navigation"
        className={cn(
          "absolute top-0 left-0 h-full w-[280px] max-w-[85%] flex flex-col text-white px-3.5 py-[22px] transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "var(--navy)", borderRight: "1px solid #0a1426" }}
      >
        {/* Brand header — close button on the right so it's thumb-reachable. */}
        <div className="flex items-center justify-between px-2.5 pb-6 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {brandLogoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={brandLogoUrl}
                alt={brandName}
                className="w-7 h-7 rounded-md object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-[14px]"
                style={{
                  background: "var(--brand-accent, var(--gold))",
                  fontFamily: "var(--font-newsreader), serif",
                  fontWeight: 600,
                  color: "var(--brand-accent-on, #0F172A)",
                }}
              >
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <div className="serif text-[17px] leading-none truncate">{brandName}</div>
              <div
                className="text-[10px] uppercase tracking-[.14em] mt-[3px]"
                style={{ color: "rgba(255,255,255,.45)" }}
              >
                {subtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="w-9 h-9 -mr-1 inline-flex items-center justify-center rounded-md text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <I.X size={16} />
          </button>
        </div>

        <div
          className="text-[10px] uppercase tracking-[.14em] px-3 pt-2 pb-2"
          style={{ color: "rgba(255,255,255,.4)" }}
        >
          {sectionLabel}
        </div>

        <nav className="flex flex-col gap-[2px] flex-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = I[item.icon];
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-2.5 px-3 py-[11px] rounded-[7px] text-[14px] transition-colors duration-150",
                  isActive
                    ? "text-white font-medium"
                    : "text-white/70 hover:bg-white/[0.04] font-normal",
                )}
                style={isActive ? { background: "rgba(255,255,255,.07)" } : undefined}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-[2px] rounded-sm"
                    style={{ background: "var(--brand-accent, var(--gold))" }}
                  />
                )}
                <Icon size={16} />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span
                    className="text-[10px] font-semibold rounded-full px-[7px] py-px"
                    style={{
                      background: "var(--brand-accent, var(--gold))",
                      color: "var(--brand-accent-on, #0F172A)",
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {footer && (
          <div
            // Same chrome the desktop sidebar uses (see Sidebar.tsx) so the
            // KPI footer looks identical at every breakpoint.
            className="mt-3 p-3.5 rounded-[10px]"
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
};
