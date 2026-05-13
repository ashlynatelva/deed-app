"use client";

import * as React from "react";
import { I, type IconKey } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type SettingsTab = {
  id: string;
  label: string;
  icon: IconKey;
};

export const SettingsTabs = ({
  tabs,
  active,
  onChange,
}: {
  tabs: SettingsTab[];
  active: string;
  onChange: (id: string) => void;
}) => (
  // Horizontal scrollable strip at mobile, vertical stack at desktop.
  // Desktop rendering is byte-identical to the original.
  <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 md:mx-0 px-1 md:px-0">
    {tabs.map((t) => {
      const Icon = I[t.icon];
      const isActive = active === t.id;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-left transition-colors whitespace-nowrap shrink-0 md:shrink",
            isActive ? "bg-white text-ink font-medium border border-hairline" : "text-charcoal hover:bg-[#F3F4F6] border border-transparent",
          )}
        >
          <Icon size={14} className={isActive ? "text-blue" : "text-muted"} />
          {t.label}
        </button>
      );
    })}
  </div>
);
