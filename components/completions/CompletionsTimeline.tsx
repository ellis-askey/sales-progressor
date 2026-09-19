// Week-ahead strip for Completions: the shape of what's coming, chain days
// flagged. Presentational — the page computes the day buckets from completion
// dates. Only the days that actually have completions are shown.

export type TimelineDay = {
  key: string;
  dow: string;       // "Thu"
  dayNum: number;    // 18
  count: number;
  chainCount: number; // how many of the day's files sit in a chain
  isToday: boolean;
};

export function CompletionsTimeline({ days }: { days: TimelineDay[] }) {
  if (days.length === 0) return null;
  return (
    <div>
      <p className="agent-eyebrow" style={{ marginBottom: 10 }}>Week ahead</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {days.map((d) => (
          <div
            key={d.key}
            style={{
              flex: "none", width: 96, padding: "9px 10px", borderRadius: 12,
              background: "var(--agent-surface-glass)",
              border: d.isToday ? "1px solid var(--agent-coral)" : "1px solid var(--agent-border-subtle)",
              boxShadow: d.isToday ? "0 0 0 1px var(--agent-coral) inset" : undefined,
            }}
          >
            <div style={{ fontSize: 9.5, fontFamily: "var(--agent-font-mono, ui-monospace)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)" }}>{d.dow}</div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 1 }}>{d.dayNum}</div>
            {(() => {
              // Glassed pill: a tinted gradient with a lit top edge + soft
              // shadow (the polished-button treatment), keeping the coral / slate
              // hue rather than washing it out with a white frost.
              const rgb = d.chainCount > 0 ? "100, 116, 139" : "var(--agent-coral-rgb)";
              return (
                <span
                  style={{
                    display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                    background: `linear-gradient(160deg, rgba(${rgb}, 0.18), rgba(${rgb}, 0.06))`,
                    border: `0.5px solid rgba(${rgb}, 0.22)`,
                    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 3px rgba(${rgb}, 0.14)`,
                    color: d.chainCount > 0 ? "var(--agent-text-secondary)" : "var(--agent-coral-deep)",
                  }}
                >
                  {d.chainCount > 0 ? `chain ×${d.chainCount}` : d.isToday ? `${d.count} today` : `${d.count} due`}
                </span>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
