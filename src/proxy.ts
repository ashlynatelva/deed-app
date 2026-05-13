import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware-helper";

/**
 * Route protection middleware.
 *
 * Flow per request:
 *   1. Refresh the Supabase auth cookie (via `updateSession`)
 *   2. If on /agent/* or /client/* without a session → redirect to /login
 *      (preserves the original destination via `?redirectTo=...`)
 *   3. If signed in and visiting / or /login → redirect to the user's role home
 *   4. If signed in but role-prefix doesn't match (e.g. a client visiting
 *      /agent/dashboard) → redirect to their role home
 *
 * Role is fetched from the `profiles` table — trusted because the row is
 * gated by RLS and only writeable via service-role / the user's own update
 * policy (which can't change role). The few extra ms per request is fine
 * for the MVP; we'll move role into the JWT via a Supabase Auth Hook if
 * page navigation latency becomes a concern.
 */
// Renamed from `middleware` in Next 16 — file is `proxy.ts` and the function
// signature is identical. See: https://nextjs.org/docs/messages/middleware-to-proxy
export async function proxy(request: NextRequest) {
  const { supabase, response } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isAgentPath  = pathname.startsWith("/agent");
  const isClientPath = pathname.startsWith("/client");
  const isLogin      = pathname === "/login";
  const isRoot       = pathname === "/";

  // Paths we don't gate at all. RLS still protects data; this just decides
  // who can see which page shell.
  if (!isAgentPath && !isClientPath && !isLogin && !isRoot) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Unauthenticated ─────────────────────────────────────────────────────
  if (!user) {
    if (isAgentPath || isClientPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      // Preserve the originally requested URL so we can bounce back after login.
      url.searchParams.set("redirectTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ── Authenticated — fetch role + lifecycle status ──────────────────────
  // `status` is the soft-delete switch from migration 0016. When an agent
  // revokes a client's portal access, the auth.users row stays valid
  // (they could still call signInWithPassword successfully), but every
  // gated page-load re-runs this check and bounces them back out.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  // Edge case: signed-in user with no profiles row (shouldn't happen for
  // seeded or invited users). Sign them out and send to /login. The
  // sign-out is required to break the redirect loop — without it, the
  // next request reads the same session cookie and falls right back
  // into this branch indefinitely.
  if (!profile?.role) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "missing_profile");
    return NextResponse.redirect(url);
  }

  // Soft-delete enforcement. An inactive / deleted profile means the
  // agent (or an admin) revoked this user's portal access — sign them
  // out and surface the reason on the login screen.
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "revoked");
    return NextResponse.redirect(url);
  }

  const home = profile.role === "client" ? "/client/overview" : "/agent/dashboard";

  // Already-authenticated users shouldn't sit on /login or /.
  if (isLogin || isRoot) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // Wrong role for this path prefix.
  if (isAgentPath && profile.role === "client") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }
  if (isClientPath && profile.role !== "client") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip Next static / image / common asset paths. Everything else runs the
  // middleware — including /api routes, which lets us protect API handlers
  // by reading the session inside them.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
