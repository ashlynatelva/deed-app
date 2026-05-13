import * as React from "react";
import { I } from "@/components/ui/Icon";
import { STAGES, STAGE_FRIENDLY } from "@/lib/mock/stages";
import { fmtShort } from "@/lib/format";
import type { StageEntry, StageKey, Transaction } from "@/lib/types";

type Variant = "client" | "agent";

type Props = {
  tx: Transaction;
  /** "client" uses the soft, plain-language copy; "agent" shows raw stage notes. */
  variant?: Variant;
  /** When true, render compact horizontal markers across the top. */
  compact?: boolean;
};

export const TransactionTimeline = ({ tx, variant = "client", compact = false }: Props) => {
  const idx = STAGES.findIndex((s) => s.key === tx.stageKey);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const data: StageEntry =
            tx.stages?.[s.key as StageKey] ?? {
              state: i < idx ? "done" : i === idx ? "current" : "upcoming",
              due: null,
              done: null,
              note: "",
            };
          const state = data.state;
          return (
            <React.Fragment key={s.key}>
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background:
                    state === "done"
                      ? "var(--navy)"
                      : state === "current"
                      ? "var(--brand-accent, var(--gold))"
                      : "var(--hairline)",
                }}
                title={s.label}
              />
              {i < STAGES.length - 1 && (
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      state === "done" ? "var(--navy)" : "var(--hairline)",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pt-2">
      {STAGES.map((s, i) => {
        const data: StageEntry =
          tx.stages?.[s.key as StageKey] ?? {
            state: i < idx ? "done" : i === idx ? "current" : "upcoming",
            due: null,
            done: null,
            note: "",
          };
        const state = data.state;
        const description =
          variant === "client" ? STAGE_FRIENDLY[s.key] : data.note || STAGE_FRIENDLY[s.key];
        return (
          <div
            key={s.key}
            className="grid grid-cols-[32px_1fr_auto] gap-4 items-start"
          >
            <div className="flex flex-col items-center pt-0.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: state === "done" ? "var(--navy)" : "#fff",
                  border:
                    state === "current"
                      ? "2px solid var(--brand-accent, var(--gold))"
                      : state === "done"
                      ? "none"
                      : "1.5px solid var(--hairline)",
                  boxShadow:
                    state === "current"
                      ? "0 0 0 5px var(--brand-accent-soft, rgba(201,168,76,.14))"
                      : "none",
                }}
              >
                {state === "done" && <I.Check size={13} stroke={2.4} className="text-white" />}
                {state === "current" && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--brand-accent, var(--gold))" }}
                  />
                )}
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className="w-px flex-1 min-h-[38px] mt-1"
                  style={{
                    background:
                      state === "done" ? "var(--navy)" : "var(--hairline)",
                  }}
                />
              )}
            </div>
            <div className="pb-5">
              <div
                className="text-[15px]"
                style={{
                  fontWeight: state === "current" ? 600 : 500,
                  color: state === "upcoming" ? "var(--muted)" : "var(--ink)",
                }}
              >
                {s.label}
              </div>
              {description && (
                <div className="text-[12.5px] text-muted mt-1 leading-[1.5] max-w-[460px]">
                  {description}
                </div>
              )}
              {state === "current" && data.note && variant === "client" && (
                <div
                  className="mt-2.5 px-3 py-2 text-[12.5px] text-charcoal rounded-md"
                  style={{
                    background: "var(--brand-accent-soft, rgba(201,168,76,.08))",
                    borderLeft: "2px solid var(--brand-accent, var(--gold))",
                  }}
                >
                  {data.note}
                </div>
              )}
            </div>
            <div className="text-right pt-1 min-w-[90px]">
              <div className="text-[11px] uppercase tracking-[.1em] text-muted">
                {state === "done"
                  ? "Completed"
                  : state === "current"
                  ? "In progress"
                  : "Expected"}
              </div>
              <div
                className="num text-[13px] mt-0.5"
                style={{ color: state === "upcoming" ? "var(--muted)" : "var(--charcoal)" }}
              >
                {state === "done" ? fmtShort(data.done) : fmtShort(data.due)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
