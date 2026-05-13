"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { UploadDocumentModal } from "@/components/shared/UploadDocumentModal";
import { MockFormModal } from "@/components/shared/MockFormModal";
import { uploadDocument } from "@/lib/actions/documents";

export const TransactionDetailActions = ({ txId, clientName }: { txId: string; clientName: string }) => {
  const [upload, setUpload] = React.useState(false);
  const [message, setMessage] = React.useState(false);
  const toast = useToast();

  return (
    <div className="flex gap-2 shrink-0">
      <Button kind="secondary" icon={<I.Upload size={14} />} onClick={() => setUpload(true)}>
        Upload document
      </Button>
      <Button kind="primary" icon={<I.Mail size={14} />} onClick={() => setMessage(true)}>
        Message client
      </Button>

      <UploadDocumentModal
        open={upload}
        onClose={() => setUpload(false)}
        lockedTxId={txId}
        mode="agent"
        onUpload={async (info) => {
          const fd = new FormData();
          fd.set("txId", info.txId);
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
        }}
      />

      <MockFormModal
        open={message}
        onClose={() => setMessage(false)}
        title={`Message ${clientName.split(/\s|&/)[0]}`}
        submitLabel="Send"
        onSubmit={(v) => v.body && toast.push("Message sent.", "success")}
        fields={[
          { key: "subject", label: "Subject", placeholder: "Quick update on your file" },
          { key: "body",    label: "Message", type: "textarea", placeholder: "Hi — wanted to share an update on…" },
        ]}
      />
    </div>
  );
};
