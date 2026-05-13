import type { Stage } from "@/lib/types";

export const STAGES: Stage[] = [
  { key: "offer", label: "Offer sent" },
  { key: "contract", label: "Under contract" },
  { key: "earnest", label: "Earnest money" },
  { key: "inspection", label: "Inspection" },
  { key: "appraisal", label: "Appraisal" },
  { key: "loan", label: "Loan approval" },
  { key: "ctc", label: "Clear to close" },
  { key: "walk", label: "Final walkthrough" },
  { key: "closing", label: "Closing day" },
];

// Plain-language descriptions used in the client portal timeline.
export const STAGE_FRIENDLY: Record<string, string> = {
  offer: "Your offer was prepared and sent to the seller.",
  contract: "The seller accepted — you're officially under contract.",
  earnest: "Your good-faith deposit was wired to escrow.",
  inspection: "A licensed inspector evaluated the property.",
  appraisal: "The lender's appraiser is verifying the home's value.",
  loan: "Your lender is finalizing your mortgage commitment.",
  ctc: "All conditions cleared — your loan is fully approved.",
  walk: "A final walk-through to confirm the home's condition.",
  closing: "Sign final paperwork and receive your keys.",
};

export const STATUS_LABEL: Record<string, string> = {
  on_track: "On track",
  needs_attention: "Needs attention",
  at_risk: "At risk",
};

export const DOC_LABEL: Record<string, string> = {
  needed: "Needed",
  submitted: "Submitted",
  received: "Received",
  reviewed: "Reviewed",
  revision: "Needs revision",
};
