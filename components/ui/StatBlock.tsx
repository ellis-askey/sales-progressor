import type { CSSProperties, ReactNode } from "react";
import { StatNumber } from "@/components/ui/StatNumber";

// Canonical hub stat-header group — eyebrow + big number + subtitle, as ONE self-contained
// component. Deliberately NOT built on the shared .agent-eyebrow / .agent-card-subtitle
// classes (used across 36+ surfaces), so adjusting the hub's stat headers here never ripples
// to places you can't check. It still draws on the shared design TOKENS for colour/scale, so
// it stays on-system — the decoupling is at the class level, where the blast radius lives.
// The number is the canonical StatNumber (30 / 750 / tabular).

const EYEBROW: CSSProperties = {
  margin: "0 0 6px",
  fontSize: "var(--agent-text-eyebrow)",
  fontWeight: "var(--agent-weight-semibold)",
  letterSpacing: 0,
  color: "var(--agent-text-muted)",
  lineHeight: "var(--agent-line-tight)",
} as CSSProperties;

const SUB: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "var(--agent-text-muted)",
  lineHeight: "var(--agent-line-base)",
} as CSSProperties;

export function StatBlock({
  eyebrow,
  value,
  sub,
  valueColor,
  numberSize = "md",
  delta,
}: {
  eyebrow: string;
  /** A plain string/number — NOT a StatNumber (this wraps it in one itself). */
  value: ReactNode;
  sub?: string;
  /** Override the numeral colour (e.g. a win's accent). */
  valueColor?: string;
  /** "md" = 30px hero numeral (default); "sm" = 24px secondary stat. */
  numberSize?: "sm" | "md";
  /** Optional trend indicator (e.g. DeltaIndicator) between the number and sub. */
  delta?: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={EYEBROW}>{eyebrow}</p>
      <StatNumber color={valueColor} size={numberSize}>{value}</StatNumber>
      {delta}
      {sub ? <p style={SUB}>{sub}</p> : null}
    </div>
  );
}
