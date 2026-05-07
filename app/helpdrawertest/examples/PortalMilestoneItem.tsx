// Single milestone item as shown in the buyer portal

type PortalState = "complete" | "in-progress" | "pending";

const EXAMPLES: Record<PortalState, { label: string; detail: string }> = {
  complete:    { label: "Your solicitor has received the contract pack", detail: "Completed 5 May 2026" },
  "in-progress": { label: "Your solicitor is reviewing the contract pack", detail: "In progress" },
  pending:     { label: "Search results to be received", detail: "Usually takes 3–4 weeks" },
};

const STATE_STYLE: Record<PortalState, { dot: string; labelColor: string }> = {
  complete:    { dot: "#1F8A4A", labelColor: "#1F8A4A" },
  "in-progress": { dot: "#FF8A65", labelColor: "#FF6B4A" },
  pending:     { dot: "rgba(0,0,0,0.20)", labelColor: "rgba(0,0,0,0.40)" },
};

export function PortalMilestoneItemExample({ state = "complete" }: { state?: PortalState }) {
  const ex  = EXAMPLES[state] ?? EXAMPLES.complete;
  const sty = STATE_STYLE[state] ?? STATE_STYLE.complete;
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "10px 14px",
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 10,
      maxWidth: 340,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: sty.dot,
        flexShrink: 0, marginTop: 4,
      }} />
      <div>
        <p style={{ margin: "0 0 2px", fontSize: 13, color: "#2a2a2a", lineHeight: 1.4 }}>{ex.label}</p>
        <p style={{ margin: 0, fontSize: 11, color: sty.labelColor }}>{ex.detail}</p>
      </div>
    </div>
  );
}
