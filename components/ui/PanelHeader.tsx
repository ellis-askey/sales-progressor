import type { CSSProperties, ReactNode } from "react";

// Canonical panel / section header — a title, an optional count badge, optional
// muted sub-text beside it, and an optional right-aligned slot (meta text, a
// toggle, period pills). Extracted from the automated-emails panels, which each
// hand-wrote the same h2 and had already started to drift (15px vs 15.5px). One
// title treatment so they can't diverge again.
//
//   size "md" (default, 15px) — the overview panels (Needs attention, …)
//   size "sm" (13px)          — the denser By-sale group headers

export function PanelHeader({
  title,
  badge,
  sub,
  right,
  size = "md",
  style,
}: {
  title: string;
  /** Optional count badge rendered immediately after the title. */
  badge?: ReactNode;
  /** Muted helper text beside the title (e.g. "Last 30 days"). */
  sub?: ReactNode;
  /** Right-aligned slot — meta text, period pills, a toggle. */
  right?: ReactNode;
  size?: "sm" | "md";
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
      <h2 style={{ margin: 0, fontSize: size === "sm" ? 13 : 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</h2>
      {badge}
      {sub != null && <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{sub}</span>}
      {right != null && <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>{right}</div>}
    </div>
  );
}
