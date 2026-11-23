// Canonical inline icon-count chip — a small tinted icon + a count/label, e.g.
// the "N links" chip on chain cards. Distinct from CountBadge (the pill on tabs):
// this is a labelled inline chip, icon-led. Presentation only. Extracted from
// ChainCard at the 2026-11-23 Chains pass.

import type { ReactNode, CSSProperties } from "react";

export function CountChip({
  icon,
  children,
  iconColor = "var(--agent-coral-deep)",
  color = "var(--agent-text-secondary)",
  style,
}: {
  icon: ReactNode;
  children: ReactNode;
  iconColor?: string;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color, whiteSpace: "nowrap", ...style }}>
      <span style={{ display: "inline-flex", color: iconColor }} aria-hidden>{icon}</span>
      {children}
    </span>
  );
}
