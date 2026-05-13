"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { InviteClientModal } from "@/components/agent/InviteClientModal";
import { NewTransactionModal } from "@/components/agent/NewTransactionModal";
import { useTxLookup } from "@/lib/hooks/useTxLookup";

export const DashboardHeaderActions = () => {
  const [newTx, setNewTx] = React.useState(false);
  const [invite, setInvite] = React.useState(false);
  const txLookup = useTxLookup();
  const txOptions = React.useMemo(
    () => Array.from(txLookup.values()).map((t) => ({ value: t.id, label: t.address })),
    [txLookup],
  );

  return (
    <div className="flex gap-2">
      <Button kind="secondary" icon={<I.Plus size={14} />} onClick={() => setNewTx(true)}>
        New transaction
      </Button>
      <Button kind="primary" icon={<I.Mail size={14} />} onClick={() => setInvite(true)}>
        Send portal invite
      </Button>

      <NewTransactionModal open={newTx} onClose={() => setNewTx(false)} />

      <InviteClientModal
        open={invite}
        onClose={() => setInvite(false)}
        txOptions={txOptions}
      />
    </div>
  );
};
