"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { UploadDocumentModal } from "@/components/shared/UploadDocumentModal";
import { uploadDocument } from "@/lib/actions/documents";

export const ClientUploadCard = ({ txId }: { txId: string }) => {
  const [open, setOpen] = React.useState(false);
  const toast = useToast();

  return (
    <>
      <Card>
        <div className="serif text-[16px] mb-1">Need to send something?</div>
        <div className="text-[12.5px] text-muted mb-3.5">
          Drag a file in or browse to upload.
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-[10px] text-center py-7 px-4 cursor-pointer hover:bg-white transition-colors"
          style={{
            border: "1.5px dashed var(--hairline)",
            background: "#FBFBFC",
          }}
        >
          <div className="w-[38px] h-[38px] rounded-full bg-white border border-hairline inline-flex items-center justify-center mb-2.5">
            <I.Upload size={15} className="text-charcoal" />
          </div>
          <div className="text-[13px] font-medium">Drop your file here</div>
          <div className="text-[11.5px] text-muted mt-1">
            or <span className="text-blue font-medium">browse</span>
          </div>
        </button>
      </Card>

      <UploadDocumentModal
        open={open}
        onClose={() => setOpen(false)}
        lockedTxId={txId}
        mode="client"
        onUpload={async (info) => {
          const fd = new FormData();
          fd.set("txId", info.txId);
          fd.set("docType", info.docType);
          fd.set("who", "Client");
          fd.set("uploadedByRole", "client");
          // Client uploads are always visible to both sides; toggle hidden in
          // client mode in the modal so we don't even take a value from it.
          fd.set("clientVisible", "true");
          fd.set("file", info.file);
          const res = await uploadDocument(fd);
          if (res.ok) {
            toast.push(`Uploaded ${info.fileName}. Avery will review.`, "success");
          } else {
            toast.push(res.error, "info");
          }
        }}
      />
    </>
  );
};
