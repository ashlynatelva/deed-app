import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

/**
 * Session-refresh helper for Next middleware.
 *
 * Phase B will add the actual `src/middleware.ts` that:
 *   1. Calls `updateSession(request)` to refresh the auth cookie
 *   2. Reads the user's role + role-gates /agent/* vs /client/*
 *   3. Redirects unauthenticated users to /login
 *
 * This helper exists in Phase A only so the imports compile and the cookie
 * plumbing is ready to use.
 */
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touches the session so the cookie auto-refreshes when near expiry.
  await supabase.auth.getUser();

  return { supabase, response: supabaseResponse };
};
