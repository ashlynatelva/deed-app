// Static presentational constants that never moved to the database —
// pipeline stage labels + plain-language descriptions, task status/priority
// pill metadata. Kept under `mock/` for historical continuity even though
// these are intentionally code-shipped rather than backend-driven.
export * from "./stages";
export * from "./tasks";
