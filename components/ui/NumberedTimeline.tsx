import type { CSSProperties, ReactNode } from "react";

// Canonical numbered timeline — a vertical list of steps, each with a coral
// numbered circle joined by a thin coral connector into a timeline. The circle
// + connector ARE the look (it's a brand element, not a status pill, so it is a
// filled coral circle by design, exempt from the no-wash rule). Token-based.
//
// Promoted from the welcome-call / intro-call script (2026-11-24). Use
// <NumberedTimeline items={[...]} /> for a read/display timeline; use the
// exported <TimelineNumber /> + <TimelineConnector /> to compose a bespoke row
// (e.g. an inline editor that needs its own field layout).

const circleStyle: CSSProperties = {
  width: 30, height: 30, borderRadius: 99, flexShrink: 0,
  background: "radial-gradient(circle at 50% 32%, #ffffff 0%, var(--agent-coral-bg-tint) 100%)",
  border: "1px solid rgba(var(--agent-coral-rgb), 0.30)",
  boxShadow: "0 1px 3px rgba(var(--agent-coral-rgb), 0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
  color: "var(--agent-coral-deep)", fontSize: 12.5, fontWeight: 800,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const connectorStyle: CSSProperties = { flex: 1, width: 1.5, minHeight: 10, marginTop: 6, borderRadius: 2, background: "rgba(var(--agent-coral-rgb), 0.18)" };

export function TimelineNumber({ n }: { n: number }) {
  return <span style={circleStyle}>{n}</span>;
}

export function TimelineConnector() {
  return <span aria-hidden style={connectorStyle} />;
}

export function NumberedTimeline({ items, gap = 14 }: { items: ReactNode[]; gap?: number }) {
  return (
    <div>
      {items.map((content, i) => {
        const last = i === items.length - 1;
        return (
          <div key={i} style={{ display: "flex", gap }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <TimelineNumber n={i + 1} />
              {!last && <TimelineConnector />}
            </div>
            <div
              style={{
                flex: 1, minWidth: 0, paddingTop: 4, paddingBottom: last ? 2 : 18,
                borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)",
              }}
            >
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default NumberedTimeline;
