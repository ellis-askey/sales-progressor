// Single milestone row — states: pending | complete | not-required | locked

const STATE_CONFIG = {
  pending: {
    dot: "#FF8A65",
    label: "Pending",
    labelColor: "#FF6B4A",
    bg: "rgba(255,138,101,0.06)",
    border: "rgba(255,138,101,0.20)",
    check: false,
  },
  complete: {
    dot: "#1F8A4A",
    label: "Complete",
    labelColor: "#1F8A4A",
    bg: "rgba(31,138,74,0.06)",
    border: "rgba(31,138,74,0.20)",
    check: true,
  },
  "not-required": {
    dot: "rgba(45,24,16,0.20)",
    label: "Not required",
    labelColor: "rgba(45,24,16,0.40)",
    bg: "rgba(45,24,16,0.03)",
    border: "rgba(45,24,16,0.08)",
    check: false,
  },
  locked: {
    dot: "rgba(45,24,16,0.15)",
    label: "Locked",
    labelColor: "rgba(45,24,16,0.35)",
    bg: "rgba(45,24,16,0.02)",
    border: "rgba(45,24,16,0.06)",
    check: false,
  },
} as const;

type State = keyof typeof STATE_CONFIG;

const EXAMPLES: Record<State, { code: string; name: string; date?: string }> = {
  pending:        { code: "VM7", name: "Draft contract pack issued" },
  complete:       { code: "VM1", name: "Seller instructed solicitor", date: "2 May 2026" },
  "not-required": { code: "VM8", name: "Management pack requested" },
  locked:         { code: "VM10", name: "Initial enquiries received" },
};

export function MilestoneRowExample({ state = "pending" }: { state?: State }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.pending;
  const ex  = EXAMPLES[state] ?? EXAMPLES.pending;
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      background: cfg.bg,
      border: `0.5px solid ${cfg.border}`,
      borderRadius: 10,
      gap: 12,
      maxWidth: 360,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: cfg.check ? cfg.dot : "transparent",
          border: `2px solid ${cfg.dot}`,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {cfg.check && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(45,24,16,0.40)", letterSpacing: "0.03em" }}>{ex.code}</span>
          <p style={{ margin: 0, fontSize: 13, color: state === "not-required" || state === "locked" ? "rgba(45,24,16,0.40)" : "#2D1810", lineHeight: 1.3, textDecoration: state === "not-required" ? "line-through" : "none" }}>
            {ex.name}
          </p>
          {ex.date && <p style={{ margin: 0, fontSize: 11, color: "rgba(45,24,16,0.45)" }}>{ex.date}</p>}
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: cfg.labelColor, flexShrink: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {cfg.label}
      </span>
    </div>
  );
}
