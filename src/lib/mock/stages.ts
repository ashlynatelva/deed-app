import type { Stage } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// All stage keys, in display order. Ordering matters — the timeline
// component renders stages in array order, and the filter panel lists
// them in this sequence.
//
// Three workflow flavors live in one array:
//   1. Onboarding (pre-offer)   — listing/buyer onboarding
//   2. Sale (existing 9 stages) — offer → closing (with credit_repair
//      + frame slotted alongside)
//   3. Leasing                  — lease_signed, occupancy
//
// The bootstrap_transaction_stages trigger (migration 0021) seeds a
// WORKFLOW-SPECIFIC subset into `transaction_stages` per new
// transaction. Buyer txs get buyer_onboarding + offer→closing; seller
// txs get listing_onboarding + offer→closing; tenant txs get
// lease_signed + occupancy. So the timeline a given client sees stays
// focused on their own workflow even though this array is the full
// vocab.
// ─────────────────────────────────────────────────────────────────────────────

export const STAGES: Stage[] = [
  // Pre-offer onboarding
  { key: "listing_onboarding", label: "Listing onboarding" },
  { key: "buyer_onboarding",   label: "Buyer onboarding" },
  // Sale workflow
  { key: "offer",         label: "Offer sent" },
  { key: "contract",      label: "Under contract" },
  { key: "earnest",       label: "Earnest money" },
  { key: "inspection",    label: "Inspection" },
  { key: "appraisal",     label: "Appraisal" },
  { key: "loan",          label: "Loan approval" },
  { key: "credit_repair", label: "Credit repair" },
  { key: "ctc",           label: "Clear to close" },
  { key: "frame",         label: "Frame stage" },
  { key: "walk",          label: "Final walkthrough" },
  { key: "closing",       label: "Closing day" },
  // Leasing workflow
  { key: "lease_signed",  label: "Lease signed" },
  { key: "occupancy",     label: "Occupancy date" },
];

// Plain-language descriptions used in the client portal timeline.
export const STAGE_FRIENDLY: Record<string, string> = {
  // Sale workflow
  offer: "Your offer was prepared and sent to the seller.",
  contract: "The seller accepted — you're officially under contract.",
  earnest: "Your good-faith deposit was wired to escrow.",
  inspection: "A licensed inspector evaluated the property.",
  appraisal: "The lender's appraiser is verifying the home's value.",
  loan: "Your lender is finalizing your mortgage commitment.",
  ctc: "All conditions cleared — your loan is fully approved.",
  walk: "A final walk-through to confirm the home's condition.",
  closing: "Sign final paperwork and receive your keys.",
  // Phase N
  listing_onboarding: "Preparing your home and paperwork for the market.",
  buyer_onboarding: "Getting your file ready before we write your first offer.",
  credit_repair: "Working with you to improve credit standing for lender approval.",
  frame: "Construction has progressed through framing.",
  lease_signed: "Lease executed by all parties.",
  occupancy: "Move-in day — keys delivered.",
};

export const STATUS_LABEL: Record<string, string> = {
  on_track: "On track",
  needs_attention: "Needs attention",
  at_risk: "At risk",
};

export const DOC_LABEL: Record<string, string> = {
  // Existing five
  needed: "Needed",
  submitted: "Submitted",
  received: "Received",
  reviewed: "Reviewed",
  revision: "Needs revision",
  // Phase N — signing statuses
  awaiting_signature: "Awaiting signature",
  signed: "Signed",
  rejected: "Rejected",
  expired: "Expired",
};

// ─────────────────────────────────────────────────────────────────────────────
// Document categories — controlled vocab the upload modal writes to
// `documents.doc_category`. Legacy free-text `documents.doc_type`
// stays for back-compat on existing rows. New uploads always write a
// category; the dropdown defaults to "other" when the agent hasn't
// picked something more specific.
// ─────────────────────────────────────────────────────────────────────────────

export type DocCategoryKey =
  | "purchase_agreement"
  | "lease_agreement"
  | "loan_documents"
  | "inspection_reports"
  | "id_verification"
  | "hoa_docs"
  | "closing_disclosures"
  | "other";

export const DOC_CATEGORIES: { key: DocCategoryKey; label: string }[] = [
  { key: "purchase_agreement",  label: "Purchase agreement" },
  { key: "lease_agreement",     label: "Lease agreement" },
  { key: "loan_documents",      label: "Loan documents" },
  { key: "inspection_reports",  label: "Inspection reports" },
  { key: "id_verification",     label: "ID verification" },
  { key: "hoa_docs",            label: "HOA docs" },
  { key: "closing_disclosures", label: "Closing disclosures" },
  { key: "other",               label: "Other" },
];

export const DOC_CATEGORY_LABEL: Record<DocCategoryKey, string> =
  Object.fromEntries(DOC_CATEGORIES.map((c) => [c.key, c.label])) as Record<
    DocCategoryKey,
    string
  >;
