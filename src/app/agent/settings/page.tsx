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
import { BrandingSettingsPanel } from "@/components/agent/BrandingSettingsPanel";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";

// Billing has been intentionally removed from this list.
const TABS: SettingsTab[] = [
  { id: "profile",       label: "Profile",       icon: "User" },
  { id: "notifications", label: "Notifications", icon: "Bell" },
  { id: "branding",      label: "Branding",      icon: "Pin" },
  { id: "security",      label: "Security",      icon: "Lock" },
];

type NotifKey = "uploads" | "messages" | "deadlines" | "weekly";

export default function AgentSettingsPage() {
  const { profile: serverProfile, update } = useCurrentProfile();
  const [active, setActive] = React.useState("profile");
  const [notifs, setNotifs] = React.useState<Record<NotifKey, boolean>>({
    uploads: true,
    messages: true,
    deadlines: true,
    weekly: false,
  });
  // Local draft mirrors the persisted profile so Cancel can revert.
  const [profile, setProfile] = React.useState({
    name: serverProfile.full_name,
    title: serverProfile.title ?? "",
    email: serverProfile.email,
    phone: serverProfile.phone ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const toast = useToast();

  // Resync the local draft when the persisted profile identity changes
  // (e.g. after a successful save). Render-time check rather than an
  // effect so React Compiler doesn't flag a cascading setState.
  const [lastServerProfile, setLastServerProfile] = React.useState(serverProfile);
  if (serverProfile !== lastServerProfile) {
    setLastServerProfile(serverProfile);
    setProfile({
      name: serverProfile.full_name,
      title: serverProfile.title ?? "",
      email: serverProfile.email,
      phone: serverProfile.phone ?? "",
    });
  }

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await update({
        full_name: profile.name.trim() || serverProfile.full_name,
        title: profile.title.trim() || null,
        email: profile.email.trim() || serverProfile.email,
        phone: profile.phone.trim() || null,
      });
      toast.push("Profile saved.", "success");
    } catch (err) {
      console.error("[agent/settings] saveProfile failed:", err);
      const msg = err instanceof Error ? err.message : "Couldn't save profile.";
      toast.push(msg, "info");
    } finally {
      setSaving(false);
    }
  };

  const cancelProfile = () =>
    setProfile({
      name: serverProfile.full_name,
      title: serverProfile.title ?? "",
      email: serverProfile.email,
      phone: serverProfile.phone ?? "",
    });

  const setNotif = (k: NotifKey, v: boolean) => {
    setNotifs((prev) => ({ ...prev, [k]: v }));
    toast.push(`${v ? "Enabled" : "Muted"} — ${labelFor(k)}.`);
  };

  return (
    <PageShell>
      <SectionTitle eyebrow="Account" title="Settings" />

      {/* Tabs sit above content at mobile (horizontal scroll if needed),
          stay as a 220px left rail at desktop. */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 md:gap-6 items-start">
        <SettingsTabs tabs={TABS} active={active} onChange={setActive} />

        {/* Branding renders its own card layout (form + preview). Other tabs
            keep the unified Card wrapper. */}
        {active === "branding" ? (
          <BrandingSettingsPanel />
        ) : (
          <Card>
            {active === "profile" && (
              <div>
                <div className="serif text-[18px] mb-1">Profile</div>
                <div className="text-[12.5px] text-muted mb-5">
                  This is how clients see you on portal invites, emails, and signatures.
                </div>
                <div className="flex items-center gap-4 mb-5">
                  <Avatar name={profile.name} size={56} />
                  <div>
                    <div className="text-[14px] font-semibold">{profile.name}</div>
                    <div className="text-[12px] text-muted">{profile.title}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Full name" value={profile.name}  onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
                  <Field label="Title"     value={profile.title} onChange={(v) => setProfile((p) => ({ ...p, title: v }))} />
                  <Field label="Email"     value={profile.email} onChange={(v) => setProfile((p) => ({ ...p, email: v }))} />
                  <Field label="Phone"     value={profile.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} />
                </div>
                <div className="mt-5 flex gap-2 justify-end">
                  <Button kind="secondary" onClick={cancelProfile} disabled={saving}>
                    Cancel
                  </Button>
                  <Button kind="primary" onClick={saveProfile} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            )}

            {active === "notifications" && (
              <div>
                <div className="serif text-[18px] mb-1">Notifications</div>
                <div className="text-[12.5px] text-muted mb-5">
                  Choose what nudges you. Operational events default on.
                </div>
                <NotificationRow label="Client uploads a document"        hint="In-app + email"        checked={notifs.uploads}   onChange={(v) => setNotif("uploads", v)} />
                <NotificationRow label="Client sends a message"            hint="In-app + email"        checked={notifs.messages}  onChange={(v) => setNotif("messages", v)} />
                <NotificationRow label="Compliance deadline within 48h"    hint="In-app + email + SMS"  checked={notifs.deadlines} onChange={(v) => setNotif("deadlines", v)} />
                <NotificationRow label="Weekly pipeline summary"           hint="Monday morning, email" checked={notifs.weekly}    onChange={(v) => setNotif("weekly", v)} />
              </div>
            )}

            {active === "security" && (
              <PlaceholderTab
                title="Security"
                body="Password, MFA, and active sessions will appear here once authentication is wired up."
                onAction={() => toast.comingSoon("Security settings")}
              />
            )}
          </Card>
        )}
      </div>
    </PageShell>
  );
}

const labelFor = (k: NotifKey) =>
  k === "uploads" ? "client upload alerts" :
  k === "messages" ? "client message alerts" :
  k === "deadlines" ? "deadline alerts" : "weekly summary";

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

const NotificationRow = ({
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

const PlaceholderTab = ({ title, body, onAction }: { title: string; body: string; onAction: () => void }) => (
  <div>
    <div className="serif text-[18px] mb-1">{title}</div>
    <div className="text-[12.5px] text-muted mb-4">{body}</div>
    <Button kind="secondary" onClick={onAction}>Configure {title.toLowerCase()}</Button>
  </div>
);
