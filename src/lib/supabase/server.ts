import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

/**
 * Server-side Supabase client.
 *
 * Reads + writes session cookies through Next's `cookies()` so server
 * components, server actions, route handlers, and middleware all see the
 * authenticated user. Always create a fresh client per request — never cache
 * the instance across requests.
 *
 * Usage:
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server component context — Next forbids setting cookies. The
            // session refresh path in middleware handles writes instead.
          }
        },
      },
    },
  );
};

/**
 * Service-role client for trusted server code (API routes, scripts, triggers
 * implemented in app code). Bypasses RLS entirely — never expose to the
 * browser, never call from a client component.
 */
export const createServiceRoleClient = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This client is server-only.",
    );
  }
  // Lazy import keeps the service-role dep out of the browser bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
};
