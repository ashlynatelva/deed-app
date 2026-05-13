/**
 * Mapper: Supabase `documents` row → the legacy `TransactionDocument` shape
 * the prototype pages were built against (`src/lib/types.ts`).
 *
 * Legacy shape uses:
 *   - `id`, `name`, `who`, `status` (same)
 *   - `updated` (DB has `updated_at`)
 *   - `due` (DB has `due_date`)
 *   - `clientVisible` (DB has `client_visible`)
 *   - `removableByClient` (DB has `removable_by_client`)
 *   - `uploadedBy` (DB has `uploaded_by_role`)
 *   - `fileName` / `fileType` / `fileSize` (DB has `file_name` / `file_type` / `file_size`)
 *   - `dataUrl` — gone. The new flow mints a signed URL on demand via the
 *     `getDocumentSignedUrl` action and stores nothing inline.
 *
 * We also carry `storagePath` through so the preview modal knows whether
 * an underlying file exists (vs. a metadata-only seed row).
 */

import type { DocumentRow } from "./queries";
import type { TransactionDocument } from "@/lib/types";

export type ClientDocument = TransactionDocument & {
  /** Set when the row has an actual file in storage. Null for seed rows. */
  storagePath: string | null;
};

/** ISO date-only when present, falling back to ISO timestamp. */
const toUpdatedString = (row: DocumentRow): string | null => {
  if (!row.updated_at) return null;
  // The DB column is a timestamptz; the legacy field is an ISO date (YYYY-MM-DD)
  // for display purposes. Take the date portion so `fmtShort` renders cleanly.
  return row.updated_at.slice(0, 10);
};

export function mapDocument(row: DocumentRow): ClientDocument {
  return {
    id: row.id,
    name: row.name,
    who: (row.who ?? "Agent") as TransactionDocument["who"],
    status: row.status,
    updated: toUpdatedString(row),
    due: row.due_date ?? undefined,
    clientVisible: row.client_visible,
    removableByClient: row.removable_by_client,
    uploadedBy: row.uploaded_by_role ?? undefined,
    fileName: row.file_name ?? undefined,
    fileType: row.file_type ?? undefined,
    fileSize: row.file_size ?? undefined,
    // `dataUrl` intentionally omitted — preview fetches a signed URL.
    storagePath: row.storage_path,
  };
}
