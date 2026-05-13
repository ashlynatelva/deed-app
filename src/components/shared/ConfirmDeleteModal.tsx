"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  /** Optional item name echoed under the prompt for extra clarity. */
  itemName?: string;
};

/**
 * Soft, premium destructive confirmation. The accent stays inside the modal —
 * the surrounding UI shows no red until the user explicitly opens this.
 */
export const ConfirmDeleteModal = ({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  itemName,
}: Props) => (
  <Modal
    open={open}
    onClose={onClose}
    size="md"
    footer={
      <>
        <Button kind="secondary" onClick={onClose}>Cancel</Button>
        <Button kind="destructive" icon={<I.Trash size={13} />} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex gap-4 items-start">
      <div
        className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: "rgba(185,28,28,.08)" }}
      >
        <I.Warning size={18} style={{ color: "#B91C1C" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="serif text-[19px] tracking-[-0.01em] text-ink">{title}</div>
        <div className="text-[13.5px] text-charcoal leading-[1.55] mt-1.5">{body}</div>
        {itemName && (
          <div
            className="mt-3 px-3 py-2 text-[12.5px] text-charcoal rounded-md break-words"
            style={{ background: "#FBFBFC", border: "1px solid var(--hairline)" }}
          >
            {itemName}
          </div>
        )}
      </div>
    </div>
  </Modal>
);
