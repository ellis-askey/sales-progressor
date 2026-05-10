import type React from "react";

export type PillColor = "danger" | "warning" | "muted";

const STYLES: Record<PillColor, React.CSSProperties> = {
  danger:  { color: "var(--agent-danger)",     background: "rgba(239,68,68,0.08)",  border: "1px solid rgba(239,68,68,0.15)"  },
  warning: { color: "var(--agent-warning)",    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" },
  muted:   { color: "var(--agent-text-muted)", background: "rgba(0,0,0,0.06)",      border: "1px solid rgba(0,0,0,0.09)"      },
};

export function StatPill({ href, label, color }: { href: string; label: string; color: PillColor }) {
  return (
    <a href={href} style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, textDecoration: "none",
      ...STYLES[color],
    }}>
      {label}
    </a>
  );
}
