// ─────────────────────────────────────────────────────────────────────────────
// Branding constants — types, default values, accent palette presets.
//
// Storage moved to Supabase in Phase C — the runtime state now lives in
// `BrandingProvider` (React context, hydrated from `organizations.branding`).
// This file is constants-only and intentionally has no `"use client"` so it's
// importable from both server and client code.
//
// The shape of `BrandingSettings` mirrors the columns we'd hoist to dedicated
// table columns later if any of these become first-class entities.
// ─────────────────────────────────────────────────────────────────────────────

export type BrandingAccent = "gold" | "navy" | "emerald" | "slate";

export type BrandingSettings = {
  brokerageName: string;
  supportPhone: string;
  supportEmail: string;
  /** Warm headline shown at the top of the client portal. `{firstName}` is substituted. */
  welcomeMessage: string;
  /** Supporting subtext under the welcome headline. `{firstName}` is also supported. */
  welcomeSubtext: string;
  /** Body of the portal-invite email preview. */
  inviteEmailIntro: string;
  /** Shown at the bottom of the login screen / portal. */
  footerText: string;
  accent: BrandingAccent;
  /** Base64 data URL of an uploaded logo. Capped at ~500KB. */
  logoDataUrl?: string;
};

export const DEFAULT_BRANDING: BrandingSettings = {
  brokerageName: "DEED",
  supportPhone: "(617) 555-0101",
  supportEmail: "support@deed.app",
  welcomeMessage: "Hi {firstName}, welcome to your home journey.",
  welcomeSubtext: "We'll guide you through each step leading up to closing day.",
  inviteEmailIntro:
    "You've been invited to your secure portal. Your advisor will guide you through every step — uploading documents, signing paperwork, and tracking your closing.",
  footerText: "© DEED · A calmer way to buy and sell homes.",
  accent: "gold",
};

export type AccentPreset = {
  key: BrandingAccent;
  name: string;
  /** The primary accent color (logo bg, active indicators, primary buttons). */
  primary: string;
  /** Hover variant of primary. */
  primaryHover: string;
  /** Soft tint used for hover-fills and badge backgrounds. */
  soft: string;
  /** Foreground color that reads well on top of `primary`. */
  onPrimary: string;
};

export const ACCENT_PRESETS: Record<BrandingAccent, AccentPreset> = {
  gold:    { key: "gold",    name: "Gold",    primary: "#C9A84C", primaryHover: "#B08C30", soft: "rgba(201,168,76,.14)", onPrimary: "#0F172A" },
  navy:    { key: "navy",    name: "Navy",    primary: "#0F172A", primaryHover: "#1C2540", soft: "rgba(15,23,42,.10)",   onPrimary: "#FFFFFF" },
  emerald: { key: "emerald", name: "Emerald", primary: "#065F46", primaryHover: "#054C39", soft: "rgba(6,95,70,.12)",    onPrimary: "#FFFFFF" },
  slate:   { key: "slate",   name: "Slate",   primary: "#475569", primaryHover: "#334155", soft: "rgba(71,85,105,.12)",  onPrimary: "#FFFFFF" },
};

export const ACCENT_KEYS: BrandingAccent[] = ["gold", "navy", "emerald", "slate"];

/** Soft cap on logo uploads. */
export const MAX_LOGO_BYTES = 500_000;

/**
 * Coerce a raw `organizations.branding` jsonb value into a complete
 * `BrandingSettings` object, falling back to defaults for any missing field.
 * Tolerates older saved shapes.
 */
export const mergeBranding = (raw: unknown): BrandingSettings => {
  const partial =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<BrandingSettings>)
      : {};
  const merged: BrandingSettings = { ...DEFAULT_BRANDING, ...partial };
  if (!ACCENT_PRESETS[merged.accent]) merged.accent = DEFAULT_BRANDING.accent;
  return merged;
};
