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

const EXAMPLES: Record<State, { code: string; name: string; date?: string; sub?: string }> = {
  locked:         { code: "VM10",  name: "Initial enquiries received",     sub: "Previous milestones must be completed first" },
  pending:        { code: "VM7",   name: "Vendor searches applied for" },
  complete:       { code: "VM1",   name: "Seller instructed solicitor",    date: "12 May 2026" },
  "not-required": { code: "VM8",   name: "Management pack requested",      sub: "Tenure: Freehold" },
};

export function MilestoneRowExample({ state = "pending" }: { state?: State }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.pending;
  const ex  = EXAMPLES[state] ?? EXAMPLES.pending;
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      padding: "10px 14px",
      background: cfg.bg,
      border: `0.5px solid ${cfg.border}`,
      borderRadius: 10,
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%",
          background: cfg.check ? cfg.dot : "transparent",
          border: `2px solid ${cfg.dot}`,
          flexShrink: 0,
          marginTop: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {cfg.check && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {state === "locked" && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(45,24,16,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: state === "not-required" || state === "locked" ? "rgba(45,24,16,0.40)" : "#2D1810", lineHeight: 1.3 }}>
            {ex.name}
          </p>
          {ex.date && <p style={{ margin: 0, fontSize: 11, color: "rgba(45,24,16,0.45)", marginTop: 2 }}>Completed {ex.date}</p>}
          {ex.sub && !ex.date && <p style={{ margin: 0, fontSize: 11, color: "rgba(45,24,16,0.40)", marginTop: 2, fontStyle: "italic" }}>{ex.sub}</p>}
        </div>
      </div>
      {state === "pending" && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "#FF6B4A", flexShrink: 0, background: "rgba(255,107,74,0.10)", padding: "3px 10px", borderRadius: 6 }}>
          Confirm
        </span>
      )}
      {state === "complete" && (
        <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(45,24,16,0.30)", flexShrink: 0 }}>
          Undo
        </span>
      )}
      {state === "locked" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(45,24,16,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
    </div>
  );
}

const FOUR_STATES: State[] = ["locked", "pending", "complete", "not-required"];
const STATE_LABELS: Record<State, string> = {
  locked: "Locked — predecessor not yet confirmed",
  pending: "Available — ready to confirm",
  complete: "Complete — confirmed 12 May 2026",
  "not-required": "Not required — auto-set at file creation",
};

export function MilestoneRowFourStatesHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {FOUR_STATES.map((state) => (
        <div key={state}>
          <p style={{ margin: "0 0 5px 0", fontSize: 10, fontWeight: 700, color: "rgba(45,24,16,0.40)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {STATE_LABELS[state]}
          </p>
          <MilestoneRowExample state={state} />
        </div>
      ))}
    </div>
  );
}
