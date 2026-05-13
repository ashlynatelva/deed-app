"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { DocBadge } from "@/components/ui/Badges";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal";
import { DocumentTitle } from "@/components/shared/DocumentTitle";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { ClientUploadCard } from "@/components/client/ClientUploadCard";
import { canClientDelete } from "@/lib/document-utils";
import { deleteDocument } from "@/lib/actions/documents";
import { fmtShort } from "@/lib/format";
import type { ClientDocument } from "@/lib/supabase/document-shape";

type Props = {
  txId: string;
  txAddress: string;
  docs: ClientDocument[];
};

export const ClientDocumentsClient = ({ txId, txAddress, docs }: Props) => {
  const toast = useToast();
  const [preview, setPreview] = React.useState<ClientDocument | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ClientDocument | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const res = await deleteDocument(pendingDelete.id);
    if (res.ok) {
      toast.push("Document deleted", "success");
    } else {
      toast.push(res.error, "info");
    }
  };

  return (
    <PageShell width="client">
      <SectionTitle eyebrow="Your journey" title="Documents" />

      {/* Stacks at mobile: docs table first, upload card + legend below. */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-5">
        <Card padded={false}>
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto_36px] px-5 py-3 text-[11px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC]">
            <div>Document</div>
            <div>Updated</div>
            <div>Needed by</div>
            <div>Status</div>
            <div />
          </div>
          {docs.map((d, i) => {
            const deletable = canClientDelete(d);
            const isLast = i === docs.length - 1;
            return (
              <React.Fragment key={d.id}>
                {/* Desktop row */}
                <div
                  className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto_36px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <I.Doc size={14} className="text-muted shrink-0" />
                    <DocumentTitle onClick={() => setPreview(d)}>{d.name}</DocumentTitle>
                  </div>
                  <div className="text-[12.5px] text-muted">{d.updated ? fmtShort(d.updated) : "—"}</div>
                  <div className="text-[12.5px] text-muted">{d.due ? fmtShort(d.due) : "—"}</div>
                  <DocBadge status={d.status} />

                  <div className="flex justify-end">
                    {deletable && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(d)}
                        aria-label={`Delete ${d.name}`}
                        title="Delete this document"
                        className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted hover:text-[var(--status-risk-fg)] hover:bg-[#FEF2F2] transition-colors"
                      >
                        <I.Trash size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile card */}
                <div
                  className="md:hidden flex items-start gap-3 px-4 py-3.5"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <I.Doc size={15} className="text-muted shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <DocumentTitle onClick={() => setPreview(d)}>{d.name}</DocumentTitle>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11.5px] text-muted">
                      {d.updated && <span>Updated {fmtShort(d.updated)}</span>}
                      {d.due && <span>Needed by {fmtShort(d.due)}</span>}
                    </div>
                    <div className="mt-1.5">
                      <DocBadge status={d.status} />
                    </div>
                  </div>
                  {deletable && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(d)}
                      aria-label={`Delete ${d.name}`}
                      title="Delete this document"
                      className="w-9 h-9 rounded-md inline-flex items-center justify-center text-muted active:text-[var(--status-risk-fg)] active:bg-[#FEF2F2] transition-colors shrink-0"
                    >
                      <I.Trash size={15} />
                    </button>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          {docs.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-muted">
              No documents shared with you yet. Avery will post them here as your transaction progresses.
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <ClientUploadCard txId={txId} />

          <Card style={{ background: "#FBFBFC" }}>
            <div className="text-[12.5px] font-medium mb-1.5">Document statuses, explained</div>
            <div className="text-[12px] text-charcoal leading-[1.7]">
              <div className="flex items-center gap-2"><DocBadge status="needed" /> We&apos;re still waiting on this from you.</div>
              <div className="flex items-center gap-2 mt-1"><DocBadge status="submitted" /> Received — Avery is reviewing.</div>
              <div className="flex items-center gap-2 mt-1"><DocBadge status="reviewed" /> Approved and on file.</div>
              <div className="flex items-center gap-2 mt-1"><DocBadge status="revision" /> Small change needed; check the note.</div>
            </div>
            <div className="text-[11.5px] text-muted leading-[1.55] mt-3 pt-3 border-t border-hairline-2">
              You can delete documents you uploaded yourself, as long as they haven&apos;t been
              approved yet. To remove an approved or advisor-uploaded file, ask your advisor.
            </div>
          </Card>
        </div>
      </div>

      <DocumentPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        doc={preview}
        txAddress={txAddress}
      />

      <ConfirmDeleteModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this document?"
        body="This will remove the document from your portal. If this was uploaded by mistake, you can upload the correct file after deleting it."
        confirmLabel="Delete document"
        itemName={pendingDelete?.name}
      />
    </PageShell>
  );
};
