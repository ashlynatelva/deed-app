"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { InviteClientModal } from "@/components/agent/InviteClientModal";
import { revokeInvite } from "@/lib/actions/invites";
import { revokeClientPortalAccess, deleteClient } from "@/lib/actions/clients";

export type ClientRow = {
  kind: "client";
  id: string;
  name: string;
  email: string;
  phone: string;
  txId: string;
  txAddress: string;
};

export type PendingInviteRow = {
  kind: "pending";
  inviteId: string;
  name: string;
  email: string;
  txId: string;
  txAddress: string;
  shareUrl: string;
  createdAt: string;
};

export type ClientsRow = ClientRow | PendingInviteRow;

export type TxOption = { value: string; label: string };

/**
 * Clients page shell. Renders two kinds of rows in the same table:
 *   - Seated clients (profiles already exist, transactions linked).
 *   - Pending invites (a row in `public.invites` with status='pending'
 *     awaiting acceptance).
 *
 * Both share the same column layout so the Portal column tells the
 * story at a glance: "Active" vs "Pending invite".
 */
export const ClientsClient = ({
  rows: initial,
  txOptions,
}: {
  rows: ClientsRow[];
  txOptions: TxOption[];
}) => {
  const [rows, setRows] = React.useState<ClientsRow[]>(initial);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  // Three lifecycle modals, one each for a distinct action. Kept on
  // separate state slots so a stuck modal can't interfere with a fresh
  // user choice.
  const [pendingRevokeAccess, setPendingRevokeAccess] = React.useState<ClientRow | null>(null);
  const [pendingDeleteClient, setPendingDeleteClient] = React.useState<ClientRow | null>(null);
  const [pendingRevokeInvite, setPendingRevokeInvite] = React.useState<PendingInviteRow | null>(null);
  const toast = useToast();

  // Resync when the server payload identity changes (revalidation after
  // a server action). Render-time check rather than effect-driven so the
  // React Compiler doesn't flag a cascading setState.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setRows(initial);
  }

  const confirmRevokeAccess = async () => {
    if (!pendingRevokeAccess) return;
    // Optimistically remove from the visible list — the server action also
    // revalidates so the next render is authoritative even if optimism
    // fails. Roll back on error.
    const previous = rows;
    setRows((prev) => prev.filter((r) => !(r.kind === "client" && r.id === pendingRevokeAccess.id)));
    const res = await revokeClientPortalAccess(pendingRevokeAccess.id);
    if (res.ok) {
      toast.push(`Removed ${pendingRevokeAccess.name.split(/\s|&/)[0]}'s portal access.`, "success");
    } else {
      setRows(previous);
      toast.push(res.error, "info");
    }
  };

  const confirmDeleteClient = async () => {
    if (!pendingDeleteClient) return;
    // Same optimistic-remove pattern as revoke-access. The server action's
    // revalidatePath calls reconcile the visible list authoritatively on
    // the next render.
    const previous = rows;
    setRows((prev) => prev.filter((r) => !(r.kind === "client" && r.id === pendingDeleteClient.id)));
    const res = await deleteClient(pendingDeleteClient.id);
    if (res.ok) {
      toast.push("Client deleted", "success");
    } else {
      setRows(previous);
      toast.push(res.error, "info");
    }
  };

  const confirmRevokeInvite = async () => {
    if (!pendingRevokeInvite) return;
    const res = await revokeInvite(pendingRevokeInvite.inviteId);
    if (res.ok) toast.push("Invite revoked.", "success");
    else        toast.push(res.error, "info");
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.push("Invite link copied to clipboard.", "success");
    } catch {
      toast.push("Could not copy link — select and copy manually.", "info");
    }
  };

  return (
    <PageShell>
      <SectionTitle
        eyebrow="People"
        title="Clients"
        right={
          <Button kind="primary" icon={<I.Plus size={14} />} onClick={() => setInviteOpen(true)}>
            Add client
          </Button>
        }
      />

      <Card padded={false}>
        {/* Desktop header — hidden at mobile. */}
        <div className="hidden md:grid grid-cols-[2fr_2fr_1.4fr_1.6fr_1.1fr_40px] px-5 py-3 text-[11px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC]">
          <div>Client</div>
          <div>Email</div>
          <div>Phone</div>
          <div>Transaction</div>
          <div>Portal</div>
          <div />
        </div>
        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          if (r.kind === "client") {
            return (
              <React.Fragment key={r.id}>
                {/* Desktop row (≥ md). Identical to the original grid. */}
                <div
                  className="hidden md:grid relative grid-cols-[2fr_2fr_1.4fr_1.6fr_1.1fr_40px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <Link
                    href={`/agent/transactions/${r.txId}`}
                    className="contents"
                    aria-label={`Open ${r.name}'s transaction`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={r.name} size={32} />
                      <div className="text-[13.5px] font-medium truncate">{r.name}</div>
                    </div>
                    <div className="text-[13px] text-charcoal truncate">{r.email}</div>
                    <div className="num text-[13px] text-charcoal">{r.phone}</div>
                    <div className="text-[13px] text-ink truncate">{r.txAddress}</div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--status-ok-fg)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
                        Active
                      </span>
                    </div>
                  </Link>

                  <div className="flex justify-end">
                    <RowActionsMenu
                      ariaLabel={`Manage ${r.name}`}
                      actions={[
                        { id: "view",   label: "View transaction",     icon: "Eye",   onSelect: () => { window.location.href = `/agent/transactions/${r.txId}`; } },
                        { id: "revoke", label: "Remove portal access", icon: "Lock",  onSelect: () => setPendingRevokeAccess(r) },
                        { id: "delete", label: "Delete client",        icon: "Trash", destructive: true, onSelect: () => setPendingDeleteClient(r) },
                      ]}
                    />
                  </div>
                </div>

                {/* Mobile card (< md). Stacks the client's name+avatar,
                    contact info, transaction, and status pill on one
                    tap-friendly tile with the row menu inline. */}
                <div
                  className="md:hidden flex items-start gap-3 px-4 py-3.5"
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
                >
                  <Link
                    href={`/agent/transactions/${r.txId}`}
                    className="flex-1 min-w-0 flex items-start gap-3 active:bg-[#FBFBFC] -m-1 p-1 rounded"
                  >
                    <Avatar name={r.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-ink truncate">{r.name}</div>
                      <div className="text-[12px] text-muted truncate">{r.email}</div>
                      <div className="text-[12px] text-muted truncate mt-0.5">{r.txAddress}</div>
                      <div className="mt-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 text-[11.5px]"
                          style={{ color: "var(--status-ok-fg)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
                          Active portal
                        </span>
                      </div>
                    </div>
                  </Link>
                  <RowActionsMenu
                    ariaLabel={`Manage ${r.name}`}
                    actions={[
                      { id: "view",   label: "View transaction",     icon: "Eye",   onSelect: () => { window.location.href = `/agent/transactions/${r.txId}`; } },
                      { id: "revoke", label: "Remove portal access", icon: "Lock",  onSelect: () => setPendingRevokeAccess(r) },
                      { id: "delete", label: "Delete client",        icon: "Trash", destructive: true, onSelect: () => setPendingDeleteClient(r) },
                    ]}
                  />
                </div>
              </React.Fragment>
            );
          }
          // Pending invite row
          return (
            <React.Fragment key={r.inviteId}>
              {/* Desktop row */}
              <div
                className="hidden md:grid relative grid-cols-[2fr_2fr_1.4fr_1.6fr_1.1fr_40px] px-5 py-4 items-center hover:bg-[#FBFBFC] transition-colors"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={r.name} size={32} tone="light" />
                  <div className="text-[13.5px] font-medium truncate">{r.name}</div>
                </div>
                <div className="text-[13px] text-charcoal truncate">{r.email}</div>
                <div className="text-[12.5px] text-muted">—</div>
                <div className="text-[13px] text-ink truncate">{r.txAddress}</div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px]"
                    style={{ color: "var(--status-warn-fg)" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--status-warn-fg)" }}
                    />
                    Pending invite
                  </span>
                </div>

                <div className="flex justify-end">
                  <RowActionsMenu
                    ariaLabel={`Manage invite for ${r.name}`}
                    actions={[
                      { id: "copy",   label: "Copy invite link", icon: "Upload",
                        onSelect: () => copyLink(r.shareUrl) },
                      { id: "revoke", label: "Revoke invite",    icon: "Trash", destructive: true,
                        onSelect: () => setPendingRevokeInvite(r) },
                    ]}
                  />
                </div>
              </div>

              {/* Mobile card */}
              <div
                className="md:hidden flex items-start gap-3 px-4 py-3.5"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <Avatar name={r.name} size={36} tone="light" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink truncate">{r.name}</div>
                  <div className="text-[12px] text-muted truncate">{r.email}</div>
                  <div className="text-[12px] text-muted truncate mt-0.5">{r.txAddress}</div>
                  <div className="mt-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11.5px]"
                      style={{ color: "var(--status-warn-fg)" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--status-warn-fg)" }}
                      />
                      Pending invite
                    </span>
                  </div>
                </div>
                <RowActionsMenu
                  ariaLabel={`Manage invite for ${r.name}`}
                  actions={[
                    { id: "copy",   label: "Copy invite link", icon: "Upload",
                      onSelect: () => copyLink(r.shareUrl) },
                    { id: "revoke", label: "Revoke invite",    icon: "Trash", destructive: true,
                      onSelect: () => setPendingRevokeInvite(r) },
                  ]}
                />
              </div>
            </React.Fragment>
          );
        })}

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            No clients yet. Add your first client to get started.
          </div>
        )}
      </Card>

      <InviteClientModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        txOptions={txOptions}
      />

      <ConfirmDeleteModal
        open={!!pendingRevokeAccess}
        onClose={() => setPendingRevokeAccess(null)}
        onConfirm={confirmRevokeAccess}
        title="Remove this client's portal access?"
        body="They'll no longer be able to sign in. Their transaction history, documents, and messages are preserved for your records — only access is revoked."
        confirmLabel="Remove access"
        itemName={pendingRevokeAccess?.name}
      />

      <ConfirmDeleteModal
        open={!!pendingDeleteClient}
        onClose={() => setPendingDeleteClient(null)}
        onConfirm={confirmDeleteClient}
        title="Delete this client?"
        body="This will remove the client from your active workspace and block portal access. Transaction history will remain preserved for audit purposes."
        confirmLabel="Delete client"
        itemName={pendingDeleteClient?.name}
      />

      <ConfirmDeleteModal
        open={!!pendingRevokeInvite}
        onClose={() => setPendingRevokeInvite(null)}
        onConfirm={confirmRevokeInvite}
        title="Revoke this invite?"
        body="The share link will stop working immediately. You can send a fresh invite afterwards."
        confirmLabel="Revoke invite"
        itemName={pendingRevokeInvite?.name}
      />
    </PageShell>
  );
};
