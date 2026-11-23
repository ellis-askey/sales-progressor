// Canonical "meta stat" building blocks — a row of small icon + label pairs with
// tone colouring and hairline dividers between them, e.g. the chain-card footer
// ("N below you · M of K connected · ⚠ P to invite"). Presentation only; the
// consumer owns which items show and in what order. Extracted from ChainCard at
// the 2026-11-23 Chains pass.

import type { ReactNode } from "react";

export type MetaStatTone = "muted" | "warning" | "success" | "danger";

function toneColor(tone: MetaStatTone): string {
  return tone === "warning" ? "var(--agent-warning)"
    : tone === "success" ? "var(--agent-success)"
      : tone === "danger" ? "var(--agent-danger)"
        : "var(--agent-text-muted)";
}

export function MetaStatItem({
  icon,
  children,
  tone = "muted",
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: MetaStatTone;
}) {
  const color = toneColor(tone);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color, fontWeight: tone === "muted" ? 500 : 600, whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-flex", color }} aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

export function MetaStatDivider() {
  return <span aria-hidden style={{ width: 1, height: 11, background: "var(--agent-border-subtle)", flexShrink: 0 }} />;
}
