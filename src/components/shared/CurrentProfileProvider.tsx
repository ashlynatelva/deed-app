"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { deriveInitials, firstNameOf } from "@/lib/profile-utils";
import type { Tables } from "@/lib/supabase/database.types";

type Profile = Tables<"profiles">;

type ProfilePatch = Partial<Pick<Profile, "full_name" | "email" | "phone" | "title" | "avatar_url">>;

type Ctx = {
  profile: Profile;
  fullName: string;
  email: string;
  phone: string;
  title: string;
  avatarInitials: string;
  firstName: string;
  /** Patch the signed-in user's profile. Writes to Supabase + updates context. */
  update: (patch: ProfilePatch) => Promise<void>;
  /** Replace name/email/phone/title in one call. */
  set: (next: ProfilePatch) => Promise<void>;
};

const Context = React.createContext<Ctx | null>(null);

/**
 * Holds the signed-in user's profile in a React context. Mounted by the
 * agent/client layouts, which server-fetch the profile via
 * `getCurrentProfile()` and pass it in as `initial`.
 *
 * Replaces the old localStorage-backed `useClientProfile` store — Supabase
 * is now the source of truth. Same UX guarantees:
 *   • Saves on /client/settings or /agent/settings update name/email/phone
 *     in real time across every mounted consumer.
 *   • Avatar initials are derived consistently via `deriveInitials`.
 *   • Profile rename never rewrites historical message senderName.
 */
export const CurrentProfileProvider = ({
  initial,
  children,
}: {
  initial: Profile;
  children: React.ReactNode;
}) => {
  const [profile, setProfile] = React.useState<Profile>(initial);

  const persist = React.useCallback(async (patch: ProfilePatch) => {
    const supabase = createClient();

    // Use `.select()` (array) instead of `.single()` so we can detect a
    // 0-row result — `.single()` raises PGRST116 on 0 rows which hides
    // the difference between a Postgres error and an RLS-silent denial.
    // The profiles RLS is recursion-safe since migration 0012, but the
    // array-shape check is cheap insurance.
    const { data: rows, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", profile.id)
      .select();

    if (error) {
      throw new Error(
        error.message
          ? `${error.message}${error.hint ? ` (${error.hint})` : ""}`
          : `Profile update failed (code ${error.code ?? "unknown"}).`,
      );
    }
    const rowCount = rows?.length ?? 0;
    if (rowCount === 0) {
      throw new Error("Profile update returned no rows — please refresh and try again.");
    }
    setProfile(rows[0]);
  }, [profile.id]);

  const value = React.useMemo<Ctx>(() => ({
    profile,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone ?? "",
    title: profile.title ?? "",
    avatarInitials: deriveInitials(profile.full_name),
    firstName: firstNameOf(profile.full_name) || "there",
    update: persist,
    set: persist,
  }), [profile, persist]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useCurrentProfile = (): Ctx => {
  const ctx = React.useContext(Context);
  if (!ctx) {
    throw new Error(
      "useCurrentProfile must be used inside <CurrentProfileProvider> " +
      "(mounted by /agent and /client layouts).",
    );
  }
  return ctx;
};
