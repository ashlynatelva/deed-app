"use client";

import * as React from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/mock/tasks";
import { useTxLookup } from "@/lib/hooks/useTxLookup";
import { fmtDate } from "@/lib/format";
import type { Task } from "@/lib/types";

type Props = {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onChange: (patch: Partial<Task>) => void;
  onDelete: () => void;
};

export const TaskDetailsPanel = ({ open, task, onClose, onChange, onDelete }: Props) => {
  // Hook must run before the early return — React rules of hooks.
  const txLookup = useTxLookup();
  if (!task) return null;
  const tx = txLookup.get(task.txId);
  const priority = TASK_PRIORITIES.find((p) => p.key === task.priority);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task.title}
      subtitle={tx?.address ?? "No linked transaction"}
      size="lg"
      footer={
        <>
          <Button kind="danger" onClick={onDelete} icon={<I.X size={12} />}>Delete</Button>
          <div className="flex-1" />
          <Button kind="secondary" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Status">
            <select
              value={task.status}
              onChange={(e) => onChange({ status: e.target.value as Task["status"] })}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={task.priority}
              onChange={(e) => onChange({ priority: e.target.value as Task["priority"] })}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Due">
            <input
              type="date"
              value={task.due}
              onChange={(e) => onChange({ due: e.target.value })}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            />
            <div className="text-[11.5px] text-muted mt-1.5">{fmtDate(task.due)}</div>
          </Field>
          <Field label="Assignee">
            <input
              value={task.assignee}
              onChange={(e) => onChange({ assignee: e.target.value })}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={task.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
            className="w-full p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 resize-y"
          />
        </Field>

        <div className="flex items-center justify-between py-3 border-t border-hairline-2">
          <div>
            <div className="text-[13px] font-medium">Reminder</div>
            <div className="text-[12px] text-muted">Email me the day before due date</div>
          </div>
          <Toggle checked={task.reminder} onChange={(v) => onChange({ reminder: v })} />
        </div>

        {tx && (
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted">
              Linked to <span className="text-charcoal" style={priority ? { color: priority.fg } : undefined}>{tx.address}</span>
            </span>
            <Link href={`/agent/transactions/${tx.id}`} className="text-blue font-medium hover:underline inline-flex items-center gap-1">
              Open transaction <I.Right size={11} />
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    {children}
  </label>
);
