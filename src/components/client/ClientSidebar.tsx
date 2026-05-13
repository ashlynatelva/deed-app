"use client";

import { Sidebar, SidebarClientFooter, type NavItem } from "@/components/shared/Sidebar";
import { useBranding } from "@/lib/hooks/useBranding";

type Props = {
  /**
   * Nav items computed by `ClientShell`. Lifted out of this component so
   * desktop sidebar and the mobile drawer share one source of truth.
   */
  items: NavItem[];
};

/**
 * Desktop-only client portal sidebar. Hidden at < md via the underlying
 * `Sidebar`'s responsive class; `MobileNavDrawer` (mounted by
 * `ClientShell`) covers mobile.
 */
export const ClientSidebar = ({ items }: Props) => {
  const { settings } = useBranding();
  return (
    <Sidebar
      role="client"
      subtitle="Your portal"
      sectionLabel="Your journey"
      items={items}
      brandName={settings.brokerageName}
      brandLogoUrl={settings.logoDataUrl}
      footer={
        <SidebarClientFooter
          advisorPhone={settings.supportPhone}
          advisorName={settings.brokerageName}
        />
      }
    />
  );
};
