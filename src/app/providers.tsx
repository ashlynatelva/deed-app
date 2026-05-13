"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { BrandingProvider } from "@/components/shared/BrandingProvider";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Global client-side providers, mounted once at the app root.
 *
 * Order matters: BrandingProvider must wrap ToastProvider so the toast portal
 * (which renders at the root level) inherits the brand CSS variables.
 *
 * `initialOrganization` is server-fetched in app/layout.tsx (single-tenant
 * MVP) so first paint is correct even for unauthenticated pages.
 */
export const Providers = ({
  initialOrganization,
  children,
}: {
  initialOrganization: Tables<"organizations"> | null;
  children: React.ReactNode;
}) => (
  <BrandingProvider initialOrganization={initialOrganization}>
    <ToastProvider>{children}</ToastProvider>
  </BrandingProvider>
);
