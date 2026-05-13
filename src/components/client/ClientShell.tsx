"use client";

import * as React from "react";

import { TopNav } from "@/components/shared/TopNav";
import { MobileNavDrawer } from "@/components/shared/MobileNavDrawer";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { useBranding } from "@/lib/hooks/useBranding";
import { useUnreadMessageCount } from "@/lib/hooks/useUnreadMessageCount";
import type { NavItem } from "@/components/shared/Sidebar";

const BASE_NAV: NavItem[] = [
  { href: "/client/overview",  label: "Overview",  icon: "Home" },
  { href: "/client/documents", label: "Documents", icon: "Doc" },
  { href: "/client/messages",  label: "Messages",  icon: "Mail" },
  { href: "/client/updates",   label: "Updates",   icon: "Bell" },
  { href: "/client/settings",  label: "Settings",  icon: "Cog" },
];

const buildItems = (unread: number): NavItem[] =>
  BASE_NAV.map((item) =>
    item.href === "/client/messages" && unread > 0 ? { ...item, badge: unread } : item,
  );

type Props = {
  initialUserName: string;
  initialUserEmail: string;
  initialUserSubtitle: string;
  children: React.ReactNode;
};

/**
 * Client portal responsive shell. Mirrors `AgentShell`:
 *   - Desktop sidebar (`hidden md:flex`)
 *   - Mobile drawer triggered by the top-nav hamburger
 * One `useUnreadMessageCount` subscription drives badges on both.
 */
export const ClientShell = ({
  initialUserName,
  initialUserEmail,
  initialUserSubtitle,
  children,
}: Props) => {
  const { settings } = useBranding();
  const unread = useUnreadMessageCount();
  const items = React.useMemo(() => buildItems(unread), [unread]);

  const [navOpen, setNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      <ClientSidebar items={items} />
      <MobileNavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        brandName={settings.brokerageName?.trim() || "DEED"}
        brandLogoUrl={settings.logoDataUrl}
        subtitle="Your portal"
        sectionLabel="Your journey"
        items={items}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopNav
          role="client"
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
