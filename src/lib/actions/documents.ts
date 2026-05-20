"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { DocumentStatus } from "@/lib/supabase/database.types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase E — Documents + Storage server actions.
//
// All file IO crosses through these actions so we can:
//   1. Keep the Supabase service-role key off the client.
//   2. Run the user's auth session against RLS for both the table write
//      and the storage object write — defense in depth.
//   3. Mint short-lived signed URLs for preview/download without the
//      bucket needing to be public.
//
// Path convention (matches 0003 / 0008 storage RLS):
//   org_<org_id>/tx_<transaction_id>/<document_id>/<file_name>
//
// Failure recovery: documents row is inserted first to mint a UUID. If the
// storage upload then fails, we delete the row to avoid orphan metadata.
// The reverse (orphan storage object, no row) only happens if a delete
// race occurs — the org-prefix gate still keeps the file out of reach.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = "documents";

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);

const buildPath = (orgId: string, txId: string, docId: string, fileName: string): string =>
  `org_${orgId}/tx_${txId}/${docId}/${sanitizeFilename(fileName)}`;

const revalidateDocPaths = (txId: string) => {
  revalidatePath("/agent/documents");
  revalidatePath("/client/documents");
  revalidatePath(`/agent/transactions/${txId}`);
  revalidatePath("/client/overview");
};

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Upload ─────────────────────────────────────────────────────────────────

export type UploadFormPayload = {
  txId: string;
  docType: string;
  who: "Client" | "Agent" | "Both";
  uploadedByRole: "agent" | "client";
  clientVisible: boolean;
  file: File;
};

/**
 * Create a new documents row + push the file bytes to Supabase Storage.
 *
 * Server action accepts a `FormData` so the File can travel inline; the
 * client side composes the FormData. Returns the new document id on success.
 */
export async function uploadDocument(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Resolve org from the user's profile — we need it for the storage path.
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };

  const txId = String(formData.get("txId") ?? "");
  const docType = String(formData.get("docType") ?? "");
  // Phase N — controlled-vocab category. Validated against the same
  // allow-list the CHECK constraint enforces in the DB; anything
  // unrecognized falls back to 'other'.
  const rawDocCategory = String(formData.get("docCategory") ?? "other");
  const VALID_CATEGORIES = [
    "purchase_agreement", "lease_agreement", "loan_documents",
    "inspection_reports", "id_verification", "hoa_docs",
    "closing_disclosures", "other",
  ] as const;
  const docCategory = (VALID_CATEGORIES as readonly string[]).includes(rawDocCategory)
    ? (rawDocCategory as typeof VALID_CATEGORIES[number])
    : "other";
  const who = String(formData.get("who") ?? "Agent") as "Client" | "Agent" | "Both";
  const uploadedByRole = String(formData.get("uploadedByRole") ?? "agent") as "agent" | "client";
  const clientVisible = formData.get("clientVisible") === "true";
  const file = formData.get("file");

  if (!txId)                            return { ok: false, error: "Missing transaction." };
  if (!docType)                         return { ok: false, error: "Missing document type." };
  if (!(file instanceof File))          return { ok: false, error: "Missing file." };
  if (file.size === 0)                  return { ok: false, error: "File is empty." };
  if (file.size > 50 * 1024 * 1024)     return { ok: false, error: "File exceeds the 50 MB limit." };

  // 1. Insert the row first so we have an id for the storage path.
  // Status follows the prototype's convention: client uploads start as
  // 'submitted' (pending agent review); agent uploads start as 'received'.
  const initialStatus: DocumentStatus =
    uploadedByRole === "client" ? "submitted" : "received";

  const { data: inserted, error: insertErr } = await supabase
    .from("documents")
    .insert({
      transaction_id: txId,
      name: docType,
      doc_type: docType,
      doc_category: docCategory,
      who,
      status: initialStatus,
      client_visible: clientVisible,
      // Client uploads stay removable until the agent reviews/approves them.
      // Agent uploads are never client-removable.
      removable_by_client: uploadedByRole === "client",
      uploaded_by: user.id,
      uploaded_by_role: uploadedByRole,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
    })
    .select()
    .single();
  if (insertErr || !inserted) {
    console.error("[uploadDocument] insert failed", insertErr);
    return { ok: false, error: insertErr?.message ?? "Could not record document." };
  }

  // 2. Upload the bytes.
  const path = buildPath(profile.organization_id, txId, inserted.id, file.name);
  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) {
    console.error("[uploadDocument] storage upload failed", uploadErr);
    // Roll back the row so we don't leave orphan metadata.
    await supabase.from("documents").delete().eq("id", inserted.id);
    return { ok: false, error: uploadErr.message };
  }

  // 3. Stamp the path on the row.
  const { error: pathErr } = await supabase
    .from("documents")
    .update({ storage_path: path })
    .eq("id", inserted.id);
  if (pathErr) {
    console.error("[uploadDocument] storage_path update failed", pathErr);
    // The file exists; the row exists but is missing its path. Try to
    // clean both up so the next attempt starts fresh.
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    await supabase.from("documents").delete().eq("id", inserted.id);
    return { ok: false, error: pathErr.message };
  }

  revalidateDocPaths(txId);
  return { ok: true, data: { id: inserted.id } };
}

// ─── Replace file on existing doc ───────────────────────────────────────────

/**
 * Replace the file backing an existing document row. The row keeps its id,
 * name, and visibility flags; status drops back to `submitted` so the
 * agent re-reviews the new copy.
 */
export async function replaceDocumentFile(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found." };

  const docId = String(formData.get("docId") ?? "");
  const uploadedByRole = String(formData.get("uploadedByRole") ?? "agent") as "agent" | "client";
  const file = formData.get("file");
  if (!docId)                  return { ok: false, error: "Missing document id." };
  if (!(file instanceof File)) return { ok: false, error: "Missing file." };
  if (file.size === 0)         return { ok: false, error: "File is empty." };
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: "File exceeds the 50 MB limit." };

  // Read the existing row so we know which tx + previous path to clean up.
  const { data: existing, error: readErr } = await supabase
    .from("documents")
    .select("id, transaction_id, storage_path")
    .eq("id", docId)
    .maybeSingle();
  if (readErr || !existing) {
    return { ok: false, error: readErr?.message ?? "Document not found." };
  }

  const newPath = buildPath(profile.organization_id, existing.transaction_id, docId, file.name);

  // Upload (force overwrite if the path collides on the same filename).
  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(newPath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  // Update the row.
  const { error: updateErr } = await supabase
    .from("documents")
    .update({
      storage_path: newPath,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      status: "submitted",
      uploaded_by: user.id,
      uploaded_by_role: uploadedByRole,
    })
    .eq("id", docId);
  if (updateErr) {
    // Best-effort cleanup of the just-uploaded file.
    await supabase.storage.from(STORAGE_BUCKET).remove([newPath]);
    return { ok: false, error: updateErr.message };
  }

  // Delete the old object if it differs from the new path.
  if (existing.storage_path && existing.storage_path !== newPath) {
    await supabase.storage.from(STORAGE_BUCKET).remove([existing.storage_path]);
  }

  revalidateDocPaths(existing.transaction_id);
  return { ok: true, data: undefined };
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteDocument(docId: string): Promise<Result> {
  const supabase = await createClient();

  // Read first so we can clean up storage + know which tx to revalidate.
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select("id, transaction_id, storage_path")
    .eq("id", docId)
    .maybeSingle();
  if (readErr || !doc) {
    return { ok: false, error: readErr?.message ?? "Document not found." };
  }

  // Delete the row first — RLS gates this. If it succeeds, the user has
  // permission to remove the underlying object too.
  const { error: deleteErr } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  if (doc.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
  }

  revalidateDocPaths(doc.transaction_id);
  return { ok: true, data: undefined };
}

// ─── Signed URL for preview/download ────────────────────────────────────────

/**
 * Mint a short-lived signed URL the browser can use to fetch the file.
 * The `SELECT` on `documents` is gated by RLS, so an unauthorized user
 * can't even discover the storage path — making this safe to expose
 * directly from a client component.
 */
export async function getDocumentSignedUrl(
  docId: string,
): Promise<Result<{ url: string; fileName: string | null; fileType: string | null }>> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, storage_path, file_name, file_type")
    .eq("id", docId)
    .maybeSingle();
  if (error || !doc) {
    return { ok: false, error: error?.message ?? "Document not found." };
  }
  if (!doc.storage_path) {
    return { ok: false, error: "No file attached to this document." };
  }

  const { data, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 5); // 5 minutes
  if (signErr || !data) {
    return { ok: false, error: signErr?.message ?? "Could not sign URL." };
  }

  return {
    ok: true,
    data: {
      url: data.signedUrl,
      fileName: doc.file_name,
      fileType: doc.file_type,
    },
  };
}

// ─── Status / visibility tweaks ────────────────────────────────────────────

/**
 * Agents can mark a client upload as reviewed (locks it from client
 * deletion) or move it through other status states. We expose the small
 * surface the UI actually needs.
 */
export async function setDocumentStatus(
  docId: string,
  status: DocumentStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select("transaction_id")
    .eq("id", docId)
    .maybeSingle();
  if (readErr || !doc) return { ok: false, error: readErr?.message ?? "Not found." };

  const patch: { status: DocumentStatus; removable_by_client?: boolean } = { status };
  // Once an agent reviews a doc, lock it from client deletion.
  if (status === "reviewed") patch.removable_by_client = false;

  const { error: updateErr } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", docId);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidateDocPaths(doc.transaction_id);
  return { ok: true, data: undefined };
}
