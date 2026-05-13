"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "select" | "date";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: FieldDef[];
  submitLabel?: string;
  /** Called with the filled values when the user submits. Use it to fire a toast/mutate mock state. */
  onSubmit: (values: Record<string, string>) => void;
  size?: "md" | "lg";
};

/**
 * Generic mock form modal — used wherever a button should "do something"
 * (capture input, fake-create a record, then close) without real persistence.
 * Resets state every time it opens.
 */
export const MockFormModal = ({ open, onClose, title, subtitle, fields, submitLabel = "Save", onSubmit, size = "lg" }: Props) => {
  const initial = React.useMemo(() => Object.fromEntries(fields.map((f) => [f.key, ""])), [fields]);
  const [values, setValues] = React.useState<Record<string, string>>(initial);

  // Reset on each open. Render-time check so we don't trigger the
  // cascading-setState pattern the React Compiler flags.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues(initial);
  }

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle ?? "Mock — saved to your local session state."}
      size={size}
      footer={
        <>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <Button kind="primary" onClick={() => { onSubmit(values); onClose(); }}>{submitLabel}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {fields.map((f) => {
          const span = f.type === "textarea" ? "col-span-2" : "col-span-1";
          return (
            <label key={f.key} className={`block ${span}`}>
              <div className="text-[11.5px] font-medium text-muted mb-1.5">{f.label}</div>
              {f.type === "textarea" ? (
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={4}
                  className="w-full p-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 resize-y"
                />
              ) : f.type === "select" ? (
                <select
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
                >
                  <option value="" disabled>{f.placeholder ?? "Choose…"}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type ?? "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full h-10 px-3 text-[13.5px] border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
                />
              )}
            </label>
          );
        })}
      </div>
    </Modal>
  );
};
