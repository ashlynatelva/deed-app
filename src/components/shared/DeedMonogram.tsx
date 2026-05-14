// ─────────────────────────────────────────────────────────────────────────────
// DeedMonogram — inline luxury brand mark.
//
// Composition:
//   • Outer rounded-square gold frame (2.5px stroke) — primary border.
//   • Inner gold hairline (0.6px @ 50% opacity) — fine-stationery double-frame.
//   • Serif "D" rendered via SVG <text> in the brand's Newsreader font.
//   • Three ascending bars MASKED OUT of the D so the navy gradient behind
//     the SVG shows through — true negative space, not a fill color that
//     could mismatch the gradient at different scroll positions.
//
// Vector-only, no raster asset dependency. Scales to any pixel density.
// Used on the login hero AND the password-reset / auth screens so all the
// unauthenticated brand surfaces render the same mark.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";

type Props = {
  className?: string;
  /**
   * Mask id has to be unique-per-instance to avoid collisions when the
   * monogram renders twice on the same page. Defaults to a stable name
   * sufficient for single-mount surfaces (login, update-password).
   */
  maskId?: string;
};

export const DeedMonogram = ({ className, maskId = "deed-monogram-cutout" }: Props) => (
  <div className={className} aria-hidden="true">
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full block"
    >
      <defs>
        {/*
          Mask: white pixels stay opaque, black pixels become transparent.
          Three ascending black bars cut through the lower-right of the D
          so the navy background shows through where the bars sit. Bars
          are bottom-aligned at y=142 (matches the D's baseline) and step
          up in height to create the ascending chart accent.
        */}
        <mask id={maskId}>
          <rect width="200" height="200" fill="white" />
          <rect x="115" y="118" width="5" height="24" fill="black" />
          <rect x="124" y="108" width="5" height="34" fill="black" />
          <rect x="133" y="96" width="5" height="46" fill="black" />
        </mask>
      </defs>

      {/* Outer luxury frame */}
      <rect
        x="10"
        y="10"
        width="180"
        height="180"
        rx="28"
        ry="28"
        fill="none"
        stroke="#C9A84C"
        strokeWidth="2.5"
      />

      {/* Inner hairline frame */}
      <rect
        x="20"
        y="20"
        width="160"
        height="160"
        rx="20"
        ry="20"
        fill="none"
        stroke="#C9A84C"
        strokeWidth="0.6"
        strokeOpacity="0.5"
      />

      {/* Serif D with bar cutouts. Font falls back to Georgia if Newsreader
          hasn't loaded yet (font-display: swap on the @next/font import in
          app/layout.tsx). */}
      <text
        x="100"
        y="143"
        textAnchor="middle"
        mask={`url(#${maskId})`}
        style={{
          fontFamily: "var(--font-newsreader), 'Newsreader', Georgia, serif",
          fontSize: "120px",
          fontWeight: 500,
          fill: "#C9A84C",
          letterSpacing: "-2px",
        }}
      >
        D
      </text>
    </svg>
  </div>
);
