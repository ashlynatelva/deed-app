"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import {
  ACCENT_PRESETS,
  DEFAULT_BRANDING,
  mergeBranding,
  type AccentPreset,
  type BrandingSettings,
} from "@/lib/store/branding";

type Ctx = {
  /** The owning org row, or null for unauthenticated readers (login page). */
  organization: Tables<"organizations"> | null;
  /** Normalized settings — always populated, falls back to defaults. */
  settings: BrandingSettings;
  /** Resolved palette for the active accent. */
  palette: AccentPreset;
  /** True once we have an `organization` row (server-fetched). */
  hydrated: boolean;
  /** Patch one or more fields. Async — awaits the Supabase write. */
  update: (patch: Partial<BrandingSettings>) => Promise<void>;
  /** Replace the full settings object. */
  set: (next: BrandingSettings) => Promise<void>;
  /** Restore defaults. */
  reset: () => Promise<void>;
};

const Context = React.createContext<Ctx | null>(null);

/**
 * Holds the brokerage's branding in React context, hydrated from the
 * server-fetched `organizations` row, and exposes async mutations that write
 * to `organizations.branding` (jsonb).
 *
 * Mounted globally in `app/providers.tsx` so every surface — login page,
 * agent dashboards, client portal, toasts, modals — inherits the brand
 * CSS variables and reads the same settings.
 *
 * Implementation note: renders a plain `<div>` that wraps children and
 * carries the brand CSS variables on its inline style. The div is purely
 * a CSS-var carrier — `position: static`, no width/height, no event
 * handlers — so it has zero effect on layout and event propagation. An
 * earlier version used `display: contents` to avoid the wrapper entirely,
 * but React 19's `<style>` hoisting and historical WebKit `display:
 * contents` event-bubbling bugs combined to break hydration on mobile.
 */
export const BrandingProvider = ({
  initialOrganization,
  children,
}: {
  initialOrganization: Tables<"organizations"> | null;
  children: React.ReactNode;
}) => {
  const [organization, setOrganization] = React.useState(initialOrganization);
  const settings = React.useMemo(
    () => mergeBranding(organization?.branding ?? null),
    [organization],
  );
  const palette = ACCENT_PRESETS[settings.accent] ?? ACCENT_PRESETS.gold;

  const persist = React.useCallback(
    async (next: BrandingSettings) => {
      if (!organization) {
        // No org row available (e.g. unauthenticated viewer of the login
        // page). Local-only state change — there's no Supabase write the
        // RLS will accept anyway.
        setOrganization({
          id: "",
          name: next.brokerageName,
          support_phone: next.supportPhone,
          support_email: next.supportEmail,
          branding: next as unknown as Json,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const supabase = createClient();

      // Use plain `.select()` (array shape) rather than `.single()` so we
      // can detect a 0-row return — `.single()` raises PGRST116 which
      // obscures the difference between a real Postgres error and an
      // RLS-silent denial. The branding RLS policy is recursion-safe
      // since migration 0012, but the array-shape check is cheap insurance.
      const { data: rows, error } = await supabase
        .from("organizations")
        .update({
          // Mirror the most-queried branding fields to dedicated columns so
          // server-side consumers (invite emails, etc.) can read them
          // without parsing JSON. The full struct stays in `branding`.
          name: next.brokerageName,
          support_phone: next.supportPhone,
          support_email: next.supportEmail,
          branding: next as unknown as Json,
        })
        .eq("id", organization.id)
        .select();
      if (error) {
        throw new Error(
          error.message
            ? `${error.message}${error.hint ? ` (${error.hint})` : ""}`
            : `Branding update failed (code ${error.code ?? "unknown"}).`,
        );
      }
      const rowCount = rows?.length ?? 0;
      if (rowCount === 0) {
        throw new Error("Branding update returned no rows — please refresh and try again.");
      }
      setOrganization(rows[0]);
    },
    [organization],
  );

  const update = React.useCallback(
    async (patch: Partial<BrandingSettings>) => {
      await persist({ ...settings, ...patch });
    },
    [persist, settings],
  );

  const set = React.useCallback(
    async (next: BrandingSettings) => {
      await persist(next);
    },
    [persist],
  );

  const reset = React.useCallback(async () => {
    await persist(DEFAULT_BRANDING);
  }, [persist]);

  const value = React.useMemo<Ctx>(
    () => ({
      organization,
      settings,
      palette,
      hydrated: organization !== null,
      update,
      set,
      reset,
    }),
    [organization, settings, palette, update, set, reset],
  );

  return (
    <Context.Provider value={value}>
      <div
        style={
          {
            "--brand-accent": palette.primary,
            "--brand-accent-hover": palette.primaryHover,
            "--brand-accent-soft": palette.soft,
            "--brand-accent-on": palette.onPrimary,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </Context.Provider>
  );
};

export const useBrandingCtx = (): Ctx => {
  const ctx = React.useContext(Context);
  if (!ctx) {
    throw new Error(
      "useBranding must be used inside <BrandingProvider> (mounted in app/providers.tsx).",
    );
  }
  return ctx;
};
