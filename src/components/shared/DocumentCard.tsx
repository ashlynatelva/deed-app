import * as React from "react";
import { Card } from "@/components/ui/Card";
import { DocBadge } from "@/components/ui/Badges";
import { I } from "@/components/ui/Icon";
import { fmtShort } from "@/lib/format";
import type { TransactionDocument } from "@/lib/types";

export const DocumentCard = ({
  doc,
  variant = "agent",
}: {
  doc: TransactionDocument;
  /** Agent variant exposes who-owns-it metadata; client variant hides it. */
  variant?: "agent" | "client";
}) => (
  <Card padded={false} className="overflow-hidden">
    <div className="p-4 flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
        style={{ background: "rgba(15,23,42,.04)" }}
      >
        <I.Doc size={16} className="text-charcoal" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-ink leading-tight">{doc.name}</div>
        <div className="text-[11.5px] text-muted mt-1">
          {variant === "agent" ? (
            <>
              {doc.who === "Client" ? "From client" : doc.who === "Agent" ? "From you" : "Shared"}
              {" · "}
              {doc.updated ? `Updated ${fmtShort(doc.updated)}` : doc.due ? `Due ${fmtShort(doc.due)}` : "Pending"}
            </>
          ) : (
            <>{doc.updated ? `Last updated ${fmtShort(doc.updated)}` : doc.due ? `Needed by ${fmtShort(doc.due)}` : "Pending"}</>
          )}
        </div>
      </div>
      <DocBadge status={doc.status} />
    </div>
  </Card>
);
