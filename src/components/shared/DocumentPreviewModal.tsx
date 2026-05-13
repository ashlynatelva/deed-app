"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DocBadge } from "@/components/ui/Badges";
import { I } from "@/components/ui/Icon";
import { fmtDate } from "@/lib/format";
import { getDocumentSignedUrl } from "@/lib/actions/documents";
import type { ClientDocument } from "@/lib/supabase/document-shape";

type Props = {
  open: boolean;
  onClose: () => void;
  doc: ClientDocument | null;
  /** Optional address/context shown under the header. */
  txAddress?: string;
};

const formatSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sourceLabel = (doc: ClientDocument): string => {
  if (doc.uploadedBy === "client") return "Uploaded by client";
  if (doc.uploadedBy === "agent") return "Uploaded by advisor";
  if (doc.who === "Client") return "From client";
  if (doc.who === "Agent") return "From advisor";
  return "Shared";
};

export const DocumentPreviewModal = ({ open, onClose, doc, txAddress }: Props) => {
  // Signed-URL state — fetched once per open when the row has a storage_path.
  // Pre-Phase-E seed rows have storage_path = null; we show the "no file"
  // affordance unchanged.
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [signedFileName, setSignedFileName] = React.useState<string | null>(null);
  const [signing, setSigning] = React.useState(false);
  const [signError, setSignError] = React.useState<string | null>(null);

  // Reset the URL state when the modal's target identity changes — done as
  // a render-time check rather than inside an effect so React Compiler
  // doesn't flag a cascading setState.
  const fetchKey = open && doc?.storagePath ? doc.id : null;
  const [lastFetchKey, setLastFetchKey] = React.useState<string | null>(null);
  if (fetchKey !== lastFetchKey) {
    setLastFetchKey(fetchKey);
    setSignedUrl(null);
    setSignedFileName(null);
    setSignError(null);
    setSigning(!!fetchKey);
  }

  React.useEffect(() => {
    if (!fetchKey || !doc) return;
    let cancelled = false;
    (async () => {
      const res = await getDocumentSignedUrl(doc.id);
      if (cancelled) return;
      if (res.ok) {
        setSignedUrl(res.data.url);
        setSignedFileName(res.data.fileName ?? doc.fileName ?? null);
      } else {
        setSignError(res.error);
        setSignedUrl(null);
      }
      setSigning(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKey, doc]);

  if (!doc) return null;

  const downloadName = signedFileName ?? doc.fileName ?? `${doc.name}.pdf`;
  const sizeLabel = formatSize(doc.fileSize);
  const mime = doc.fileType ?? "";
  const hasFile = !!doc.storagePath;

  let preview: React.ReactNode;
  if (!hasFile) {
    preview = (
      <Unavailable
        title="No file attached"
        body="This document was added as a placeholder — no underlying file has been uploaded yet. Upload one to see a live preview."
      />
    );
  } else if (signing) {
    preview = (
      <Unavailable
        title="Loading preview…"
        body="Fetching a secure link for this document."
      />
    );
  } else if (signError) {
    preview = (
      <Unavailable
        title="Couldn't load preview"
        body={signError}
      />
    );
  } else if (!signedUrl) {
    preview = (
      <Unavailable
        title="Preview unavailable"
        body="Try closing and re-opening this preview."
      />
    );
  } else if (mime.startsWith("image/")) {
    preview = (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={signedUrl}
        alt={doc.name}
        className="max-w-full max-h-[60vh] mx-auto rounded-md border border-hairline"
      />
    );
  } else if (mime === "application/pdf") {
    preview = (
      <iframe
        src={signedUrl}
        title={doc.name}
        className="w-full h-[60vh] rounded-md border border-hairline bg-white"
      />
    );
  } else {
    preview = (
      <Unavailable
        title="Preview not available for this file type"
        body="Download to view it in the appropriate app."
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <span className="text-[11.5px] text-muted mr-auto italic">
            Download links expire after 5 minutes for security.
          </span>
          <Button kind="secondary" onClick={onClose}>Close</Button>
          {signedUrl ? (
            <a
              href={signedUrl}
              download={downloadName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-9 px-[14px] text-[13px] font-medium rounded-lg border bg-navy text-white border-navy hover:bg-[#1c2540] transition-colors"
            >
              <I.Upload size={13} style={{ transform: "rotate(180deg)" }} />
              Download
            </a>
          ) : (
            <Button kind="dark" disabled icon={<I.Upload size={13} style={{ transform: "rotate(180deg)" }} />}>
              Download
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Header — name, source, date, status */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(15,23,42,.04)" }}
              >
                <I.Doc size={18} className="text-charcoal" />
              </div>
              <div className="min-w-0">
                <div className="serif text-[19px] text-ink tracking-[-0.01em] truncate">
                  {doc.name}
                </div>
                {txAddress && (
                  <div className="text-[12px] text-muted truncate">{txAddress}</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-[12px] text-muted">
              <span>{sourceLabel(doc)}</span>
              <span className="w-1 h-1 rounded-full bg-hairline" />
              <span>Updated {fmtDate(doc.updated)}</span>
              {sizeLabel && (
                <>
                  <span className="w-1 h-1 rounded-full bg-hairline" />
                  <span className="num">{sizeLabel}</span>
                </>
              )}
              {doc.fileName && doc.fileName !== doc.name && (
                <>
                  <span className="w-1 h-1 rounded-full bg-hairline" />
                  <span className="font-mono text-[11.5px]">{doc.fileName}</span>
                </>
              )}
            </div>
          </div>
          <DocBadge status={doc.status} />
        </div>

        {/* Preview area */}
        <div className="bg-[#FBFBFC] border border-hairline rounded-[10px] p-4">
          {preview}
        </div>
      </div>
    </Modal>
  );
};

const Unavailable = ({ title, body }: { title: string; body: string }) => (
  <div className="text-center py-12 px-4 max-w-md mx-auto">
    <div
      className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-3"
      style={{ background: "rgba(15,23,42,.05)" }}
    >
      <I.Eye size={18} className="text-muted" />
    </div>
    <div className="serif text-[15px] text-ink mb-1">{title}</div>
    <div className="text-[12.5px] text-muted leading-[1.55]">{body}</div>
  </div>
);
