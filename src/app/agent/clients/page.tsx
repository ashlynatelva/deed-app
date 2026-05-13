import {
  getClientsForCurrentAgent,
  getTransactionsForCurrentAgent,
  getPendingInvitesForCurrentAgent,
} from "@/lib/supabase/queries";
import {
  ClientsClient,
  type ClientRow,
  type PendingInviteRow,
  type ClientsRow,
} from "./ClientsClient";

export default async function AgentClientsPage() {
  const [clients, txs, invites] = await Promise.all([
    getClientsForCurrentAgent(),
    getTransactionsForCurrentAgent(),
    getPendingInvitesForCurrentAgent(),
  ]);

  // Build the share URL the agent can copy from the row's action menu.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  const txByIdLookup = new Map(txs.map((t) => [t.id, t]));

  // Seated clients
  const clientRows: ClientRow[] = clients.map(({ profile, transaction }) => ({
    kind: "client",
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone ?? "—",
    txId: transaction?.id ?? "",
    txAddress: transaction?.address ?? "—",
  }));

  // Pending invites (rendered in the same table). The query already
  // scopes to target_role='client' and the 0017 check constraint
  // guarantees client invites have a non-null transaction_id, so we
  // narrow with a runtime filter for the TS compiler.
  const inviteRows: PendingInviteRow[] = invites
    .filter((inv): inv is typeof inv & { transaction_id: string } =>
      inv.transaction_id !== null,
    )
    .map((inv) => ({
      kind: "pending",
      inviteId: inv.id,
      name: inv.full_name,
      email: inv.email,
      txId: inv.transaction_id,
      txAddress: txByIdLookup.get(inv.transaction_id)?.address ?? "—",
      shareUrl: `${base}/invite/${inv.token}`,
      createdAt: inv.created_at,
    }));

  // Pending invites first (they need action), then seated clients.
  const rows: ClientsRow[] = [...inviteRows, ...clientRows];

  const txOptions = txs.map((t) => ({ value: t.id, label: t.address }));

  return <ClientsClient rows={rows} txOptions={txOptions} />;
}
