"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I, type IconKey } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  badge?: number;
};

export type SidebarRole = "agent" | "client";

type SidebarProps = {
  role: SidebarRole;
  items: NavItem[];
  /** Optional footer card content unique to each role. */
  footer?: React.ReactNode;
  /** Subtitle shown beneath the wordmark. */
  subtitle: string;
  /** Section label above the nav, e.g. "Manage" / "Your transaction". */
  sectionLabel: string;
  /** Optional brokerage name (client portal — defaults to "DEED"). */
  brandName?: string;
  /** Optional brokerage logo data URL (client portal). */
  brandLogoUrl?: string;
};

export const Sidebar = ({
  role,
  items,
  footer,
  subtitle,
  sectionLabel,
  brandName,
  brandLogoUrl,
}: SidebarProps) => {
  const pathname = usePathname();
  const displayName = brandName?.trim() || "DEED";
  const initial = displayName.charAt(0).toUpperCase();
  return (
    <aside
      // Hidden at mobile — replaced by <MobileNavDrawer>. Desktop layout
      // is byte-identical to before (sticky w-60 aside, navy chrome).
      className="hidden md:flex sticky top-0 h-screen w-60 flex-col text-white px-3.5 py-[22px] shrink-0"
      style={{ background: "var(--navy)", borderRight: "1px solid #0a1426" }}
    >
      {/* Wordmark — accent color falls back to the platform gold when no
          BrandingProvider is mounted (i.e. agent dashboards). */}
      <Link href={role === "agent" ? "/agent/dashboard" : "/client/overview"} className="px-2.5 pb-6 pt-1 flex items-center gap-2.5">
        {/* Brokerage logo if uploaded; otherwise the DEED platform mark
            from /public/logo.png. The mark is a navy rounded-square with
            a gold "D" — its own background/rounding is baked in. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandLogoUrl || "/logo.png"}
          alt={displayName}
          className="w-7 h-7 rounded-md object-cover"
        />
        {/* `initial` is preserved as an alt-text breadcrumb for screen
            readers in case the image fails to load. */}
        <span className="sr-only">{initial}</span>
        <div className="min-w-0">
          <div className="serif text-[17px] leading-none truncate">{displayName}</div>
          <div className="text-[10px] uppercase tracking-[.14em] mt-[3px]" style={{ color: "rgba(255,255,255,.45)" }}>
            {subtitle}
          </div>
        </div>
      </Link>

      <div
        className="text-[10px] uppercase tracking-[.14em] px-3 pt-2 pb-2"
        style={{ color: "rgba(255,255,255,.4)" }}
      >
        {sectionLabel}
      </div>

      <nav className="flex flex-col gap-[2px] flex-1">
        {items.map((item) => {
          const Icon = I[item.icon];
          // Match exact prefix so nested routes (e.g. /agent/transactions/[id]) stay highlighted.
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-[9px] rounded-[7px] text-[13px] transition-colors duration-150",
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
              <Icon size={15} />
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
          className="mt-3 p-3.5 rounded-[10px]"
          style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
};

export const SidebarAgentFooter = ({
  name,
  email,
  activeValue,
  closingSoonCount,
}: {
  name: string;
  email: string;
  activeValue: string;
  closingSoonCount: number;
}) => (
  <>
    <div className="flex items-center gap-2.5 mb-2.5">
      <Avatar name={name} size={32} tone="gold" />
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium truncate">{name}</div>
        <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,.5)" }}>
          {email}
        </div>
      </div>
    </div>
    <div className="text-[11px] leading-[1.5]" style={{ color: "rgba(255,255,255,.55)" }}>
      <span style={{ color: "var(--brand-accent, var(--gold))", fontWeight: 600 }}>{activeValue}</span> in active deals ·{" "}
      <span className="text-white font-medium">{closingSoonCount}</span> closing soon
    </div>
  </>
);

export const SidebarClientFooter = ({
  advisorPhone,
  advisorName = "your advisor",
}: {
  advisorPhone: string;
  advisorName?: string;
}) => (
  <>
    <div
      className="text-[11px] mb-2 uppercase tracking-[.08em]"
      style={{ color: "rgba(255,255,255,.55)" }}
    >
      Need help?
    </div>
    <div className="text-[12.5px] leading-[1.5] mb-2.5" style={{ color: "rgba(255,255,255,.85)" }}>
      {advisorName.split(" ")[0]} typically replies within a few hours during business days.
    </div>
    <div className="flex gap-1.5 text-[11px] items-center" style={{ color: "rgba(255,255,255,.6)" }}>
      <I.Phone size={11} />
      <span className="num">{advisorPhone}</span>
    </div>
  </>
);
