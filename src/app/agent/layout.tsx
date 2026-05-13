import { notFound } from "next/navigation";

import { AgentShell } from "@/components/agent/AgentShell";
import { CurrentProfileProvider } from "@/components/shared/CurrentProfileProvider";
import { getCurrentProfile } from "@/lib/supabase/queries";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  // Proxy already redirected unauthenticated users to /login, so the only way
  // to land here without a profile is a misconfigured account. Surface
  // not-found instead of a confusing blank.
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  return (
    <CurrentProfileProvider initial={profile}>
      <AgentShell
        initialUserName={profile.full_name}
        initialUserEmail={profile.email}
        initialUserSubtitle={profile.title ?? "Advisor"}
      >
        {children}
      </AgentShell>
    </CurrentProfileProvider>
  );
}
