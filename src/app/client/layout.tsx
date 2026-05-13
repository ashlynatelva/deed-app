import { notFound } from "next/navigation";

import { ClientShell } from "@/components/client/ClientShell";
import { CurrentProfileProvider } from "@/components/shared/CurrentProfileProvider";
import { getCurrentProfile } from "@/lib/supabase/queries";

// BrandingProvider is mounted globally in /app/providers.tsx so the brand
// CSS variables (--brand-accent, etc.) are available everywhere — including
// the toast portal and the login screen.
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  return (
    <CurrentProfileProvider initial={profile}>
      <ClientShell
        initialUserName={profile.full_name}
        initialUserEmail={profile.email}
        initialUserSubtitle="Client"
      >
        {children}
      </ClientShell>
    </CurrentProfileProvider>
  );
}
