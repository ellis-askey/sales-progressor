"use client";

// Canonical inline alert / error banner. ONE implementation for the small
// form-level message ("Incorrect email or password", "We couldn't upload your
// memo…"). Aligned to the semantic token — BORDERED, NOT WASHED: the kind colour
// is carried by a hairline border + an alert glyph + the text, on a plain white
// surface. No colour-fill wash (the no-tinted-fill rule). Extracted 2026-11-20
// from the login/register inline copies so every surface draws from one family.

import type { ReactNode } from "react";

export type InlineAlertKind = "danger" | "warning" | "info" | "success";

// Solid colour (glyph + text) + its 0.30-alpha border. Hexes match the semantic
// tokens: danger #C73E3E, warning --agent-warning #C97D1A, success #2F9E6B,
// info #2563EB.
const KIND: Record<InlineAlertKind, { fg: string; border: string }> = {
  danger: { fg: "#C73E3E", border: "rgba(199,62,62,0.30)" },
  warning: { fg: "#C97D1A", border: "rgba(201,125,26,0.30)" },
  info: { fg: "#2563EB", border: "rgba(37,99,235,0.30)" },
  success: { fg: "#2F9E6B", border: "rgba(47,158,107,0.30)" },
};

// The alert glyph — a circle with an exclamation, stroked in the kind colour.
function AlertGlyph({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="8" cy="8" r="6.6" stroke={color} strokeWidth="1.3" />
      <path d="M8 4.7v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.5" fill={color} stroke={color} strokeWidth="0.6" />
    </svg>
  );
}

export function InlineAlert({
  kind = "danger",
  children,
  action,
  className,
}: {
  kind?: InlineAlertKind;
  children: ReactNode;
  /** Optional right-aligned action (e.g. a "Set fee →" link), pushed to the far
   *  right of the alert. Rendered in the kind colour by the caller. */
  action?: ReactNode;
  className?: string;
}) {
  const { fg, border } = KIND[kind];
  return (
    <div
      role="alert"
      className={className}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "#ffffff", margin: 0 }}
    >
      <AlertGlyph color={fg} />
      <span style={{ fontSize: 12.5, color: fg, fontWeight: 500, lineHeight: 1.4 }}>{children}</span>
      {action && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: fg }}>{action}</span>}
    </div>
  );
}
