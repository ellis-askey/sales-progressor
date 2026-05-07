// Reminder card — urgencies: due-today | overdue | escalated

const URGENCY_CONFIG = {
  "due-today": {
    label: "Due today",
    borderColor: "#FF8A65",
    bg: "rgba(255,138,101,0.05)",
    labelColor: "#FF6B4A",
    milestone: "VM7 — Draft contract pack issued",
  },
  overdue: {
    label: "Overdue",
    borderColor: "#C97D1A",
    bg: "rgba(201,125,26,0.06)",
    labelColor: "#C97D1A",
    milestone: "PM8 — Searches ordered",
  },
  escalated: {
    label: "Escalated",
    borderColor: "#C73E3E",
    bg: "rgba(199,62,62,0.06)",
    labelColor: "#C73E3E",
    milestone: "VM3 — Seller welcome pack received",
  },
} as const;

type Urgency = keyof typeof URGENCY_CONFIG;

export function ReminderCardExample({ urgency = "due-today" }: { urgency?: Urgency }) {
  const cfg = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG["due-today"];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px 12px 14px",
      background: cfg.bg,
      borderLeft: `3px solid ${cfg.borderColor}`,
      borderRadius: "0 10px 10px 0",
      gap: 12,
      maxWidth: 380,
      borderTop: "0.5px solid rgba(45,24,16,0.06)",
      borderRight: "0.5px solid rgba(45,24,16,0.06)",
      borderBottom: "0.5px solid rgba(45,24,16,0.06)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#2D1810", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          22 Birchwood Lane
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(45,24,16,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cfg.milestone}
        </p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.labelColor, flexShrink: 0 }}>
        {cfg.label}
      </span>
    </div>
  );
}
