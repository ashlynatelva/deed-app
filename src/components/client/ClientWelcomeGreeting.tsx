"use client";

import * as React from "react";
import { useBranding, renderWelcome } from "@/lib/hooks/useBranding";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";

/**
 * Warm, concierge-style welcome shown at the top of the client overview.
 *
 * Typography hierarchy:
 *   - Headline: serif, 22px, ink — the personal greeting
 *   - Subtext: 13.5px, muted — calm supporting line
 *
 * Both lines flow through `renderWelcome` so `{firstName}` (and only
 * `{firstName}`) is interpolated. Headline + subtext copy are
 * brokerage-customizable via /agent/settings → Branding.
 */
export const ClientWelcomeGreeting = () => {
  const { settings } = useBranding();
  const { firstName } = useCurrentProfile();
  const headline = renderWelcome(settings.welcomeMessage, firstName);
  const subtext = renderWelcome(settings.welcomeSubtext, firstName);

  return (
    <div className="mb-6">
      <div className="serif text-[22px] tracking-[-0.01em] text-ink leading-[1.2]">
        {headline}
      </div>
      {subtext && (
        <div className="text-[13.5px] text-muted mt-2 leading-[1.55] max-w-[560px]">
          {subtext}
        </div>
      )}
    </div>
  );
};
