"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { I } from "@/components/ui/Icon";
import { useTxLookup } from "@/lib/hooks/useTxLookup";

/**
 * Result handed off to the parent when the user clicks "Upload" / "Replace
 * file". The caller is responsible for constructing the FormData and
 * invoking the appropriate server action.
 *
 * `file` is the actual File handle so the parent can POST it directly to
 * Supabase Storage via a server action — no more in-memory dataUrl.
 */
export type UploadResult = {
  file: File;
  fileName: string;
  fileType: string;
  fileSize: number;
  docType: string;
  txId: string;
  note: string;
  /** Whether the client portal should see this doc (agent mode only). */
  clientVisible: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** If supplied, the transaction field is pre-selected and hidden. */
  lockedTxId?: string;
  /** Who is uploading — controls defaults and field visibility. */
  mode?: "agent" | "client";
  /** When set, the modal acts as "replace" instead of "new upload". */
  replaceTarget?: { id: string; name: string } | null;
  /**
   * Called when the user confirms. The function may be async — the modal
   * keeps the busy state on until it resolves, then closes itself.
   */
  onUpload?: (info: UploadResult) => void | Promise<void>;
};

// Mirrors the bucket-level 50 MB ceiling set in migration 0003.
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const DOC_TYPES = [
  "Purchase & Sale Agreement",
  "Proof of Funds",
  "Pre-approval Letter",
  "Earnest Money Receipt",
  "Inspection Report",
  "Appraisal Report",
  "Homeowners Insurance Binder",
  "Bank Statement",
  "Settlement Statement",
  "Other",
];

export const UploadDocumentModal = ({
  open,
  onClose,
  lockedTxId,
  mode = "agent",
  replaceTarget = null,
  onUpload,
}: Props) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [docType, setDocType] = React.useState(replaceTarget?.name ?? "");
  const [txId, setTxId] = React.useState(lockedTxId ?? "");
  const [note, setNote] = React.useState("");
  const [clientVisible, setClientVisible] = React.useState(true);
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const txLookup = useTxLookup();
  const txOptions = React.useMemo(() => Array.from(txLookup.values()), [txLookup]);

  // Reset every time the modal opens. Render-time check so we don't
  // trigger the cascading-setState pattern the React Compiler flags.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFile(null);
      setDocType(replaceTarget?.name ?? "");
      setTxId(lockedTxId ?? "");
      setNote("");
      setClientVisible(true);
      setDragOver(false);
      setBusy(false);
    }
  }

  const pickFile = (f: File | undefined) => {
    if (f) setFile(f);
  };

  // For replace mode, doc type is fixed; for new uploads we require a selection.
  const isReplace = !!replaceTarget;
  const effectiveDocType = isReplace ? replaceTarget!.name : docType;
  const oversize = !!file && file.size > MAX_FILE_BYTES;
  const canSubmit = !!file && !oversize && (isReplace || !!effectiveDocType) && !!txId && !busy;

  const submit = async () => {
    if (!canSubmit || !file) return;
    setBusy(true);
    try {
      await onUpload?.({
        file,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        docType: effectiveDocType,
        txId,
        note,
        clientVisible,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReplace ? `Replace ${replaceTarget!.name}` : "Upload document"}
      subtitle={
        isReplace
          ? "Uploads to your transaction's secure storage. Status drops back to Submitted for re-review."
          : "Uploads to your transaction's secure storage."
      }
      size="lg"
      footer={
        <>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <Button kind="primary" onClick={submit} disabled={!canSubmit}>
            {busy ? "Uploading…" : isReplace ? "Replace file" : "Upload"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="rounded-[10px] text-center px-4 py-8 transition-colors cursor-pointer"
          style={{
            border: dragOver ? "1.5px dashed var(--blue)" : "1.5px dashed var(--hairline)",
            background: dragOver ? "rgba(2,128,144,.04)" : "#FBFBFC",
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? undefined)}
          />
          <div className="w-10 h-10 rounded-full bg-white border border-hairline inline-flex items-center justify-center mb-2.5">
            <I.Upload size={16} className="text-charcoal" />
          </div>
          <div className="text-[13.5px] font-medium">
            {file ? file.name : "Drop your file here"}
          </div>
          <div className="text-[12px] text-muted mt-1">
            {file ? "Click to replace" : <>or <span className="text-blue font-medium">browse</span></>}
          </div>
          {oversize && (
            <div
              className="mt-3 mx-auto max-w-[360px] text-[11.5px] text-left px-3 py-2 rounded-md"
              style={{ background: "var(--status-warn-bg)", color: "var(--status-warn-fg)" }}
            >
              File is larger than the 50&nbsp;MB upload cap. Compress or split the file and try again.
            </div>
          )}
        </div>

        {!lockedTxId && (
          <Field label="Transaction">
            <select
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              <option value="" disabled>Choose a transaction…</option>
              {txOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.address}</option>
              ))}
            </select>
          </Field>
        )}

        {!isReplace && (
          <Field label="Document type">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              <option value="" disabled>Choose a type…</option>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        )}

        {mode === "agent" && !isReplace && (
          <div className="flex items-center justify-between rounded-lg border border-hairline px-3.5 py-3 bg-white">
            <div>
              <div className="text-[13px] font-medium text-ink">Visible to client</div>
              <div className="text-[11.5px] text-muted mt-0.5">
                Off keeps this document internal — only you see it.
              </div>
            </div>
            <Toggle checked={clientVisible} onChange={setClientVisible} label="Visible to client" />
          </div>
        )}

        <Field label="Note (optional)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              mode === "client"
                ? "Anything your advisor should know"
                : "Internal context — not shown to the client"
            }
            className="w-full p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 resize-y"
          />
        </Field>
      </div>
    </Modal>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    {children}
  </label>
);
