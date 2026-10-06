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
  // Volume bar is relative to the busiest day in view, so a quiet day reads as a
  // sliver and a heavy day fills the track — the shape of the week at a glance.
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  return (
    <div>
      <p className="agent-eyebrow" style={{ marginBottom: 11 }}>Week ahead</p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 2px 6px" }}>
        {days.map((d) => {
          const isChain = d.chainCount > 0;
          const barWidth = Math.max(16, Math.round((d.count / maxCount) * 100));
          return (
            <div
              key={d.key}
              style={{
                flex: "none", width: 112, padding: "11px 12px", borderRadius: 14,
                background: "var(--agent-surface-elevated, #fff)",
                border: d.isToday ? "1px solid var(--agent-coral)" : "1px solid var(--agent-border-default)",
                boxShadow: d.isToday
                  ? "0 0 0 1px var(--agent-coral) inset, 0 1px 2px rgba(45,24,16,.04), 0 8px 20px rgba(45,24,16,.05)"
                  : "0 1px 2px rgba(45,24,16,.03), 0 6px 16px rgba(45,24,16,.04)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: d.isToday ? "var(--agent-coral-deep)" : "var(--agent-text-muted)" }}>
                {d.isToday ? `Today · ${d.dow}` : d.dow}
              </div>
              <div style={{ fontSize: 21, fontWeight: 740, letterSpacing: "-0.01em", marginTop: 1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{d.dayNum}</div>
              <div style={{ height: 5, borderRadius: 99, background: "var(--agent-border-subtle)", margin: "9px 0 7px", overflow: "hidden" }}>
                <span style={{
                  display: "block", height: "100%", width: `${barWidth}%`, borderRadius: 99,
                  background: isChain
                    ? "linear-gradient(90deg,#6E7A8C,#9AA6B4)"
                    : "linear-gradient(90deg,var(--agent-coral-deep),var(--agent-coral))",
                }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 650, color: "var(--agent-text-secondary)" }}>
                {isChain ? (
                  <span style={{ color: "#6E7A8C" }}>chain ×{d.chainCount}</span>
                ) : (
                  <><span style={{ color: "var(--agent-success)", fontWeight: 700 }}>{d.count}</span> {d.isToday ? "completing" : "due"}</>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
