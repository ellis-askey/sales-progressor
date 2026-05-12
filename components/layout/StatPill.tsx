import type React from "react";

export type PillColor = "danger" | "warning" | "muted";

// Solid pale-tint backgrounds matching StatusBadge (bg-red-50/border-red-200 pattern).
// These are theme-fixed semantic pills — they pop on any agent background, including
// cool-toned themes (Heritage, Slate) where rgba-tinted bgs blend into the page.
const STYLES: Record<PillColor, React.CSSProperties> = {
  danger:  { color: "var(--agent-danger)",         background: "#fef2f2", border: "1px solid #fecaca" }, // red-50  / red-200
  warning: { color: "var(--agent-warning)",        background: "#fffbeb", border: "1px solid #fde68a" }, // amber-50 / amber-200
  muted:   { color: "var(--agent-text-secondary)", background: "#f8fafc", border: "1px solid #e2e8f0" }, // slate-50 / slate-200
};

export function StatPill({ href, label, color }: { href: string; label: string; color: PillColor }) {
  return (
    <a href={href} className="agent-link" style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, textDecoration: "none",
      transition: "filter 150ms ease, background 150ms ease",
      ...STYLES[color],
    }}>
      {label}
    </a>
  );
}
