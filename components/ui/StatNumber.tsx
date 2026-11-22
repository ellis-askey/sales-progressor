import type { CSSProperties, ReactNode } from "react";

// Canonical stat numeral — the big headline figure on stat cards (pipeline count, wins
// total, etc.). One scale (30 / 750 / tight tracking / tabular) so every card's number
// reads as one family, replacing the per-card inline 28/800 · 32/700 · 34/800. Colour is
// overridable for celebratory stats; everything else is fixed.

export function StatNumber({
  children,
  color,
  size = "md",
  style,
}: {
  children: ReactNode;
  /** Override the numeral colour (e.g. a win's accent). Defaults to text-primary. */
  color?: string;
  /** "md" = 30px card/hero stat (default). "sm" = 24px secondary stat (the pipeline-health cells). */
  size?: "sm" | "md";
  style?: CSSProperties;
}) {
  const sm = size === "sm";
  return (
    <p
      style={{
        margin: 0,
        fontSize: sm ? 24 : 30,
        fontWeight: 750,
        letterSpacing: "-0.02em",
        lineHeight: sm ? 1 : 1.05,
        fontVariantNumeric: "tabular-nums",
        color: color ?? "var(--agent-text-primary)",
        ...style,
      }}
    >
      {children}
    </p>
  );
}
