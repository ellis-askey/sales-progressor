// Simplified VM/PM progress track — shows a strip of milestone dots

type DotState = "complete" | "pending" | "not-required" | "locked";

const VENDOR: Array<{ code: string; state: DotState }> = [
  { code: "VM1",  state: "complete" },
  { code: "VM2",  state: "complete" },
  { code: "VM3",  state: "complete" },
  { code: "VM4",  state: "complete" },
  { code: "VM5",  state: "complete" },
  { code: "VM6",  state: "complete" },
  { code: "VM7",  state: "pending" },
  { code: "VM8",  state: "not-required" },
  { code: "VM9",  state: "not-required" },
  { code: "VM10", state: "locked" },
  { code: "VM11", state: "locked" },
  { code: "VM12", state: "locked" },
  { code: "VM13", state: "locked" },
  { code: "VM14", state: "locked" },
  { code: "VM15", state: "locked" },
  { code: "VM16", state: "locked" },
  { code: "VM17", state: "locked" },
  { code: "VM18", state: "locked" },
  { code: "VM19", state: "locked" },
  { code: "VM20", state: "locked" },
];

const DOT_COLOR: Record<DotState, string> = {
  complete: "#1F8A4A",
  pending: "#FF8A65",
  "not-required": "rgba(45,24,16,0.15)",
  locked: "rgba(45,24,16,0.10)",
};

function Dot({ state, code }: { state: DotState; code: string }) {
  return (
    <div title={code} style={{
      width: 12, height: 12, borderRadius: "50%",
      background: DOT_COLOR[state],
      border: state === "pending" ? "2px solid #FF6B4A" : "2px solid transparent",
      flexShrink: 0,
      cursor: "default",
    }} />
  );
}

export function MilestoneProgressStripExample() {
  const complete = VENDOR.filter(d => d.state === "complete").length;
  const applicable = VENDOR.filter(d => d.state !== "not-required").length;
  const pct = Math.round((complete / applicable) * 100);

  return (
    <div style={{ background: "rgba(255,255,255,0.70)", border: "0.5px solid rgba(45,24,16,0.10)", borderRadius: 12, padding: "14px 16px", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#5A3A28", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vendor</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#FF6B4A" }}>{pct}%</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {VENDOR.map(d => <Dot key={d.code} state={d.state} code={d.code} />)}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {(["complete", "pending", "not-required", "locked"] as DotState[]).map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_COLOR[s], border: s === "pending" ? "2px solid #FF6B4A" : "none" }} />
            <span style={{ fontSize: 10, color: "rgba(45,24,16,0.50)", textTransform: "capitalize" }}>{s.replace("-", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
