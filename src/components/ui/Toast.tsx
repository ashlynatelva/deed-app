"use client";

import * as React from "react";
import { I } from "./Icon";

type ToastTone = "info" | "success" | "soon";
type ToastItem = { id: number; message: string; tone: ToastTone };

type ToastCtx = {
  push: (message: string, tone?: ToastTone) => void;
  comingSoon: (label?: string) => void;
};

const Ctx = React.createContext<ToastCtx | null>(null);

export const useToast = (): ToastCtx => {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const push = React.useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const comingSoon = React.useCallback(
    (label?: string) => push(label ? `${label} — coming soon.` : "Coming soon.", "soon"),
    [push],
  );

  const value = React.useMemo(() => ({ push, comingSoon }), [push, comingSoon]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto px-4 py-3 rounded-[10px] bg-white border border-hairline flex items-center gap-2.5 min-w-[260px] text-[13px]"
            style={{
              boxShadow: "0 12px 32px -12px rgba(15,23,42,.25), 0 4px 12px rgba(15,23,42,.06)",
              borderLeftWidth: 3,
              borderLeftColor:
                t.tone === "success"
                  ? "var(--status-ok-fg)"
                  : t.tone === "soon"
                  ? "var(--brand-accent, var(--gold))"
                  : "var(--blue)",
            }}
          >
            {t.tone === "success" ? (
              <I.Check size={14} stroke={2.4} style={{ color: "var(--status-ok-fg)" }} />
            ) : t.tone === "soon" ? (
              <I.Clock size={14} style={{ color: "#8a7426" }} />
            ) : (
              <I.Bell size={14} className="text-blue" />
            )}
            <span className="text-charcoal">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
};
