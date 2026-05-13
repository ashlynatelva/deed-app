"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/hooks/useBranding";
import {
  ACCENT_KEYS,
  ACCENT_PRESETS,
  DEFAULT_BRANDING,
  MAX_LOGO_BYTES,
  type BrandingSettings,
  type BrandingAccent,
} from "@/lib/store/branding";
import { BrandingPreview } from "./BrandingPreview";

/**
 * Real brokerage-customization workspace. Persists to the
 * `organizations.branding` jsonb column via `BrandingProvider` (Phase C+).
 * Every saved field flows back through the same context so every consumer
 * (sidebars, login wordmark, invite emails) re-reads in real time.
 */
export const BrandingSettingsPanel = () => {
  const { settings, set, reset } = useBranding();
  const [draft, setDraft] = React.useState<BrandingSettings>(settings);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const toast = useToast();
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  // Whenever the saved settings change (Save, Reset, cross-tab sync), pull
  // the new value into the draft so the form stays accurate. Render-time
  // check rather than an effect so React Compiler doesn't flag a cascading
  // setState — `settings` is a stable reference until the underlying store
  // actually changes.
  const [lastSettings, setLastSettings] = React.useState(settings);
  if (settings !== lastSettings) {
    setLastSettings(settings);
    setDraft(settings);
    setDirty(false);
  }

  const change = <K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleLogoFile = (file: File | null) => {
    if (!file) {
      change("logoDataUrl", undefined);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.push("Logo must be an image file.", "info");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.push("Logo too large. Keep it under 500 KB.", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => change("logoDataUrl", String(reader.result));
    reader.onerror = () => toast.push("Couldn't read that file.", "info");
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await set(draft);
      toast.push("Branding updated", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't save branding.";
      toast.push(msg, "info");
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await reset();
      toast.push("Reset to default branding", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't reset branding.";
      toast.push(msg, "info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6 items-start">
      {/* ─── Editor column ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <div>
          <div className="serif text-[18px] mb-1">Branding</div>
          <div className="text-[12.5px] text-muted">
            Customize how your brokerage appears to clients in their portal, invite emails,
            and the login screen.
          </div>
        </div>

        {/* Logo */}
        <Section title="Brokerage logo" hint="Max 500 KB. PNG, JPG, or SVG. Shown in the client portal sidebar, login screen, and invite emails.">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-md border border-hairline bg-[#FBFBFC] flex items-center justify-center overflow-hidden shrink-0">
              {draft.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoDataUrl} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <span
                  className="serif text-[22px]"
                  style={{ color: ACCENT_PRESETS[draft.accent].primary }}
                >
                  {(draft.brokerageName || "S").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoFile(e.target.files?.[0] ?? null)}
              />
              <Button
                kind="secondary"
                icon={<I.Upload size={13} />}
                onClick={() => logoInputRef.current?.click()}
              >
                {draft.logoDataUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {draft.logoDataUrl && (
                <Button kind="ghost" onClick={() => handleLogoFile(null)}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </Section>

        {/* Accent */}
        <Section title="Portal accent color" hint="Used for highlights, the logo background, and primary actions in the client portal.">
          <div className="grid grid-cols-4 gap-3">
            {ACCENT_KEYS.map((key) => (
              <AccentTile
                key={key}
                value={key}
                selected={draft.accent === key}
                onSelect={() => change("accent", key)}
              />
            ))}
          </div>
          <div className="text-[11.5px] text-muted mt-3">
            DEED offers a curated set of accents to keep every client portal feeling premium.
            Custom hex values aren&apos;t supported on purpose.
          </div>
        </Section>

        {/* Brokerage identity */}
        <Section title="Brokerage identity">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Brokerage / company name">
              <TextInput
                value={draft.brokerageName}
                onChange={(v) => change("brokerageName", v)}
                placeholder="Your Brokerage"
              />
            </Field>
            <Field label="Support phone">
              <TextInput
                value={draft.supportPhone}
                onChange={(v) => change("supportPhone", v)}
                placeholder="(617) 555-0101"
                inputMode="tel"
              />
            </Field>
            <Field label="Support email" wide>
              <TextInput
                value={draft.supportEmail}
                onChange={(v) => change("supportEmail", v)}
                placeholder="support@yourbrokerage.com"
                inputMode="email"
              />
            </Field>
          </div>
        </Section>

        {/* Portal messaging */}
        <Section title="Portal messaging">
          <Field
            label="Welcome headline"
            hint="The warm greeting at the top of the client portal. Use {firstName} to insert the client's first name."
          >
            <textarea
              value={draft.welcomeMessage}
              onChange={(e) => change("welcomeMessage", e.target.value)}
              rows={2}
              className={textareaClasses}
            />
          </Field>
          <Field
            label="Welcome subtext"
            hint="A calm, supporting line shown beneath the headline."
          >
            <textarea
              value={draft.welcomeSubtext}
              onChange={(e) => change("welcomeSubtext", e.target.value)}
              rows={2}
              className={textareaClasses}
            />
          </Field>
          <Field label="Invite email body" hint="Used in the portal-invite email sent to new clients.">
            <textarea
              value={draft.inviteEmailIntro}
              onChange={(e) => change("inviteEmailIntro", e.target.value)}
              rows={3}
              className={textareaClasses}
            />
          </Field>
          <Field label="Footer text" hint="Appears on the login screen.">
            <TextInput
              value={draft.footerText}
              onChange={(v) => change("footerText", v)}
              placeholder="© Your Brokerage · A calmer way to buy and sell homes."
            />
          </Field>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button kind="ghost" onClick={onReset} disabled={saving}>
            Reset to default branding
          </Button>
          <div className="flex gap-2">
            {dirty && (
              <span className="text-[11.5px] text-muted self-center">Unsaved changes</span>
            )}
            <Button kind="primary" onClick={onSave} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save branding changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Preview column ────────────────────────────────────────────── */}
      <BrandingPreview draft={draft} />
    </div>
  );
};

// ─── Internals ───────────────────────────────────────────────────────────────

const textareaClasses =
  "w-full p-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60 resize-y font-[inherit]";

const inputClasses =
  "w-full h-10 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60";

const TextInput = ({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) => (
  <input
    type="text"
    inputMode={inputMode}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={inputClasses}
  />
);

const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <Card>
    <div className="text-[13.5px] font-semibold text-ink">{title}</div>
    {hint && <div className="text-[12px] text-muted mt-1 mb-3.5 leading-[1.5]">{hint}</div>}
    {!hint && <div className="mb-3.5" />}
    {children}
  </Card>
);

const Field = ({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) => (
  <label className={cn("block", wide && "col-span-2", "mb-3.5 last:mb-0")}>
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    {children}
    {hint && <div className="text-[11.5px] text-muted mt-1.5 leading-[1.5]">{hint}</div>}
  </label>
);

const AccentTile = ({
  value,
  selected,
  onSelect,
}: {
  value: BrandingAccent;
  selected: boolean;
  onSelect: () => void;
}) => {
  const preset = ACCENT_PRESETS[value];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "border rounded-md p-3 text-left transition-all bg-white",
        selected ? "border-blue ring-2 ring-blue/30" : "border-hairline hover:border-[#d8dde3]",
      )}
    >
      <div
        className="w-full h-10 rounded-sm mb-2"
        style={{ background: preset.primary }}
      />
      <div className="text-[13px] font-medium text-ink">{preset.name}</div>
      <div className="text-[11px] text-muted mt-0.5 num">{preset.primary}</div>
    </button>
  );
};

/** Reference so other modules can show the default copy somewhere if needed. */
export const __DEFAULT_BRANDING = DEFAULT_BRANDING;
