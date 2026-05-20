"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { UploadDocumentModal } from "@/components/shared/UploadDocumentModal";
import { MockFormModal } from "@/components/shared/MockFormModal";
import { EditTransactionModal } from "@/components/agent/EditTransactionModal";
import { uploadDocument } from "@/lib/actions/documents";

type Props = {
  txId: string;
  clientName: string;
  /**
   * Editable fields, seeded from the server-rendered detail page so the
   * Edit modal opens pre-filled without a fresh round trip.
   */
  edit: {
    address: string;
    city: string | null;
    price: number | null;
    /** Phase N — monthly rent in whole dollars; null for sale workflows. */
    rentalPrice: number | null;
    /** Phase N — workflow signal. */
    clientType: string | null;
    representation: string | null;
    stageKey: string;
    status: string;
    closing: string | null;
  };
};

/**
 * Header action cluster on the transaction detail page. Three actions:
 *
 *   1. Edit transaction — opens the same EditTransactionModal as the
 *      kebab menu on the transactions list. Pre-filled from the
 *      `edit` prop (passed in from the server-rendered page) so the
 *      modal opens instantly.
 *   2. Upload document — existing flow.
 *   3. Message client — existing flow.
 */
export const TransactionDetailActions = ({ txId, clientName, edit }: Props) => {
  const [editOpen, setEditOpen] = React.useState(false);
  const [upload, setUpload] = React.useState(false);
  const [message, setMessage] = React.useState(false);
  const toast = useToast();

  return (
    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
      <Button kind="secondary" icon={<I.Cog size={14} />} onClick={() => setEditOpen(true)}>
        Edit transaction
      </Button>
      <Button kind="secondary" icon={<I.Upload size={14} />} onClick={() => setUpload(true)}>
        Upload document
      </Button>
      <Button kind="primary" icon={<I.Mail size={14} />} onClick={() => setMessage(true)}>
        Message client
      </Button>

      <EditTransactionModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        transaction={editOpen ? { id: txId, ...edit } : null}
      />

      <UploadDocumentModal
        open={upload}
        onClose={() => setUpload(false)}
        lockedTxId={txId}
        mode="agent"
        onUpload={async (info) => {
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
