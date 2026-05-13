import type { Task } from "@/lib/types";

export const TASK_STATUSES = [
  { key: "todo",     label: "To do",             tone: "default" as const },
  { key: "progress", label: "In progress",       tone: "info"    as const },
  { key: "waiting",  label: "Waiting on client", tone: "warn"    as const },
  { key: "done",     label: "Completed",         tone: "ok"      as const },
];

export const TASK_PRIORITIES = [
  { key: "low",      label: "Low",      dot: "#A3A3A3", fg: "var(--muted)" },
  { key: "medium",   label: "Medium",   dot: "#0284C7", fg: "#075985" },
  { key: "high",     label: "High",     dot: "#D97706", fg: "#8a5a08" },
  { key: "critical", label: "Critical", dot: "#DC2626", fg: "#9B1C1C" },
];

export const TASKS: Task[] = [
  { id: "t-1", title: "Confirm appraiser parking access",   txId: "t1", assignee: "Avery Chen",  due: "2026-05-05", priority: "medium",   status: "progress", notes: "Building manager Joel — 415-555-0142.", reminder: true  },
  { id: "t-2", title: "Request HOA documents from seller",  txId: "t1", assignee: "Avery Chen",  due: "2026-05-10", priority: "high",     status: "waiting",  notes: "",                                       reminder: true  },
  { id: "t-3", title: "Send weekly update — Hall file",     txId: "t1", assignee: "Avery Chen",  due: "2026-05-02", priority: "low",      status: "done",     notes: "",                                       reminder: false },
  { id: "t-4", title: "Order title search — Linden Crescent", txId: "t2", assignee: "Daniel Park", due: "2026-04-30", priority: "high",   status: "progress", notes: "Beacon Title — file #BC-22841.",         reminder: true  },
  { id: "t-5", title: "Schedule pre-listing photography",   txId: "t4", assignee: "Avery Chen",  due: "2026-05-04", priority: "medium",   status: "todo",     notes: "",                                       reminder: false },
  { id: "t-6", title: "Review wire instructions w/ Marcus", txId: "t1", assignee: "Avery Chen",  due: "2026-05-16", priority: "critical", status: "todo",     notes: "Confirm on phone, not email.",           reminder: true  },
  { id: "t-7", title: "Follow up on Vance loan commitment", txId: "t3", assignee: "Avery Chen",  due: "2026-05-12", priority: "critical", status: "waiting",  notes: "Lender requesting updated employment letter.", reminder: true },
];
