import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Root route. Two reasons it gets hit:
//
//   1. Plain navigation to "/" — proxy doesn't gate it; this page sends the
//      visitor to /login.
//   2. Password-reset email link bouncing here because Supabase's
//      "Redirect URLs" allow-list rejected our /auth/update-password
//      redirect_to and fell back to the project's Site URL (which is
//      usually "/"). In that case the URL still has the recovery
//      `?code=…` query param (PKCE flow). We preserve every search
//      param and route to /auth/update-password so the recovery
//      session still gets established cleanly.
//
// Belt-and-suspenders: the proper fix is to add
// `${NEXT_PUBLIC_SITE_URL}/auth/update-password` to Supabase Auth's
// Redirect URLs allow-list. This handler makes the flow resilient
// when that hasn't happened yet.
// ─────────────────────────────────────────────────────────────────────────────

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Recovery hand-off: any time a Supabase auth code or error code
  // lands here, route to the update-password page with every search
  // param preserved so it can deal with both the success path
  // (?code=…) and the failure path (?error=…&error_code=…).
  const isRecoveryLanding =
    typeof params.code === "string" ||
    typeof params.error === "string" ||
    typeof params.error_code === "string";

  if (isRecoveryLanding) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") qs.set(key, value);
    }
    redirect(`/auth/update-password?${qs.toString()}`);
  }

  redirect("/login");
}
