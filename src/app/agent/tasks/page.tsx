"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { AddTaskModal } from "@/components/agent/AddTaskModal";
import { TaskDetailsPanel } from "@/components/agent/TaskDetailsPanel";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/mock/tasks";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTxLookup } from "@/lib/hooks/useTxLookup";
import { fmtShort, daysFromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

const statusToneMap: Record<string, { bg: string; fg: string; dot: string }> = {
  default: { bg: "#F3F4F6",                fg: "var(--muted)",            dot: "#9CA3AF" },
  info:    { bg: "var(--status-info-bg)",  fg: "var(--status-info-fg)",   dot: "#0284C7" },
  warn:    { bg: "var(--status-warn-bg)",  fg: "var(--status-warn-fg)",   dot: "#D97706" },
  ok:      { bg: "var(--status-ok-bg)",    fg: "var(--status-ok-fg)",     dot: "#10B981" },
};

const TaskStatusPill = ({ status }: { status: Task["status"] }) => {
  const meta = TASK_STATUSES.find((t) => t.key === status) ?? TASK_STATUSES[0];
  const tone = statusToneMap[meta.tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-medium px-2.5 py-0.5"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.dot }} />
      {meta.label}
    </span>
  );
};

const PriorityDot = ({ priority }: { priority: Task["priority"] }) => {
  const meta = TASK_PRIORITIES.find((p) => p.key === priority) ?? TASK_PRIORITIES[1];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: meta.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
};

type Filter = "all" | Task["status"];

export default function AgentTasksPage() {
  const { tasks, add, update, remove, toggleDone, error } = useTasks();
  const txLookup = useTxLookup();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);
  const toast = useToast();

  // Surface useTasks errors via the existing toast channel so persistence
  // failures (RLS, network) aren't silent.
  React.useEffect(() => {
    if (error) toast.push(error, "info");
  }, [error, toast]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: tasks.length },
    ...TASK_STATUSES.map((s) => ({
      id: s.key as Task["status"],
      label: s.label,
      count: tasks.filter((t) => t.status === s.key).length,
    })),
  ];

  const rows = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const detailsTask = detailsId ? tasks.find((t) => t.id === detailsId) ?? null : null;

  const addTask = async (input: Omit<Task, "id">) => {
    await add(input);
    toast.push("Task added.", "success");
  };

  const deleteTask = async (id: string) => {
    setDetailsId(null);
    await remove(id);
    toast.push("Task deleted.", "success");
  };

  return (
    <PageShell>
      <SectionTitle
        eyebrow="Work queue"
        title="Tasks"
        right={
          <div className="flex gap-2">
            <Button kind="secondary" icon={<I.Filter size={14} />} onClick={() => toast.comingSoon("Advanced filters")}>
              Filter
            </Button>
            <Button kind="primary" icon={<I.Plus size={14} />} onClick={() => setAddOpen(true)}>
              Add task
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 mb-4 p-1 bg-white border border-hairline rounded-[10px] w-fit max-w-full overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3.5 py-1.5 text-[12.5px] font-medium rounded-[7px] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap",
              filter === f.id ? "bg-navy text-white" : "text-charcoal hover:bg-[#F3F4F6]",
            )}
          >
            {f.label}
            <span className="text-[11px] opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <Card padded={false}>
        {/* Desktop header — hidden at mobile. */}
        <div className="hidden md:grid grid-cols-[36px_2.4fr_1.4fr_1fr_1fr_1.2fr_36px] px-5 py-3 text-[11px] uppercase tracking-[.08em] text-muted font-medium border-b border-hairline-2 bg-[#FBFBFC]">
          <div />
          <div>Task</div>
          <div>Transaction</div>
          <div>Due</div>
          <div>Priority</div>
          <div>Status</div>
          <div />
        </div>

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            No tasks match this filter.
          </div>
        )}

        {rows.map((t, i) => {
          const tx = txLookup.get(t.txId);
          const days = daysFromNow(t.due);
          const overdue = (days ?? 1) < 0 && t.status !== "done";
          const isDone = t.status === "done";
          const isLast = i === rows.length - 1;
          return (
            <React.Fragment key={t.id}>
              {/* Desktop row */}
              <div
                className="hidden md:grid grid-cols-[36px_2.4fr_1.4fr_1fr_1fr_1.2fr_36px] px-5 py-4 items-center"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                {/* Checkbox — toggles complete/incomplete only. */}
                <label className="flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleDone(t.id)}
                    aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
                    className="w-4 h-4 accent-blue cursor-pointer"
                  />
                </label>

                {/* Title — clickable, opens details. */}
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setDetailsId(t.id)}
                    className="text-left text-[13.5px] font-medium text-ink truncate hover:text-blue transition-colors"
                    style={{
                      textDecoration: isDone ? "line-through" : "none",
                      textDecorationColor: "rgba(15,23,42,.35)",
                      color: isDone ? "var(--muted)" : undefined,
                    }}
                  >
                    {t.title}
                  </button>
                  {t.notes && (
                    <div className="text-[11.5px] text-muted mt-0.5 truncate">{t.notes}</div>
                  )}
                </div>

                {/* Transaction — separate clickable link, not the whole row. */}
                <div className="text-[12.5px] text-charcoal truncate">
                  {tx ? (
                    <Link href={`/agent/transactions/${tx.id}`} className="hover:underline">
                      {tx.address}
                    </Link>
                  ) : (
                    "—"
                  )}
                </div>

                {/* Plain cells — no row-wide click. */}
                <div
                  className="num text-[12.5px]"
                  style={{ color: overdue ? "var(--status-risk-fg)" : "var(--charcoal)" }}
                >
                  {fmtShort(t.due)}
                  {overdue && (
                    <div className="text-[10.5px] uppercase tracking-[.08em] mt-0.5">Overdue</div>
                  )}
                </div>
                <PriorityDot priority={t.priority} />
                <TaskStatusPill status={t.status} />

                {/* Arrow — opens details. */}
                <button
                  type="button"
                  onClick={() => setDetailsId(t.id)}
                  aria-label="Open task details"
                  className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted hover:bg-[#F3F4F6] hover:text-ink transition-colors"
                >
                  <I.Chevron size={14} />
                </button>
              </div>

              {/* Mobile card */}
              <div
                className="md:hidden flex items-start gap-3 px-4 py-3.5"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--hairline-2)" }}
              >
                <label className="flex items-center justify-center cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleDone(t.id)}
                    aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
                    className="w-4 h-4 accent-blue cursor-pointer"
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setDetailsId(t.id)}
                    className="text-left text-[14px] font-medium text-ink leading-snug"
                    style={{
                      textDecoration: isDone ? "line-through" : "none",
                      textDecorationColor: "rgba(15,23,42,.35)",
                      color: isDone ? "var(--muted)" : undefined,
                    }}
                  >
                    {t.title}
                  </button>
                  {tx && (
                    <Link
                      href={`/agent/transactions/${tx.id}`}
                      className="block text-[12px] text-muted truncate mt-0.5 hover:underline"
                    >
                      {tx.address}
                    </Link>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <TaskStatusPill status={t.status} />
                    <PriorityDot priority={t.priority} />
                    <span
                      className="text-[11.5px] num"
                      style={{ color: overdue ? "var(--status-risk-fg)" : "var(--muted)" }}
                    >
                      {fmtShort(t.due)}{overdue && " · Overdue"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsId(t.id)}
                  aria-label="Open task details"
                  className="w-9 h-9 rounded-md inline-flex items-center justify-center text-muted active:bg-[#F3F4F6] transition-colors shrink-0"
                >
                  <I.Chevron size={14} />
                </button>
              </div>
            </React.Fragment>
          );
        })}
      </Card>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addTask} />

      <TaskDetailsPanel
        open={!!detailsTask}
        task={detailsTask}
        onClose={() => setDetailsId(null)}
        onChange={(patch) => detailsTask && update(detailsTask.id, patch)}
        onDelete={() => detailsTask && deleteTask(detailsTask.id)}
      />
    </PageShell>
  );
}
