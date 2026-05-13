"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DocBadge } from "@/components/ui/Badges";
import { I } from "@/components/ui/Icon";
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal";
import { DocumentTitle } from "@/components/shared/DocumentTitle";
import type { ClientDocument } from "@/lib/supabase/document-shape";

type Props = {
  txId: string;
  txAddress: string;
  /** Client-visible documents on the client's transaction. */
  docs: ClientDocument[];
};

/**
 * Client overview's "Documents" rail. Data is prop-driven from the parent
 * server component so the rail reflects the latest Supabase state on every
 * navigation / revalidation.
 *
 * `txId` is retained on the API for parity with the agent card; the rail
 * itself doesn't fetch anything client-side.
 */
export const ClientOverviewDocumentsCard = ({ txId, txAddress, docs }: Props) => {
  void txId;
  const top = docs.slice(0, 4);
  const needed = docs.filter((d) => d.status === "needed").length;

  const [preview, setPreview] = React.useState<ClientDocument | null>(null);

  return (
    <Card padded={false}>
      <CardHeader
        title="Documents"
        right={
          <Link href="/client/documents">
            <Button kind="ghost" size="sm">
              Open <I.Right size={11} />
            </Button>
          </Link>
        }
      />
      <div className="py-1">
        {top.length === 0 && (
          <div className="px-4 py-4 text-[12.5px] text-muted">
            No documents shared with you yet.
          </div>
        )}
        {top.map((d, i, arr) => (
          <div
            key={d.id}
            className="px-4 py-3 flex items-center gap-2.5 hover:bg-[#FBFBFC] transition-colors"
            style={{
              borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hairline-2)",
            }}
          >
            <I.Doc size={14} className="text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <DocumentTitle size="sm" onClick={() => setPreview(d)}>
                {d.name}
              </DocumentTitle>
            </div>
            <DocBadge status={d.status} />
          </div>
        ))}
      </div>
      {needed > 0 && (
        <div
          className="px-4 py-2.5 text-[12px] flex items-center gap-2"
          style={{
            background: "var(--status-warn-bg)",
            color: "var(--status-warn-fg)",
          }}
        >
          <I.Bell size={12} />{" "}
          {needed === 1
            ? "1 document is still on your list."
            : `${needed} documents are still on your list.`}
        </div>
      )}

      <DocumentPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        doc={preview}
        txAddress={txAddress}
      />
    </Card>
  );
};
