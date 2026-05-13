"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { UploadDocumentModal } from "@/components/shared/UploadDocumentModal";
import { uploadDocument } from "@/lib/actions/documents";
import { fmtDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import type { ClientDocument } from "@/lib/supabase/document-shape";

type Props = {
  tx: Transaction;
  /** Client-visible documents on this transaction (server-provided). */
  docs: ClientDocument[];
};

/**
 * The hero "what's next for you" callout on the client overview page.
 *
 * Looks across the client-visible document list for the first row in
 * `needed` status — that's the next concrete ask. If there's nothing
 * needed, falls through to the "all caught up" copy.
 */
export const NextStepCard = ({ tx, docs }: Props) => {
  const next = docs.find((d) => d.status === "needed");

  const [upload, setUpload] = React.useState(false);
  const [instructions, setInstructions] = React.useState(false);
  const toast = useToast();

  return (
    <Card style={{ borderLeft: "3px solid var(--brand-accent, var(--gold))" }}>
      <div className="text-[11px] uppercase tracking-[.12em] text-muted mb-2">
        What&apos;s next for you
      </div>
      {next ? (
        <>
          <div className="serif text-[22px] text-ink mb-2 tracking-[-0.01em]">
            Upload your {next.name.toLowerCase()}
          </div>
          <div className="text-[13.5px] text-charcoal leading-[1.55] mb-4">
            We need this from you by{" "}
            <span className="font-semibold">{fmtDate(next.due ?? null)}</span> to keep your closing on track.
            Avery has sent the exact wording you&apos;ll need.
          </div>
          <div className="flex gap-2 items-center">
            <Button kind="primary" icon={<I.Upload size={13} />} onClick={() => setUpload(true)}>
              Upload document
            </Button>
            <Button kind="ghost" onClick={() => setInstructions(true)}>
              View instructions
            </Button>
          </div>

          <UploadDocumentModal
            open={upload}
            onClose={() => setUpload(false)}
            lockedTxId={tx.id}
            mode="client"
            onUpload={async (info) => {
              const fd = new FormData();
              fd.set("txId", info.txId);
              fd.set("docType", info.docType || next.name);
              fd.set("who", "Client");
              fd.set("uploadedByRole", "client");
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

          <Modal
            open={instructions}
            onClose={() => setInstructions(false)}
            title={`How to provide your ${next.name.toLowerCase()}`}
            subtitle="Quick instructions from your advisor."
            size="md"
            footer={<Button kind="primary" onClick={() => setInstructions(false)}>Got it</Button>}
          >
            <div className="flex flex-col gap-3 text-[13.5px] text-charcoal leading-[1.6]">
              <p>
                Contact your insurance carrier and request a binder for{" "}
                <span className="font-medium">{tx.address}</span>, with these details:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>Coverage begins on the closing date: <span className="font-medium">{fmtDate(tx.closing)}</span>.</li>
                <li>List <span className="font-medium">First Beacon Mortgage</span> as mortgagee and additional insured.</li>
                <li>Provide a one-year paid receipt if your lender requires it.</li>
              </ul>
              <p className="text-muted">
                Once you receive the binder PDF, return here and tap &ldquo;Upload document&rdquo;.
              </p>
            </div>
          </Modal>
        </>
      ) : (
        <div className="serif text-[20px]">
          You&apos;re all caught up. Avery will be in touch with the next step.
        </div>
      )}
    </Card>
  );
};
