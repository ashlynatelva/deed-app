"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Browser-side Supabase client. Reads + writes session cookies directly so
 * the page stays signed-in across reloads and the auth state syncs with the
 * server client. Safe to create on every render — `createBrowserClient`
 * internally memoizes by URL+key.
 */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
