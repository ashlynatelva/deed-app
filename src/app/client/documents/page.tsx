import { notFound } from "next/navigation";

import {
  getTransactionForCurrentClient,
  getClientVisibleDocumentsForTransaction,
} from "@/lib/supabase/queries";
import { mapDocument } from "@/lib/supabase/document-shape";
import { ClientDocumentsClient } from "./ClientDocumentsClient";

export default async function ClientDocumentsPage() {
  const tx = await getTransactionForCurrentClient();
  if (!tx) notFound();

  const rows = await getClientVisibleDocumentsForTransaction(tx.id);
  const docs = rows.map(mapDocument);

  return <ClientDocumentsClient txId={tx.id} txAddress={tx.address} docs={docs} />;
}
