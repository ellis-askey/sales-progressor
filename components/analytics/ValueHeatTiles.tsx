interface ValueHeatTilesProps {
  data: number[];       // weekly values in pence
  labels?: string[];    // week labels for title attribute
}

function fmtK(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`;
  if (pounds >= 1_000)     return `£${Math.round(pounds / 1_000)}k`;
  return `£${Math.round(pounds)}`;
}

export function ValueHeatTiles({ data, labels }: ValueHeatTilesProps) {
  const max = Math.max(...data, 1);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28 }}>
        {data.map((v, i) => {
          const intensity = v / max;
          const height = Math.max(4, Math.round(intensity * 28));
          return (
            <div
              key={i}
              title={labels?.[i] ? `${labels[i]}: ${fmtK(v)}` : fmtK(v)}
              style={{
                flex: 1,
                height,
                borderRadius: 3,
                background: `rgba(255,138,101,${Math.max(0.08, intensity * 0.85)})`,
                alignSelf: "flex-end",
              }}
            />
          );
        })}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: 4, fontSize: 9, color: "var(--agent-text-muted)",
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>{labels?.[0] ?? ""}</span>
        <span>{labels?.[labels.length - 1] ?? ""}</span>
      </div>
    </div>
  );
}
