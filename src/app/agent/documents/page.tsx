import { getAllDocumentsForCurrentAgent } from "@/lib/supabase/queries";
import { mapDocument } from "@/lib/supabase/document-shape";
import { AgentDocumentsClient, type AgentDocumentRow } from "./AgentDocumentsClient";

export default async function AgentDocumentsPage() {
  const items = await getAllDocumentsForCurrentAgent();

  const rows: AgentDocumentRow[] = items.map(({ doc, transaction }) => ({
    txId: transaction.id,
    txAddress: transaction.address,
    doc: mapDocument(doc),
  }));

  return <AgentDocumentsClient rows={rows} />;
}
