"use client";

import * as React from "react";
import { I } from "./Icon";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** "md" = 480px, "lg" = 640px, "xl" = 800px */
  size?: "md" | "lg" | "xl";
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

const sizeMap = { md: "max-w-[480px]", lg: "max-w-[640px]", xl: "max-w-[800px]" } as const;

export const Modal = ({ open, onClose, title, subtitle, size = "md", children, footer }: ModalProps) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      style={{ background: "rgba(15,23,42,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "w-full bg-white rounded-[12px] overflow-hidden flex flex-col max-h-[calc(100vh-80px)]",
          sizeMap[size],
        )}
        style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,.40), 0 6px 18px rgba(0,0,0,.15)" }}
      >
        {(title || subtitle) && (
          <div className="px-6 pt-5 pb-4 border-b border-hairline flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && <div className="serif text-[20px] tracking-[-0.01em]">{title}</div>}
              {subtitle && <div className="text-[12.5px] text-muted mt-1">{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center text-muted hover:bg-[#F3F4F6] hover:text-ink transition-colors"
            >
              <I.X size={14} />
            </button>
          </div>
        )}
        <div className="px-6 py-5 overflow-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-hairline bg-[#FBFBFC] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
