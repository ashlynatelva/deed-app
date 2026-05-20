/**
 * Mapper: Supabase row shapes → the legacy `Transaction` type the prototype
 * pages were built against (`src/lib/types.ts`).
 *
 * The legacy type is camelCase and shaped around the original mock dataset:
 *   - `stages` is a `Record<StageKey, StageEntry>` keyed by stage name
 *   - `closing`, `clientId`, etc. are camelCase
 *   - `documents`, `notes`, `tasks` are nested arrays on the transaction
 *
 * Phase D only migrates transactions / stages / transaction_updates / tasks
 * to Supabase. Documents and notes (message threads) stay on the existing
 * client-side stores until Phases E and F. The mapper therefore takes those
 * as separate inputs so callers can supply mock-sourced values for now and
 * Supabase-sourced ones later without changing this signature.
 *
 * We keep the mapper deliberately lossy in one direction only: Supabase → UI.
 * Going the other way (UI → Supabase) is done at the call site, where the
 * concrete write is much smaller than a full transaction round-trip.
 */

import type {
  EnrichedTransaction,
  Profile,
  Stage,
  Transaction as TxRow,
} from "./queries";
import type {
  RepresentationKey,
  StageEntry,
  StageKey,
  StageState,
  Transaction as LegacyTransaction,
  TransactionDocument,
  TransactionNote,
  TransactionStatus,
  TransactionTask,
  TransactionUpdate,
} from "@/lib/types";

const STAGE_ORDER: StageKey[] = [
  "offer", "contract", "earnest", "inspection", "appraisal",
  "loan",  "ctc",      "walk",    "closing",
];

/**
 * Build the `stages` record the prototype expects. Missing rows fall back
 * to a synthetic state derived from the transaction's current `stage_key`
 * (mirrors the old `buildStages()` helper from the mock file).
 */
export function stagesToRecord(
  stages: Stage[],
  currentStageKey: StageKey,
): Record<StageKey, StageEntry> {
  const byKey = new Map<StageKey, Stage>(
    stages.map((s) => [s.stage_key as StageKey, s]),
  );
  const currentIdx = STAGE_ORDER.indexOf(currentStageKey);
  const out = {} as Record<StageKey, StageEntry>;

  STAGE_ORDER.forEach((key, i) => {
    const row = byKey.get(key);
    if (row) {
      out[key] = {
        state: row.state as StageState,
        due: row.due_date,
        done: row.done_date,
        note: row.note ?? "",
      };
    } else {
      // No row in DB yet — synthesize from position relative to current.
      out[key] = {
        state: i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
        due: null,
        done: null,
        note: "",
      };
    }
  });
  return out;
}

/**
 * Adapt a single enriched transaction to the legacy `Transaction` shape.
 * `documents`, `notes`, and `tasks` are passed in by the caller — the
 * mapper itself doesn't know about those tables yet.
 */
export function mapTransaction(input: {
  tx: EnrichedTransaction;
  documents?: TransactionDocument[];
  notes?: TransactionNote[];
  tasks?: TransactionTask[];
}): LegacyTransaction {
  const { tx, documents = [], notes = [], tasks = [] } = input;

  const updates: TransactionUpdate[] = tx.updates.map((u) => ({
    id: u.id,
    title: u.title,
    body: u.body ?? "",
    time: u.created_at,
    visible: u.visible,
  }));

  return {
    id: tx.id,
    address: tx.address,
    city: tx.city ?? "",
    price: tx.price ?? 0,
    rentalPrice: tx.rental_price ?? 0,
    clientType: (tx.client_type ?? "buyer") as LegacyTransaction["clientType"],
    clientId: tx.client_id ?? "",
    clientName: tx.client?.full_name ?? "Client (invite pending)",
    type: tx.type ?? "",
    representation: (tx.representation ?? "buyer_client") as RepresentationKey,
    stageKey: tx.stage_key as StageKey,
    closing: tx.closing ?? "",
    status: tx.status as TransactionStatus,
    agentId: tx.agent_id,
    listingAgent: tx.listing_agent ?? undefined,
    coAgent: tx.co_agent ?? undefined,
    stages: stagesToRecord(tx.stages, tx.stage_key as StageKey),
    documents,
    notes,
    updates,
    tasks,
  };
}

/**
 * Bulk adapter for list views (dashboard, transactions list). Stage and
 * update detail isn't needed for the table — we only fill the basics so
 * the row renders correctly. Pass the agent's profile so `clientName`
 * can be resolved without a per-row profile lookup.
 *
 * Note: `client` lookups happen via `clientById` passed in by the caller
 * (the agent dashboard fetches the client profile set in one batch).
 */
export function mapTransactionRow(input: {
  tx: TxRow;
  client: Profile | null;
}): LegacyTransaction {
  const { tx, client } = input;
  const stages = stagesToRecord([], tx.stage_key as StageKey);
  return {
    id: tx.id,
    address: tx.address,
    city: tx.city ?? "",
    price: tx.price ?? 0,
    rentalPrice: tx.rental_price ?? 0,
    clientType: (tx.client_type ?? "buyer") as LegacyTransaction["clientType"],
    clientId: tx.client_id ?? "",
    clientName: client?.full_name ?? "Client (invite pending)",
    type: tx.type ?? "",
    representation: (tx.representation ?? "buyer_client") as RepresentationKey,
    stageKey: tx.stage_key as StageKey,
    closing: tx.closing ?? "",
    status: tx.status as TransactionStatus,
    agentId: tx.agent_id,
    listingAgent: tx.listing_agent ?? undefined,
    coAgent: tx.co_agent ?? undefined,
    stages,
    documents: [],
    notes: [],
    updates: [],
    tasks: [],
  };
}
