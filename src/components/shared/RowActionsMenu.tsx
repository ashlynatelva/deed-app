"use client";

import * as React from "react";
import { I, type IconKey } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type RowAction = {
  id: string;
  label: string;
  icon?: IconKey;
  destructive?: boolean;
  onSelect: () => void;
};

type Props = {
  actions: RowAction[];
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Visual style of the trigger. "kebab" = vertical dots, "trash" = inline trash glyph. */
  trigger?: "kebab" | "trash";
  /** Pop direction relative to the trigger. */
  align?: "right" | "left";
};

/**
 * Subtle kebab/trash menu used to host destructive actions on row items.
 * Designed to stay quiet until interacted with — no red in the resting state.
 */
export const RowActionsMenu = ({
  actions,
  ariaLabel = "Row actions",
  trigger = "kebab",
  align = "right",
}: Props) => {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Triggers and menu-items must stop click propagation so they don't trigger
  // any enclosing row link / row navigation behavior.
  const stop = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={wrapRef} className="relative inline-flex" onClick={stop}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { stop(e); setOpen((o) => !o); }}
        onPointerDown={stop}
        className={cn(
          "w-8 h-8 rounded-md inline-flex items-center justify-center transition-colors",
          open ? "bg-[#F3F4F6] text-ink" : "text-muted hover:bg-[#F3F4F6] hover:text-ink",
        )}
      >
        {trigger === "trash" ? <I.Trash size={14} /> : <I.MoreVert size={16} />}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            // `max-w-[calc(100vw-2rem)]` keeps the menu from punching past the
            // viewport edge on narrow phones; `min-w-[200px]` keeps the desktop
            // appearance unchanged.
            "absolute top-[calc(100%+4px)] z-30 min-w-[200px] max-w-[calc(100vw-2rem)] bg-white border border-hairline rounded-[10px] py-1 overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ boxShadow: "0 16px 48px -12px rgba(15,23,42,.22), 0 4px 12px rgba(15,23,42,.06)" }}
        >
          {actions.map((a) => {
            const Icon = a.icon ? I[a.icon] : null;
            return (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                onClick={(e) => { stop(e); setOpen(false); a.onSelect(); }}
                onPointerDown={stop}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors",
                  a.destructive
                    ? "text-[var(--status-risk-fg)] hover:bg-[#FEF2F2]"
                    : "text-ink hover:bg-[#F3F4F6]",
                )}
              >
                {Icon && <Icon size={14} className={a.destructive ? undefined : "text-muted"} />}
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
