"use client";
// Canonical "Ribbon" band header for drawers + modals (the chosen 2026-09-04
// direction). A slim coral band with an optional uppercase kicker, a title and
// an optional subtitle in white. Drop it into a Modal.Header / Drawer.Header
// with SHEET_BAND_STYLE spread onto that Header part, and set the primitive's
// closeTone="onDark" so the X reads on the coral.
//
//   <Modal closeTone="onDark">
//     <Modal.Header style={SHEET_BAND_STYLE}>
//       <SheetBandHeader kicker="Solicitor" title="Add firm" subtitle={address} />
//     </Modal.Header>
//     ...
//
// One place to tweak the band = every drawer/modal follows.

import type { CSSProperties, ReactNode } from "react";

// Spread onto the primitive's Header part to turn it into the band. The
// background + kicker colour route through CSS variables so dark mode can swap
// the bright coral band for a darker treatment app-wide (see globals.css:
// --sheet-band-bg / --sheet-band-kicker under a dark portaled overlay). Light
// falls back to the coral band.
export const SHEET_BAND_STYLE: CSSProperties = {
  background: "var(--sheet-band-bg, var(--agent-coral-deep))",
  borderBottom: "none",
  padding: "15px 24px",
  color: "var(--agent-text-on-coral, #fff)",
};

export function SheetBandHeader({
  kicker,
  title,
  subtitle,
  icon,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {icon && (
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            flexShrink: 0,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--agent-text-on-coral, #fff)",
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sheet-band-kicker, rgba(255,255,255,0.78))" }}>
            {kicker}
          </p>
        )}
        {/* Wraps rather than truncates — some consumers pass a full question
            as the title (e.g. confirm dialogs), which must never be clipped. */}
        <p style={{ margin: kicker ? "2px 0 0" : 0, fontSize: 17, fontWeight: 700, color: "var(--agent-text-on-coral, #fff)", lineHeight: 1.25 }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.88)", lineHeight: 1.35 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
