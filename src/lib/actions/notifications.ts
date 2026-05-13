"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Phase G — notification mutations.
//
// Notifications are only ever written by DB triggers (message inserts, stage
// changes, future kinds). The app only flips the `read` flag. RLS gates
// these updates to `recipient_id = auth.uid()`.
// ─────────────────────────────────────────────────────────────────────────────

type Result = { ok: true } | { ok: false; error: string };

const revalidateNotificationPaths = () => {
  revalidatePath("/agent/notifications");
  revalidatePath("/client/notifications");
};

/**
 * Mark a single notification as read. Used when the user clicks a row in
 * the bell dropdown or history list.
 */
export async function markNotificationRead(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("read", false); // no-op if already read
  if (error) {
    console.error("[markNotificationRead]", error);
    return { ok: false, error: error.message };
  }
  revalidateNotificationPaths();
  return { ok: true };
}

/**
 * Flip every unread notification belonging to the signed-in user to read.
 * RLS already scopes by recipient_id, so we don't need to add it here.
 */
export async function markAllNotificationsRead(): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", user.id)
    .eq("read", false);
  if (error) {
    console.error("[markAllNotificationsRead]", error);
    return { ok: false, error: error.message };
  }
  revalidateNotificationPaths();
  return { ok: true };
}
