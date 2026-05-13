import { getTransactionsForCurrentAgent } from "@/lib/supabase/queries";
import { mapTransactionRow } from "@/lib/supabase/transaction-shape";
import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./TransactionsClient";
import type { Tables } from "@/lib/supabase/database.types";

export default async function AgentTransactionsPage() {
  const supabase = await createClient();
  const txRows = await getTransactionsForCurrentAgent();

  // Batch-fetch client profiles for the row's `clientName` cell.
  const clientIds = Array.from(
    new Set(txRows.map((t) => t.client_id).filter((v): v is string => Boolean(v))),
  );
  let clientById = new Map<string, Tables<"profiles">>();
  if (clientIds.length > 0) {
    const { data } = await supabase.from("profiles").select("*").in("id", clientIds);
    clientById = new Map((data ?? []).map((p) => [p.id, p]));
  }

  const rows = txRows.map((tx) =>
    mapTransactionRow({ tx, client: clientById.get(tx.client_id ?? "") ?? null }),
  );

  return <TransactionsClient rows={rows} />;
}
