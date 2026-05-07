// Hub pipeline stat card — variants: empty | active | attention | exchanging-soon

const VARIANTS = {
  empty: {
    value: "0",
    label: "Active files",
    color: "rgba(45,24,16,0.20)",
    delta: "Add your first sale to get started",
  },
  active: {
    value: "12",
    label: "Active files",
    color: "#FF8A65",
    delta: "+2 this month",
  },
  attention: {
    value: "3",
    label: "Need attention",
    color: "#C73E3E",
    delta: null,
  },
  "exchanging-soon": {
    value: "4",
    label: "Exchanging soon",
    color: "#1F8A4A",
    delta: null,
  },
} as const;

type Variant = keyof typeof VARIANTS;

export function HubStatCardExample({ variant = "active" }: { variant?: Variant }) {
  const v = VARIANTS[variant] ?? VARIANTS.active;
  return (
    <div style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "14px 24px",
      background: "rgba(255,255,255,0.70)",
      border: "0.5px solid rgba(45,24,16,0.10)",
      borderRadius: 12,
      gap: 4,
      minWidth: 100,
    }}>
      <span style={{ fontSize: 28, fontWeight: 600, color: v.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {v.value}
      </span>
      <span style={{ fontSize: 11, color: "rgba(45,24,16,0.55)", textAlign: "center" }}>
        {v.label}
      </span>
      {v.delta && (
        <span style={{ fontSize: 10, color: "#1F8A4A", fontWeight: 500 }}>{v.delta}</span>
      )}
    </div>
  );
}
