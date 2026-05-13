"use client";

import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";

/**
 * Small client island so the dashboard server component can stay server-only
 * while the "Good morning, {name}" line reflects live profile state. Updates
 * the moment the agent saves a new name on /agent/settings.
 */
export const AgentDashboardGreeting = () => {
  const { firstName } = useCurrentProfile();
  return (
    <div className="serif text-[30px] tracking-[-0.01em]">
      Good morning, {firstName}.
    </div>
  );
};
