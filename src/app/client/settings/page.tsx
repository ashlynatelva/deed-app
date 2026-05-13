"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Toggle } from "@/components/ui/Toggle";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useToast } from "@/components/ui/Toast";
import { PageShell } from "@/components/shared/PageShell";
import { SettingsTabs, type SettingsTab } from "@/components/shared/SettingsTabs";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { deriveInitials } from "@/lib/profile-utils";

const TABS: SettingsTab[] = [
  { id: "profile",       label: "Profile",       icon: "User" },
  { id: "notifications", label: "Notifications", icon: "Bell" },
];

type NotifKey = "updates" | "documents" | "closing";

type Draft = { full_name: string; email: string; phone: string };

export default function ClientSettingsPage() {
  const { profile, update } = useCurrentProfile();

  // Local form draft, kept separate from the persisted profile so Cancel
  // can revert without polluting the rest of the portal. Resyncs whenever
  // the persisted profile changes externally.
  const [draft, setDraft] = React.useState<Draft>({
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone ?? "",
  });
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Resync the local draft when the persisted profile identity changes
  // (e.g. after a successful save). Render-time check rather than an
  // effect so React Compiler doesn't flag a cascading setState.
  const [lastProfile, setLastProfile] = React.useState(profile);
  if (profile !== lastProfile) {
    setLastProfile(profile);
    setDraft({
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone ?? "",
    });
    setDirty(false);
  }

  const [active, setActive] = React.useState("profile");
  const [notifs, setNotifs] = React.useState<Record<NotifKey, boolean>>({
    updates: true,
    documents: true,
    closing: true,
  });
  const toast = useToast();

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Trim before persisting so accidental whitespace doesn't bleed into
      // the top nav / greeting. Empty fullName falls back to the previous
      // value so the avatar disc never renders blank.
      await update({
        full_name: draft.full_name.trim() || profile.full_name,
        email: draft.email.trim() || profile.email,
        phone: draft.phone.trim() || null,
      });
      toast.push("Profile saved.", "success");
    } catch (err) {
      console.error("[client/settings] save failed:", err);
      const msg = err instanceof Error ? err.message : "Couldn't save profile.";
      toast.push(msg, "info");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setDraft({
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone ?? "",
    });
    setDirty(false);
  };

  const previewInitials = deriveInitials(draft.full_name);

  return (
    <PageShell width="client">
      <SectionTitle eyebrow="Your account" title="Settings" />

      {/* Tabs sit above content at mobile, stay as a 220px left rail
          at desktop. */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 md:gap-6">
        <SettingsTabs tabs={TABS} active={active} onChange={setActive} />

        <Card>
          {active === "profile" && (
            <div>
              <div className="serif text-[18px] mb-1">Profile</div>
              <div className="text-[12.5px] text-muted mb-5">
                We use this to keep you updated about your transaction. Changes appear across your portal once you save.
              </div>
              <div className="flex items-center gap-4 mb-5">
                <Avatar
                  name={draft.full_name}
                  initials={previewInitials}
                  size={56}
                  tone="light"
                />
                <div>
                  <div className="text-[14px] font-semibold">{draft.full_name || "—"}</div>
                  <div className="text-[12px] text-muted">Client</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full name" value={draft.full_name} onChange={(v) => change("full_name", v)} />
                <Field label="Email"     value={draft.email}     onChange={(v) => change("email", v)} />
                <Field label="Phone"     value={draft.phone}     onChange={(v) => change("phone", v)} />
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                {dirty && (
                  <span className="text-[11.5px] text-muted">Unsaved changes</span>
                )}
                <Button kind="secondary" onClick={onCancel} disabled={!dirty || saving}>
                  Cancel
                </Button>
                <Button kind="primary" onClick={onSave} disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          )}

          {active === "notifications" && (
            <div>
              <div className="serif text-[18px] mb-1">Notifications</div>
              <div className="text-[12.5px] text-muted mb-5">
                We&apos;ll only ping you about things that need your attention.
              </div>
              <NotifRow label="When Avery posts an update"                hint="Email"        checked={notifs.updates}   onChange={(v) => setNotifs((p) => ({ ...p, updates: v }))} />
              <NotifRow label="When a new document is needed from you"     hint="Email + SMS"  checked={notifs.documents} onChange={(v) => setNotifs((p) => ({ ...p, documents: v }))} />
              <NotifRow label="Closing day reminders"                      hint="Email + SMS"  checked={notifs.closing}   onChange={(v) => setNotifs((p) => ({ ...p, closing: v }))} />
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="block">
    <div className="text-[11.5px] font-medium text-muted mb-1.5">{label}</div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 text-[13.5px] text-ink border border-hairline rounded-lg bg-white outline-none focus:border-blue/60"
    />
  </label>
);

const NotifRow = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-3.5 border-t border-hairline-2 first:border-t-0">
    <div>
      <div className="text-[13.5px] font-medium">{label}</div>
      <div className="text-[12px] text-muted mt-0.5">{hint}</div>
    </div>
    <Toggle checked={checked} onChange={onChange} label={label} />
  </div>
);
