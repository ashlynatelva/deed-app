"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { advanceStage } from "@/app/agent/transactions/[id]/actions";
import { STAGES } from "@/lib/mock/stages";
import type { StageKey } from "@/lib/types";

/**
 * Marks the transaction's current stage complete and advances to the next.
 * Backed by the `advanceStage` server action, which updates the stage rows
 * and lets the migration-0001 trigger fan out a transaction_update and
 * notifications to both parties.
 *
 * Hidden when the transaction is already at 'closing' — there's no stage
 * beyond it in the pipeline.
 */
export const AdvanceStageButton = ({
  txId,
  currentStage,
}: {
  txId: string;
  currentStage: StageKey;
}) => {
  const [pending, startTransition] = React.useTransition();
  const toast = useToast();

  const idx = STAGES.findIndex((s) => s.key === currentStage);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  const nextLabel = STAGES[idx + 1].label;

  const onClick = () => {
    startTransition(async () => {
      const res = await advanceStage(txId);
      if (res.ok) {
        toast.push(`Advanced to ${STAGES.find((s) => s.key === res.nextKey)?.label ?? "next stage"}.`, "success");
      } else {
        toast.push(res.error, "info");
      }
    });
  };

  return (
    <Button
      kind="secondary"
      icon={<I.Check size={14} />}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Advancing…" : `Mark complete → ${nextLabel}`}
    </Button>
  );
};
