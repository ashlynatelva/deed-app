"use client";

import * as React from "react";
import { Sidebar, type NavItem } from "@/components/shared/Sidebar";
import { useBranding } from "@/lib/hooks/useBranding";

type Props = {
  /**
   * Nav items computed by `AgentShell`. Lifted out of this component so
   * the desktop sidebar and the mobile drawer share one source of truth
   * (and one `useUnreadMessageCount` subscription).
   */
  items: NavItem[];
  /**
   * Footer card content (typically `<SidebarAgentFooter ... />`). Built
   * by `AgentShell` and shared with `MobileNavDrawer` so the agent's
   * KPI summary surfaces identically at every breakpoint without
   * duplicating realtime subscriptions.
   */
  footer?: React.ReactNode;
};

/**
 * Desktop-only agent sidebar. The underlying `Sidebar` element is
 * `hidden md:flex`, so this entire tree disappears at mobile widths —
 * the `MobileNavDrawer` in `AgentShell` covers that case instead.
 *
 * Branding settings still live here because they're sidebar-specific.
 * The `footer` is passed in from `AgentShell` so the mobile drawer can
 * render the same card without re-subscribing to the KPI channel.
 */
export const AgentSidebar = ({ items, footer }: Props) => {
  const { settings } = useBranding();
  return (
    <Sidebar
      role="agent"
      subtitle="Advisor"
      sectionLabel="Manage"
      items={items}
      brandName={settings.brokerageName}
      brandLogoUrl={settings.logoDataUrl}
      footer={footer}
    />
  );
};
