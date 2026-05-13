"use client";

import * as React from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DocBadge } from "@/components/ui/Badges";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { UploadDocumentModal, type UploadResult } from "@/components/shared/UploadDocumentModal";
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal";
import { DocumentTitle } from "@/components/shared/DocumentTitle";
import {
  uploadDocument,
  replaceDocumentFile,
  deleteDocument,
} from "@/lib/actions/documents";
import { fmtShort } from "@/lib/format";
import type { ClientDocument } from "@/lib/supabase/document-shape";

type Props = {
  txId: string;
  txAddress?: string;
  docs: ClientDocument[];
};

/**
 * Agent-side documents card on the transaction detail page.
 *
 * Reads come from the parent server component (passed in as `docs`).
 * Writes route through Phase-E server actions, which call
 * `revalidatePath` to flush the parent — so the list re-renders without
 * needing local optimistic state.
 */
export const TransactionDocumentsCard = ({ txId, txAddress, docs }: Props) => {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [replaceTarget, setReplaceTarget] = React.useState<ClientDocument | null>(null);
  const [previewDoc, setPreviewDoc] = React.useState<ClientDocument | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ClientDocument | null>(null);
  const toast = useToast();

  const onUpload = async (info: UploadResult) => {
    if (replaceTarget) {
      const fd = new FormData();
      fd.set("docId", replaceTarget.id);
      fd.set("uploadedByRole", "agent");
      fd.set("file", info.file);
      const res = await replaceDocumentFile(fd);
      if (res.ok) {
        toast.push(`Replaced ${replaceTarget.name}.`, "success");
      } else {
        toast.push(res.error, "info");
      }
      setReplaceTarget(null);
      return;
    }

    const fd = new FormData();
    fd.set("txId", txId);
    fd.set("docType", info.docType);
    fd.set("who", "Agent");
    fd.set("uploadedByRole", "agent");
    fd.set("clientVisible", String(info.clientVisible));
    fd.set("file", info.file);
    const res = await uploadDocument(fd);
    if (res.ok) {
      toast.push(`Uploaded ${info.fileName}.`, "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const res = await deleteDocument(pendingDelete.id);
    if (res.ok) {
      toast.push("Document deleted", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  const needed = docs.filter((d) => d.status === "needed").length;

  return (
    <Card padded={false}>
      <CardHeader
        title="Documents"
        subtitle={`${docs.length} total · ${needed} needed`}
        right={
          <Button kind="secondary" size="sm" icon={<I.Upload size={12} />} onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        }
      />
      <div className="px-5 py-2">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto_40px] px-3 py-2 text-[10.5px] uppercase tracking-[.08em] text-muted">
          <div>Document</div>
          <div>Source</div>
          <div>Updated</div>
          <div>Status</div>
          <div />
        </div>

        {docs.map((d) => (
          <div
            key={d.id}
            className="grid grid-cols-[2fr_1fr_1fr_auto_40px] px-3 py-3 items-center hover:bg-[#FBFBFC] transition-colors"
            style={{ borderTop: "1px solid var(--hairline-2)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <I.Doc size={14} className="text-muted shrink-0" />
              <DocumentTitle onClick={() => setPreviewDoc(d)} size="sm">
                {d.name}
              </DocumentTitle>
              {d.clientVisible === false && (
                <span
                  className="text-[10px] px-1.5 py-px rounded-full font-medium shrink-0"
                  style={{ background: "#F3F4F6", color: "var(--muted)" }}
                  title="Internal — hidden from client portal"
                >
                  Internal
                </span>
              )}
            </div>
            <div className="text-[12.5px] text-charcoal">{d.who}</div>
            <div className="text-[12.5px] text-muted">
              {d.updated ? fmtShort(d.updated) : d.due ? `Due ${fmtShort(d.due)}` : "—"}
            </div>
            <DocBadge status={d.status} />
            <div className="flex justify-end">
              <RowActionsMenu
                ariaLabel={`Manage ${d.name}`}
                actions={[
                  { id: "preview", label: "Open preview", icon: "Eye",
                    onSelect: () => setPreviewDoc(d) },
                  { id: "replace", label: "Replace file", icon: "Upload",
                    onSelect: () => { setReplaceTarget(d); setUploadOpen(true); } },
                  { id: "delete", label: "Delete document", icon: "Trash", destructive: true,
                    onSelect: () => setPendingDelete(d) },
                ]}
              />
            </div>
          </div>
        ))}

        {docs.length === 0 && (
          <div className="px-3 py-6 text-[12.5px] text-muted text-center border-t border-hairline-2">
            No documents on this transaction yet.
          </div>
        )}
      </div>

      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setReplaceTarget(null);
        }}
        lockedTxId={txId}
        mode="agent"
        replaceTarget={replaceTarget ? { id: replaceTarget.id, name: replaceTarget.name } : null}
        onUpload={onUpload}
      />

      <DocumentPreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
        txAddress={txAddress}
      />

      <ConfirmDeleteModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this document?"
        body="This permanently removes the document and its file from storage."
        confirmLabel="Delete document"
        itemName={pendingDelete?.name}
      />
    </Card>
  );
};
