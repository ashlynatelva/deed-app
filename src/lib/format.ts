// Date + currency helpers, kept identical to the prototype so the design
// numbers line up across pages.

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const fmtShort = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const daysFromNow = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso + "T12:00:00").getTime();
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
};

export const formatCurrency = (n: number): string =>
  "$" + n.toLocaleString("en-US");

/**
 * Compact relative-time string for notification rows and activity feeds.
 *
 * Output examples: "Just now", "12m ago", "3h ago", "Yesterday",
 * "3 days ago", "Apr 14". Falls back to a full date for anything older
 * than a week so the bell dropdown doesn't drown in "47 days ago" rows.
 *
 * Accepts an ISO timestamp (`timestamptz` from Supabase) or null.
 */
export const fmtRelative = (iso: string | null | undefined, now = Date.now()): string => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = now - t;
  if (diff < 0) return "Just now"; // clock skew or future-dated; don't show "in 3h"

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;

  // Day-aligned comparison so "Yesterday" really means calendar-yesterday,
  // not 23.5 hours ago.
  const nowDay = new Date(now);
  nowDay.setHours(0, 0, 0, 0);
  const thenDay = new Date(t);
  thenDay.setHours(0, 0, 0, 0);
  const dayDelta = Math.round((nowDay.getTime() - thenDay.getTime()) / 86_400_000);
  if (dayDelta === 1) return "Yesterday";
  if (dayDelta < 7)   return `${dayDelta} days ago`;

  // Older than a week — show a compact date instead of "47 days ago".
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
