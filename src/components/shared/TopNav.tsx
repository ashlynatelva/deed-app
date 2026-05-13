"use client";

import * as React from "react";
import Link from "next/link";
import { I } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationsBell } from "@/components/shared/NotificationsBell";
import { useCurrentProfile } from "@/lib/hooks/useCurrentProfile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type TopNavProps = {
  role: "agent" | "client";
  userName: string;
  userEmail: string;
  userSubtitle: string;
  searchPlaceholder?: string;
  /**
   * Mobile-only hamburger callback. When provided, a menu button shows
   * on the left of the nav at < md and opens the mobile drawer. Desktop
   * never renders the button — the persistent sidebar is the nav.
   */
  onMenuClick?: () => void;
};

export const TopNav = ({
  role,
  userName,
  userEmail,
  userSubtitle,
  searchPlaceholder,
  onMenuClick,
}: TopNavProps) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Clears the Supabase session cookie, then full-page navigates to /login
  // so the proxy sees the cleared state and we land on a fresh form.
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  // Pull live identity from Supabase via the profile provider so a Save on
  // either /agent/settings or /client/settings updates the avatar + name +
  // email everywhere immediately. The userName / userEmail / userSubtitle
  // props remain as the SSR-friendly first-paint fallback.
  const currentProfile = useCurrentProfile();
  const displayName = currentProfile.fullName || userName;
  const displayEmail = currentProfile.email || userEmail;
  const displayInitials = currentProfile.avatarInitials;

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const settingsHref = role === "agent" ? "/agent/settings" : "/client/settings";

  return (
    <header
      className="sticky top-0 z-10 h-14 bg-white border-b border-hairline flex items-center gap-3 md:gap-4 px-4 md:px-6"
    >
      {/* Mobile hamburger — opens the slide-out nav drawer. Only renders
          when a callback is wired in (agent + client shells both pass
          one). Desktop sidebar makes this unnecessary at ≥ md. */}
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="md:hidden w-10 h-10 -ml-1 inline-flex items-center justify-center rounded-md text-charcoal hover:bg-[#F3F4F6] transition-colors"
        >
          <I.List size={18} />
        </button>
      )}

      {/* Search — hidden at mobile (the visible chrome there is just
          hamburger + brand area + bell + avatar; search is a desktop
          surface for now and the route filters cover the use case). */}
      <div className="hidden md:block relative max-w-[380px] flex-1">
        <I.Search size={14} className="absolute left-3 top-[11px] text-muted pointer-events-none" />
        <input
          type="search"
          placeholder={searchPlaceholder ?? (role === "agent" ? "Search transactions, clients, documents…" : "Search your portal…")}
          className="w-full h-9 pl-[34px] pr-8 text-[13px] border border-hairline rounded-lg bg-[#FBFBFC] outline-none focus:border-blue/40 focus:bg-white"
        />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <NotificationsBell role={role} />

      {/* User menu */}
      <div ref={wrapRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full cursor-pointer transition-colors",
            menuOpen ? "bg-[#F3F4F6] border border-hairline" : "border border-transparent hover:bg-[#FBFBFC]",
          )}
        >
          <Avatar
            name={displayName}
            initials={displayInitials}
            size={32}
            tone={role === "agent" ? "navy" : "light"}
          />
          {/* Name + chevron caret are desktop-only — at mobile the
              avatar alone serves as the menu trigger so we don't crowd
              the narrow nav with the brokerage's full name. */}
          <div className="hidden md:block text-[12.5px] font-medium text-ink">{displayName}</div>
          <I.Down
            size={11}
            className="hidden md:block text-muted transition-transform"
            style={{ transform: menuOpen ? "rotate(180deg)" : "none" }}
          />
        </button>
        {menuOpen && (
          <div
            // Mobile: pin to viewport edge so the 240px menu doesn't punch
            // past the right edge on small phones. Desktop is unchanged.
            className="fixed top-[3.5rem] right-4 md:absolute md:top-[calc(100%+8px)] md:right-0 z-20 w-[calc(100vw-2rem)] max-w-60 md:w-60 bg-white border border-hairline rounded-xl overflow-hidden"
            style={{ boxShadow: "0 16px 48px -12px rgba(15,23,42,.22), 0 4px 12px rgba(15,23,42,.06)" }}
          >
            <div className="px-4 py-3.5 border-b border-hairline-2 flex items-center gap-3">
              <Avatar
                name={displayName}
                initials={displayInitials}
                size={36}
                tone={role === "agent" ? "navy" : "light"}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink truncate">{displayName}</div>
                <div className="text-[11.5px] text-muted truncate">{displayEmail}</div>
                <div className="text-[11px] text-muted/80 mt-0.5">{userSubtitle}</div>
              </div>
            </div>
            <div className="p-1.5">
              <Link
                href={settingsHref}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] text-ink hover:bg-[#F3F4F6]"
                onClick={() => setMenuOpen(false)}
              >
                <I.User size={14} className="text-muted" />
                Profile
              </Link>
              <Link
                href={settingsHref}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] text-ink hover:bg-[#F3F4F6]"
                onClick={() => setMenuOpen(false)}
              >
                <I.Cog size={14} className="text-muted" />
                Settings
              </Link>
            </div>
            <div className="p-1.5 border-t border-hairline-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                disabled={signingOut}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] text-ink hover:bg-[#F3F4F6] disabled:opacity-60 text-left"
              >
                <I.LogOut size={14} className="text-muted" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
