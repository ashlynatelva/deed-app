"use client";

import * as React from "react";
import { I } from "@/components/ui/Icon";
import {
  ACCENT_PRESETS,
  type BrandingSettings,
} from "@/lib/store/branding";
import { renderWelcome } from "@/lib/hooks/useBranding";

/**
 * Live, miniature renderings of the client-facing surfaces affected by
 * branding. Driven by the panel's local draft so changes update before the
 * agent clicks Save.
 */
export const BrandingPreview = ({ draft }: { draft: BrandingSettings }) => {
  const palette = ACCENT_PRESETS[draft.accent] ?? ACCENT_PRESETS.gold;
  const brand = draft.brokerageName?.trim() || "DEED";
  const initial = brand.charAt(0).toUpperCase();
  const welcome = renderWelcome(draft.welcomeMessage, "Whitney") || `Hi Whitney.`;
  const welcomeSubtext = renderWelcome(draft.welcomeSubtext, "Whitney");

  return (
    <div className="flex flex-col gap-4 sticky top-4">
      <div className="text-[11px] uppercase tracking-[.14em] text-muted font-medium">
        Live preview
      </div>

      <MockBlock label="Client login screen">
        <div
          className="rounded-md text-white p-4 text-center"
          style={{ background: "linear-gradient(180deg, #0F172A 0%, #14213d 100%)" }}
        >
          {/* Mirrors LoginForm: brokerage logo if uploaded, else /logo.png. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.logoDataUrl || "/logo.png"}
            alt=""
            className="w-9 h-9 rounded-md mx-auto mb-2 object-cover"
          />
          <div className="serif text-[14px] tracking-[.04em] truncate">
            {brand.toUpperCase()}
          </div>
          <div
            className="text-[8px] uppercase tracking-[.18em] mt-1"
            style={{ color: "rgba(255,255,255,.55)" }}
          >
            Real estate advisor platform
          </div>

          <div className="bg-white text-ink rounded-md p-3 mt-3 text-left">
            <div className="text-[10px] font-medium mb-1.5">Sign in</div>
            <div className="grid grid-cols-2 gap-1 mb-2 rounded-sm overflow-hidden border border-hairline">
              <div className="h-3" style={{ background: "var(--navy)" }} />
              <div className="h-3 bg-white" />
            </div>
            <div className="space-y-1 mb-2">
              <div className="h-2 w-full rounded-sm bg-[#F3F4F6]" />
              <div className="h-2 w-full rounded-sm bg-[#F3F4F6]" />
            </div>
            <div
              className="h-3 w-full rounded-sm"
              style={{ background: "var(--navy)" }}
            />
          </div>
        </div>
        <div className="text-[8.5px] text-muted text-center mt-2 leading-[1.4] truncate">
          {draft.footerText}
        </div>
      </MockBlock>

      <MockBlock label="Client portal">
        <div className="flex h-[170px] rounded-md overflow-hidden border border-hairline">
          {/* Sidebar mock */}
          <div className="w-[40%] p-2.5 flex flex-col gap-2" style={{ background: "var(--navy)" }}>
            <div className="flex items-center gap-1.5">
              {/* Mirrors Sidebar: brokerage logo if uploaded, else /logo.png. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.logoDataUrl || "/logo.png"}
                alt=""
                className="w-4 h-4 rounded object-cover shrink-0"
              />
              <div className="text-[9px] font-medium text-white truncate">{brand}</div>
            </div>
            <div
              className="text-[7px] uppercase tracking-wider mt-0.5"
              style={{ color: "rgba(255,255,255,.4)" }}
            >
              Your transaction
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <div
                className="flex items-center gap-1 px-1.5 py-1 rounded-sm relative"
                style={{ background: "rgba(255,255,255,.07)" }}
              >
                <span
                  className="absolute left-0 top-1 bottom-1 w-[1.5px] rounded-sm"
                  style={{ background: palette.primary }}
                />
                <div className="h-1.5 w-12 rounded-sm bg-white/40" />
              </div>
              <div className="px-1.5 py-1">
                <div className="h-1.5 w-14 rounded-sm bg-white/15" />
              </div>
              <div className="px-1.5 py-1">
                <div className="h-1.5 w-10 rounded-sm bg-white/15" />
              </div>
            </div>
          </div>

          {/* Body mock */}
          <div className="flex-1 bg-canvas p-2.5 flex flex-col gap-2 min-w-0">
            <div>
              <div className="serif text-[10px] text-ink leading-tight line-clamp-1 tracking-[-0.01em]">
                {welcome}
              </div>
              {welcomeSubtext && (
                <div className="text-[7.5px] text-muted leading-tight line-clamp-1 mt-0.5">
                  {welcomeSubtext}
                </div>
              )}
            </div>
            <div
              className="rounded-sm p-2 text-white"
              style={{ background: "linear-gradient(180deg, #0F172A 0%, #14213d 100%)" }}
            >
              <div
                className="h-[1.5px] w-6 mb-1"
                style={{ background: palette.primary }}
              />
              <div className="text-[8px] font-medium">412 Linden Crescent</div>
              <div className="h-0.5 w-full mt-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full w-1/2 rounded-full"
                  style={{ background: palette.primary }}
                />
              </div>
            </div>
            <div className="flex gap-1">
              <div
                className="h-4 rounded-sm flex-1"
                style={{ background: palette.primary }}
              />
              <div className="h-4 rounded-sm w-8 bg-white border border-hairline" />
            </div>
          </div>
        </div>
      </MockBlock>

      <MockBlock label="Support contact">
        <div className="bg-white rounded-md border border-hairline p-3 text-[11.5px] leading-[1.45]">
          <div className="text-[10px] uppercase tracking-[.1em] text-muted mb-1.5 font-medium">
            Need help? Reach {brand}
          </div>
          <div className="flex items-center gap-1.5 text-charcoal">
            <I.Phone size={11} className="text-muted" />
            <span className="num">{draft.supportPhone}</span>
          </div>
          <div className="flex items-center gap-1.5 text-charcoal mt-0.5">
            <I.Mail size={11} className="text-muted" />
            <span className="truncate">{draft.supportEmail}</span>
          </div>
        </div>
      </MockBlock>

      <MockBlock label="Portal invite email">
        <div className="bg-white rounded-md border border-hairline p-3">
          <div
            className="rounded-sm py-2 px-3 text-white text-center mb-2"
            style={{ background: "var(--navy)" }}
          >
            <div className="text-[10px] serif tracking-[.04em]">
              {brand.toUpperCase()}
            </div>
          </div>
          <div className="text-[11px] text-ink font-medium mb-1">Hi Whitney,</div>
          <div className="text-[10.5px] text-charcoal leading-[1.55] line-clamp-4">
            {draft.inviteEmailIntro}
          </div>
          <div
            className="mt-2 inline-block rounded-sm px-2 py-1 text-[10px] font-medium"
            style={{ background: palette.primary, color: palette.onPrimary }}
          >
            Open my portal →
          </div>
        </div>
      </MockBlock>
    </div>
  );
};

const MockBlock = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="text-[10px] uppercase tracking-[.12em] text-muted mb-1.5 font-medium">
      {label}
    </div>
    {children}
  </div>
);
