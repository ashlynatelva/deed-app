"use client";

// Phase C — branding now lives in Supabase via <BrandingProvider>.
// This file is a thin re-export so existing call sites
// (`import { useBranding, renderWelcome } from "@/lib/hooks/useBranding"`)
// keep working without churn.

export { useBrandingCtx as useBranding } from "@/components/shared/BrandingProvider";
export { renderWelcome } from "@/lib/profile-utils";
