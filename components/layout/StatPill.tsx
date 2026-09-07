export type PillColor = "danger" | "warning" | "muted";

// Frosted-glass summary pill for a PageHeader (e.g. "3 need you"). Milky glass
// over the app's aurora backdrop, with the tone carried as text + a leading
// glow dot rather than a heavy fill. Theme-aware (every accent theme + dark)
// via .agent-stat-glass in agent-system.css. Frosted treatment picked by Ellis
// 2026-09-07, replacing the flat pale red-50/slate-50 tints.
const TONE_CLASS: Record<PillColor, string> = {
  danger:  "agent-stat-glass--danger",
  warning: "agent-stat-glass--warning",
  muted:   "agent-stat-glass--muted",
};

export function StatPill({ href, label, color }: { href: string; label: string; color: PillColor }) {
  return (
    <a
      href={href}
      className={`agent-stat-glass ${TONE_CLASS[color]}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "4px 12px", borderRadius: 999,
        fontSize: 11, fontWeight: 600, textDecoration: "none",
      }}
    >
      <span className="agent-stat-dot" aria-hidden />
      {label}
    </a>
  );
}
