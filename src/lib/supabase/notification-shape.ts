/**
 * Mapper + presentation glue for notifications.
 *
 * The DB row (`public.notifications`) carries the canonical data. The
 * legacy UI shape adds a pre-baked `timestamp` (e.g. "2h ago") so the
 * existing bell + history components don't need to format dates inline.
 */

import type { IconKey } from "@/components/ui/Icon";
import { fmtRelative } from "@/lib/format";
import type { NotificationRow } from "./queries";

export type NotificationKind = "upload" | "message" | "deadline" | "update";

export type ClientNotification = {
  id: string;
  title: string;
  detail: string;
  /** Relative-time label, formatted from `created_at`. */
  timestamp: string;
  read: boolean;
  kind: NotificationKind;
  /** Deep-link target. Falls back to a kind-default if the row's href is null. */
  href: string;
};

/** Visual styling per notification kind (icon + colored tint). */
export const KIND_META: Record<NotificationKind, { icon: IconKey; tint: string; fg: string }> = {
  upload:   { icon: "Upload",   tint: "rgba(2,128,144,.10)",  fg: "#034b53" },
  message:  { icon: "Mail",     tint: "rgba(15,23,42,.06)",   fg: "var(--charcoal)" },
  deadline: { icon: "Clock",    tint: "rgba(217,119,6,.10)",  fg: "#8a5a08" },
  update:   { icon: "Bell",     tint: "rgba(201,168,76,.14)", fg: "#7a661f" },
};

/** Human label for the "Related area" pill on the history view. */
export const RELATED_AREA: Record<NotificationKind, string> = {
  upload:   "Documents",
  message:  "Messages",
  deadline: "Tasks",
  update:   "Updates",
};

/**
 * Default routing destination for a notification when no explicit `href`
 * is stored on the row. Triggers usually populate `href`, but if a row
 * arrives without one we still want the bell click to go somewhere
 * sensible.
 */
const defaultHref = (
  kind: NotificationKind,
  role: "agent" | "client",
): string => {
  if (role === "agent") {
    switch (kind) {
      case "upload":   return "/agent/documents";
      case "message":  return "/agent/messages";
      case "deadline": return "/agent/tasks";
      case "update":   return "/agent/dashboard";
    }
  }
  switch (kind) {
    case "upload":   return "/client/documents";
    case "message":  return "/client/messages";
    case "deadline": return "/client/overview";
    case "update":   return "/client/updates";
  }
};

export function mapNotification(
  row: NotificationRow,
  role: "agent" | "client",
  now = Date.now(),
): ClientNotification {
  const kind = row.kind as NotificationKind;
  return {
    id: row.id,
    title: row.title,
    detail: row.detail ?? "",
    timestamp: fmtRelative(row.created_at, now),
    read: row.read,
    kind,
    href: row.href ?? defaultHref(kind, role),
  };
}
