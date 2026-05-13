/**
 * Pure name/initials helpers shared across identity surfaces.
 *
 * Moved out of `lib/store/clientProfile.ts` in Phase C — that file is being
 * removed now that profile state lives in Supabase.
 */

/**
 * Derive avatar initials. Multi-word names take the first letter of the
 * first word + first letter of the last word — e.g. "Whitney & Marcus Hall"
 * → "WH". Single-word names fall back to the first two characters.
 */
export const deriveInitials = (fullName: string | null | undefined): string => {
  const parts = (fullName ?? "").trim().split(/\s*&\s*|\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Just the first word for friendly greetings. */
export const firstNameOf = (fullName: string | null | undefined): string => {
  const parts = (fullName ?? "").trim().split(/\s*&\s*|\s+/).filter(Boolean);
  return parts[0] || "";
};

/** Substitute `{firstName}` (and tolerate a missing token). */
export const renderWelcome = (template: string, firstName: string): string =>
  template.replace(/\{firstName\}/g, firstName);
