// Domain types for DEED. Shaped so they can later be backed by Supabase
// tables one-to-one (snake_case → camelCase mapping at the data layer).

export type StageKey =
  | "offer"
  | "contract"
  | "earnest"
  | "inspection"
  | "appraisal"
  | "loan"
  | "ctc"
  | "walk"
  | "closing";

export type TransactionStatus = "on_track" | "needs_attention" | "at_risk";

export type DocumentStatus =
  | "needed"
  | "submitted"
  | "received"
  | "reviewed"
  | "revision";

export type StageState = "done" | "current" | "upcoming";

export type RepresentationKey =
  | "buyer_client"
  | "buyer_customer"
  | "seller_client"
  | "seller_customer";

export type Stage = { key: StageKey; label: string };

export type StageEntry = {
  state: StageState;
  due: string | null;
  done: string | null;
  note: string;
};

export type TransactionDocument = {
  id: string;
  name: string;
  who: "Client" | "Agent" | "Both";
  status: DocumentStatus;
  updated: string | null;
  due?: string;

  // ─── Access & permission flags ─────────────────────────────────────────
  /** Whether the client can see this document in their portal. */
  clientVisible?: boolean;
  /**
   * Whether the client may remove this document themselves. Always paired
   * with `uploadedBy: "client"` — agent uploads and official seed records
   * are never removable from the client portal regardless of this flag.
   * Reviewed/approved docs are also locked.
   */
  removableByClient?: boolean;

  // ─── Demo-only file fields ─────────────────────────────────────────────
  // Populated when a user uploads through the prototype. Seed records (the
  // canned mock dataset) have no underlying file; their preview shows a
  // friendly "not retained in demo" message.
  /** Original filename as uploaded. */
  fileName?: string;
  /** MIME type, e.g. "image/png" or "application/pdf". */
  fileType?: string;
  /** File size in bytes. */
  fileSize?: number;
  /** Base64 data URL, used for in-browser preview + download. */
  dataUrl?: string;
  /** Which actor uploaded the latest version. */
  uploadedBy?: "agent" | "client";
};

export type TransactionNote = {
  id: string;
  from: "client" | "agent";
  title: string;
  body: string;
  time: string;
  state: "open" | "responded" | "resolved";
  reply?: { from: "agent" | "client"; body: string; time: string };
};

export type TransactionUpdate = {
  id: string;
  title: string;
  body: string;
  time: string;
  /** Whether the update is visible to the client (internal notes are agent-only). */
  visible: boolean;
};

export type TransactionTask = {
  id: string;
  name: string;
  due: string | null;
  state: "open" | "done";
};

export type Transaction = {
  id: string;
  address: string;
  city: string;
  price: number;
  clientId: string;
  clientName: string;
  type: string;
  representation: RepresentationKey;
  stageKey: StageKey;
  closing: string;
  status: TransactionStatus;
  agentId: string;
  listingAgent?: string;
  coAgent?: string;
  stages: Record<StageKey, StageEntry>;
  documents: TransactionDocument[];
  notes: TransactionNote[];
  updates: TransactionUpdate[];
  tasks: TransactionTask[];
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  txId: string;
  agentId: string;
  invited: boolean;
  active: boolean;
};

export type Agent = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

export type Task = {
  id: string;
  title: string;
  txId: string;
  assignee: string;
  due: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "progress" | "waiting" | "done";
  notes: string;
  reminder: boolean;
};

// ─── Shared messaging schema ────────────────────────────────────────────────
// One store, both roles. The agent inbox and the client portal read from the
// same `MessageThread[]` so a send on either side appears on the other.

export type Message = {
  id: string;
  senderRole: "agent" | "client";
  /** Display name captured at send time (so a later profile rename doesn't rewrite history). */
  senderName: string;
  body: string;
  /** ISO date when this message was sent (YYYY-MM-DD or full ISO). */
  createdAt: string;
  /** Per-role read receipts so each side can compute its own unread badge. */
  readByAgent: boolean;
  readByClient: boolean;
};

export type MessageThread = {
  threadId: string;
  transactionId: string;
  clientId: string;
  agentId: string;
  subject: string;
  /** Cached property label for the row header — e.g. "412 Linden Crescent". */
  relatedProperty: string;
  status: "needs_response" | "resolved";
  /** Chronological — oldest first. Never empty for a persisted thread. */
  messages: Message[];
};
