// Milestone timing metadata — predecessor, grace, repeat, escalation

const CELLS = [
  { key: "predecessor", label: "PREDECESSOR" },
  { key: "grace",       label: "GRACE PERIOD" },
  { key: "repeat",      label: "REPEAT CHASE" },
  { key: "escalation",  label: "ESCALATION" },
] as const;

type Props = {
  predecessor?: string;
  grace?: string;
  repeat?: string;
  escalation?: string;
};

export function MilestoneMetaBlockExample({
  predecessor = "None",
  grace = "—",
  repeat = "—",
  escalation = "—",
}: Props) {
  const values: Record<string, string> = { predecessor, grace, repeat, escalation };

  return (
    <div style={{
      width: "100%",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      borderRadius: 10,
      border: "0.5px solid rgba(255,138,101,0.22)",
      overflow: "hidden",
      background: "rgba(255,255,255,0.80)",
    }}>
      {CELLS.map(({ key, label }, i) => (
        <div
          key={key}
          style={{
            padding: "12px 14px",
            borderRight: i % 2 === 0 ? "0.5px solid rgba(45,24,16,0.08)" : "none",
            borderBottom: i < 2 ? "0.5px solid rgba(45,24,16,0.08)" : "none",
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 700, color: "rgba(45,24,16,0.35)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            {label}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#2D1810", fontWeight: 500, lineHeight: 1.45 }}>
            {values[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
