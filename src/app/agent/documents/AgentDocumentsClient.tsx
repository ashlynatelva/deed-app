"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DocBadge } from "@/components/ui/Badges";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { UploadDocumentModal, type UploadResult } from "@/components/shared/UploadDocumentModal";
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { DocumentTitle } from "@/components/shared/DocumentTitle";
import { uploadDocument, deleteDocument } from "@/lib/actions/documents";
import { fmtShort } from "@/lib/format";
import type { ClientDocument } from "@/lib/supabase/document-shape";

export type AgentDocumentRow = {
  txId: string;
  txAddress: string;
  doc: ClientDocument;
};

/**
 * Interactive shell for `/agent/documents`. Receives the materialized row
 * set from the parent server component; mutations route through Phase-E
 * server actions which revalidate the page automatically.
 */
export const AgentDocumentsClient = ({ rows }: { rows: AgentDocumentRow[] }) => {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [previewRow, setPreviewRow] = React.useState<AgentDocumentRow | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<AgentDocumentRow | null>(null);
  const toast = useToast();

  const needed = rows.filter((r) => r.doc.status === "needed").length;
  const internal = rows.filter((r) => r.doc.clientVisible === false).length;

  const onUpload = async (info: UploadResult) => {
    const fd = new FormData();
    fd.set("txId", info.txId);
    fd.set("docType", info.docType);
    fd.set("docCategory", info.docCategory);
    fd.set("who", "Agent");
    fd.set("uploadedByRole", "agent");
    fd.set("clientVisible", String(info.clientVisible));
    fd.set("file", info.file);
    const res = await uploadDocument(fd);
    if (res.ok) {
      toast.push(`Uploaded ${info.fileName} as ${info.docType}.`, "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const res = await deleteDocument(pendingDelete.doc.id);
    if (res.ok) {
      toast.push("Document deleted", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  return (
    <PageShell>
      <SectionTitle
        eyebrow="Compliance & files"
        title="Documents"
        right={
          <Button kind="primary" icon={<I.Upload size={14} />} onClick={() => setUploadOpen(true)}>
            Upload document
          </Button>
        }
      />

      {/* KPI tiles: stack at narrow widths, 3-col at desktop. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <Card>
          <div className="text-[12px] text-muted">Total documents</div>
          <div className="serif num text-[28px] mt-1">{rows.length}</div>
        </Card>
        <Card>
          <div className="text-[12px] text-muted">Awaiting from client / third-party</div>
          <div className="serif num text-[28px] mt-1" style={{ color: "var(--status-warn-fg)" }}>
            {needed}
          </div>
        </Card>
        <Card>
          <div className="text-[12px] text-muted">Internal-only (hidden from clients)</div>
          <div className="serif num text-[28px] mt-1">{internal}</div>
        </Card>
      </div>

      <Card padded={false}>
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[2.4fr_1.8fr_1fr_1fr_40px] px-5 py-3 text-[11px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC]">
          <div>Document</div>
          <div>Transaction</div>
          <div>Updated</div>
          <div>Status</div>
          <div />
        </div>

        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          return (
            <React.Fragment key={r.doc.id}>
              {/* Desktop row */}
              <div
                className="hidden md:grid grid-cols-[2.4fr_1.8fr_1fr_1fr_40px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <I.Doc size={14} className="text-muted shrink-0" />
                  <DocumentTitle onClick={() => setPreviewRow(r)}>{r.doc.name}</DocumentTitle>
                  {r.doc.clientVisible === false && (
                    <span
                      className="text-[10px] px-1.5 py-px rounded-full font-medium shrink-0"
                      style={{ background: "#F3F4F6", color: "var(--muted)" }}
                      title="Internal — hidden from client portal"
                    >
                      Internal
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <Link
                    href={`/agent/transactions/${r.txId}`}
                    className="text-[13px] text-charcoal hover:text-blue hover:underline underline-offset-2 truncate inline-flex items-center gap-1.5"
                  >
                    <I.Building size={12} className="text-muted" />
                    <span className="truncate">{r.txAddress}</span>
                  </Link>
                </div>

                <div className="text-[12.5px] text-muted">
                  {r.doc.updated ? fmtShort(r.doc.updated) : r.doc.due ? `Due ${fmtShort(r.doc.due)}` : "—"}
                </div>
                <div>
                  <DocBadge status={r.doc.status} />
                </div>

                <div className="flex justify-end">
                  <RowActionsMenu
                    ariaLabel={`Manage ${r.doc.name}`}
                    actions={[
                      { id: "preview", label: "Open preview", icon: "Eye",
                        onSelect: () => setPreviewRow(r) },
                      { id: "open-tx", label: "Open transaction", icon: "Building",
                        onSelect: () => { window.location.href = `/agent/transactions/${r.txId}`; } },
                      { id: "delete", label: "Delete document", icon: "Trash", destructive: true,
                        onSelect: () => setPendingDelete(r) },
                    ]}
                  />
                </div>
              </div>

              {/* Mobile card */}
              <div
                className="md:hidden flex items-start gap-3 px-4 py-3.5"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <I.Doc size={15} className="text-muted shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <DocumentTitle onClick={() => setPreviewRow(r)}>{r.doc.name}</DocumentTitle>
                    {r.doc.clientVisible === false && (
                      <span
                        className="text-[10px] px-1.5 py-px rounded-full font-medium"
                        style={{ background: "#F3F4F6", color: "var(--muted)" }}
                      >
                        Internal
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/agent/transactions/${r.txId}`}
                    className="text-[12px] text-muted truncate inline-flex items-center gap-1 mt-0.5"
                  >
                    <I.Building size={11} />
                    <span className="truncate">{r.txAddress}</span>
                  </Link>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <DocBadge status={r.doc.status} />
                    <span className="text-[11.5px] text-muted">
                      {r.doc.updated ? fmtShort(r.doc.updated) : r.doc.due ? `Due ${fmtShort(r.doc.due)}` : "—"}
                    </span>
                  </div>
                </div>
                <RowActionsMenu
                  ariaLabel={`Manage ${r.doc.name}`}
                  actions={[
                    { id: "preview", label: "Open preview", icon: "Eye",
                      onSelect: () => setPreviewRow(r) },
                    { id: "open-tx", label: "Open transaction", icon: "Building",
                      onSelect: () => { window.location.href = `/agent/transactions/${r.txId}`; } },
                    { id: "delete", label: "Delete document", icon: "Trash", destructive: true,
                      onSelect: () => setPendingDelete(r) },
                  ]}
                />
              </div>
            </React.Fragment>
          );
        })}

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            No documents yet. Upload one to get started.
          </div>
        )}
      </Card>

      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        mode="agent"
        onUpload={onUpload}
      />

      <DocumentPreviewModal
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        doc={previewRow?.doc ?? null}
        txAddress={previewRow?.txAddress}
      />

      <ConfirmDeleteModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this document?"
        body="This permanently removes the document and its file from storage."
        confirmLabel="Delete document"
        itemName={pendingDelete?.doc.name}
      />
    </PageShell>
  );
};
