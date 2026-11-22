import type { ReactNode } from "react";

// Canonical count badge — a tinted pill with a live pulsing dot, for section /
// group counts that update ("5 needs you", "49 on autopilot"). Deliberately
// distinct from the plain Pill: the dot signals a live, changing count. Tones map
// to the semantic token set (danger / warning / muted). Built on the shipped
// .agent-stat-glass treatment (agent-system.css) so it stays one with the app.
export function CountPill({
  tone = "muted",
  children,
  style,
}: {
  tone?: "danger" | "warning" | "muted";
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`agent-stat-glass agent-stat-glass--${tone}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, flexShrink: 0, ...style }}
    >
      <span className="agent-stat-dot" aria-hidden />
      {children}
    </span>
  );
}
