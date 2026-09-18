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
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", marginTop: 1 }}>{d.dayNum}</div>
            <span
              style={{
                display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                background: d.chainCount > 0 ? "rgba(91,107,120,0.12)" : "var(--agent-coral-bg-tint)",
                color: d.chainCount > 0 ? "var(--agent-text-secondary)" : "var(--agent-coral-deep)",
              }}
            >
              {d.chainCount > 0 ? `chain ×${d.chainCount}` : d.isToday ? `${d.count} today` : `${d.count} due`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
