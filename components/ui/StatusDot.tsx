import type { CSSProperties, ReactNode } from "react";

// Canonical status indicator — a tone dot + sentence-case label, no fill.
// Replaces the soft tinted glass status Pills (Delivered / Covered / Chase /
// Bounced …) so status reads from a coloured dot rather than a washed pill
// background (the "no faded fills" rule). The colour lives in the dot; the label
// stays neutral-secondary (or primary when `strong`). For true counts use
// CountBadge; for signal chips that still want a chip shape, use Pill `dot`.

export type StatusTone = "success" | "info" | "warning" | "danger" | "muted" | "brand" | "default";

const TONE: Record<StatusTone, string> = {
  success: "var(--agent-success)",
  info: "var(--agent-info)",
  warning: "var(--agent-warning)",
  danger: "var(--agent-danger)",
  muted: "var(--agent-text-muted)",
  brand: "var(--agent-coral)",
  default: "var(--agent-text-muted)",
};

export function StatusDot({
  tone = "muted",
  label,
  strong = false,
  size = 11.5,
  style,
}: {
  tone?: StatusTone;
  label: ReactNode;
  /** Label in primary text instead of secondary. */
  strong?: boolean;
  /** Label font size (px). Dot scales with it. */
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: size, fontWeight: 600, color: strong ? "var(--agent-text-primary)" : "var(--agent-text-secondary)", whiteSpace: "nowrap", ...style }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: TONE[tone], flexShrink: 0 }} />
      {label}
    </span>
  );
}
