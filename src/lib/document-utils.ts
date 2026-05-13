import type { TransactionDocument } from "@/lib/types";

/**
 * Permission gate for the client portal's delete control. The trash icon
 * renders only when ALL three conditions are met:
 *
 *   1. The client uploaded the document themselves (`uploadedBy === "client"`).
 *      Agent uploads and seed/official documents are always locked.
 *   2. The document is shared with the client (`clientVisible === true`).
 *      Internal/compliance docs aren't even rendered in the client portal,
 *      but the gate is explicit so this can't be bypassed.
 *   3. The document is flagged as removable (`removableByClient === true`).
 *      The Phase E `setDocumentStatus` action flips this to `false` once an
 *      agent marks the document `reviewed`, locking deletion at the data
 *      layer to match the UI gate.
 *
 * Mirrored by the documents RLS policy in 0007 — the delete will also be
 * rejected server-side if any condition isn't met, so this is just the
 * UI affordance.
 */
export const canClientDelete = (doc: TransactionDocument): boolean => {
  if (doc.uploadedBy !== "client") return false;
  if (doc.clientVisible !== true) return false;
  if (doc.removableByClient !== true) return false;
  return true;
};
