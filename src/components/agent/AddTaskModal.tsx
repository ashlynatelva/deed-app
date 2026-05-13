"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/mock/tasks";
import { useTxLookup } from "@/lib/hooks/useTxLookup";
import type { Task } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (t: Omit<Task, "id">) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export const AddTaskModal = ({ open, onClose, onCreate }: Props) => {
  const txLookup = useTxLookup();
  const txOptions = React.useMemo(
    () => Array.from(txLookup.values()),
    [txLookup],
  );
  const firstTxId = txOptions[0]?.id ?? "";

  const [title, setTitle] = React.useState("");
  const [txId, setTxId] = React.useState(firstTxId);
  const [assignee, setAssignee] = React.useState("Avery Chen");
  const [due, setDue] = React.useState(today());
  const [priority, setPriority] = React.useState<Task["priority"]>("medium");
  const [status, setStatus] = React.useState<Task["status"]>("todo");
  const [notes, setNotes] = React.useState("");
  const [reminder, setReminder] = React.useState(true);

  // Reset whenever the modal re-opens, so the form doesn't carry stale
  // state. Render-time check so we don't trigger the cascading-setState
  // pattern the React Compiler flags.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setTxId(firstTxId);
      setAssignee("Avery Chen");
      setDue(today());
      setPriority("medium");
      setStatus("todo");
      setNotes("");
      setReminder(true);
    }
  }

  const submit = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), txId, assignee, due, priority, status, notes, reminder });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add task"
      size="lg"
      footer={
        <>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <Button kind="primary" onClick={submit} disabled={!title.trim()}>Save task</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Task title">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Confirm wiring instructions with client"
            className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Transaction">
            <select
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              {txOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.address}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            />
          </Field>
          <Field label="Due">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            />
          </Field>
          <Field label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Task["status"])}
              className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Reminder">
            <label className="h-10 flex items-center gap-2 text-[13px] text-charcoal">
              <input
                type="checkbox"
                checked={reminder}
                onChange={(e) => setReminder(e.target.checked)}
                className="accent-blue"
              />
              Email me the day before
            </label>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional context for this task"
            className="w-full p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 resize-y"
          />
        </Field>
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
