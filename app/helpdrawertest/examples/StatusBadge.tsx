// File status badge — status prop covers all states

const STATUS_CONFIG = {
  active:         { label: "Active",         bg: "rgba(31,138,74,0.10)",   color: "#1F8A4A",  border: "rgba(31,138,74,0.25)" },
  exchanged:      { label: "Exchanged",      bg: "rgba(61,122,184,0.10)",  color: "#3D7AB8",  border: "rgba(61,122,184,0.25)" },
  completed:      { label: "Completed",      bg: "rgba(45,24,16,0.08)",    color: "#2D1810",  border: "rgba(45,24,16,0.20)" },
  withdrawn:      { label: "Withdrawn",      bg: "rgba(201,125,26,0.10)",  color: "#C97D1A",  border: "rgba(201,125,26,0.25)" },
  "fallen-through": { label: "Fallen through", bg: "rgba(199,62,62,0.08)", color: "#C73E3E",  border: "rgba(199,62,62,0.25)" },
} as const;

type Status = keyof typeof STATUS_CONFIG;

export function StatusBadgeExample({ status = "active" }: { status?: Status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
    }}>
      {cfg.label}
    </span>
  );
}
