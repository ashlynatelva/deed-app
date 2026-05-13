"use client";

import * as React from "react";

import { TopNav } from "@/components/shared/TopNav";
import { MobileNavDrawer } from "@/components/shared/MobileNavDrawer";
import { AgentSidebar } from "@/components/agent/AgentSidebar";
import { SidebarAgentFooter, type NavItem } from "@/components/shared/Sidebar";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { useBranding } from "@/lib/hooks/useBranding";
import { useUnreadMessageCount } from "@/lib/hooks/useUnreadMessageCount";
import { useAgentKpiSummary } from "@/lib/hooks/useAgentKpiSummary";
import { formatCurrency } from "@/lib/format";

// ─── Nav items, shared between desktop sidebar + mobile drawer ──────────────
//
// Mirrors the data AgentSidebar already builds. Lifted up here so the
// drawer doesn't have to re-subscribe to useUnreadMessageCount — both
// surfaces get items from the same hook call.

const BASE_NAV: NavItem[] = [
  { href: "/agent/dashboard",    label: "Dashboard",    icon: "Home" },
  { href: "/agent/transactions", label: "Transactions", icon: "Building" },
  { href: "/agent/clients",      label: "Clients",      icon: "Users" },
  { href: "/agent/messages",     label: "Messages",     icon: "Mail" },
  { href: "/agent/documents",    label: "Documents",    icon: "Doc" },
  { href: "/agent/tasks",        label: "Tasks",        icon: "Check" },
  { href: "/agent/settings",     label: "Settings",     icon: "Cog" },
];

const TEAM_ITEM: NavItem = { href: "/agent/team", label: "Team", icon: "User" };

const buildItems = (isAdmin: boolean, unread: number): NavItem[] => {
  const base = isAdmin
    ? [...BASE_NAV.slice(0, -1), TEAM_ITEM, BASE_NAV[BASE_NAV.length - 1]]
    : BASE_NAV;
  return base.map((item) =>
    item.href === "/agent/messages" && unread > 0
      ? { ...item, badge: unread }
      : item,
  );
};

type Props = {
  /** First-paint profile values from the server layout. */
  initialUserName: string;
  initialUserEmail: string;
  initialUserSubtitle: string;
  children: React.ReactNode;
};

/**
 * Agent-side responsive shell.
 *
 *   - Desktop (≥ md): persistent navy sidebar + top-nav above content.
 *   - Mobile (< md):  hamburger in the top-nav opens a slide-out drawer
 *                     that mirrors the sidebar's items. The desktop
 *                     sidebar element is hidden via CSS at this
 *                     breakpoint (see `Sidebar.tsx` — `hidden md:flex`).
 *
 * The drawer's open state lives here; both `TopNav` (hamburger) and
 * `MobileNavDrawer` (close) read/write it.
 */
export const AgentShell = ({
  initialUserName,
  initialUserEmail,
  initialUserSubtitle,
  children,
}: Props) => {
  const { profile, fullName, email } = useCurrentProfile();
  const { settings } = useBranding();
  const unread = useUnreadMessageCount();
  // KPI summary lives at the shell level so the desktop sidebar and the
  // mobile nav drawer share one realtime subscription + one fetch — and
  // so the same node renders in both places, keeping the value identical
  // across breakpoints.
  const { activeValue, closingSoon } = useAgentKpiSummary();

  const items = React.useMemo(
    () => buildItems(profile.role === "admin", unread),
    [profile.role, unread],
  );

  const activeValueLabel = activeValue >= 1_000_000
    ? `$${(activeValue / 1_000_000).toFixed(1)}M`
    : formatCurrency(activeValue);

  const agentFooter = (
    <SidebarAgentFooter
      name={fullName}
      email={email}
      activeValue={activeValueLabel}
      closingSoonCount={closingSoon}
    />
  );

  const [navOpen, setNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      <AgentSidebar items={items} footer={agentFooter} />
      <MobileNavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        brandName={settings.brokerageName?.trim() || "DEED"}
        brandLogoUrl={settings.logoDataUrl}
        subtitle="Advisor"
        sectionLabel="Manage"
        items={items}
        footer={agentFooter}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopNav
          role="agent"
          userName={initialUserName}
          userEmail={initialUserEmail}
          userSubtitle={initialUserSubtitle}
          onMenuClick={() => setNavOpen(true)}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </main>
    </div>
  );
};
