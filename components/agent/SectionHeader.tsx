// Shared section header for the To-Do left column (Reviews due, Internal to-dos,
// My to-dos, progressor). Matches the top of the No-comms card: an icon in a
// coral-tinted circle, a title + subtitle, and a glassed count pill.

import type { ReactNode } from "react";

export function SectionHeader({ icon, title, subtitle, count }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 2px" }}>
      <span aria-hidden style={{ flexShrink: 0, display: "flex", alignItems: "center", color: "var(--agent-coral-deep)" }}>
        {icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--agent-text-primary)" }}>{title}</p>
        <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>{subtitle}</p>
      </div>
      {count != null && count > 0 && <span className="nocomms-count">{count}</span>}
    </div>
  );
}
