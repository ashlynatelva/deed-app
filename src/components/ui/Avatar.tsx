import * as React from "react";

type Tone = "navy" | "light" | "gold";

const tones: Record<Tone, { bg: string; fg: string }> = {
  navy:  { bg: "var(--navy)", fg: "#fff" },
  light: { bg: "#EEF1F4",     fg: "var(--charcoal)" },
  gold:  { bg: "rgba(201,168,76,.14)", fg: "#7a661f" },
};

const computeInitialsFromName = (name: string): string =>
  name
    .split(/\s+|&\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const Avatar = ({
  name,
  initials: explicitInitials,
  size = 28,
  tone = "navy",
}: {
  name: string;
  /**
   * Optional pre-computed initials override. Useful when the caller has its
   * own derivation logic (e.g. `deriveInitials("Whitney & Marcus Hall")` →
   * "WH" from the client profile store). When omitted, falls back to a
   * first-letters-of-each-word derivation from `name`.
   */
  initials?: string;
  size?: number;
  tone?: Tone;
}) => {
  const initials = explicitInitials ?? computeInitialsFromName(name);
  const t = tones[tone];
  return (
    <div
      className="inline-flex items-center justify-center rounded-full font-semibold tracking-[.02em] shrink-0"
      style={{
        width: size,
        height: size,
        background: t.bg,
        color: t.fg,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </div>
  );
};
