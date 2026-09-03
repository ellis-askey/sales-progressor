"use client";

// Chase performance tab — "are our client chases working?" Headline rates on
// top (how often a chase gets a response and gets the step done), then the
// outcome of every chase as a single stacked bar. Client chases only: solicitor
// chases carry no engagement signal, so mixing them would fake a number.

import { EmptyState } from "@/components/ui/EmptyState";
import type { ChasePerformance } from "@/lib/services/automated-emails-analytics";

const OUTCOME = [
  { key: "stillChasing", label: "Still chasing", colour: "var(--agent-info)" },
  { key: "resolved", label: "Resolved", colour: "var(--agent-success)" },
  { key: "escalated", label: "Needed a person", colour: "var(--agent-warning)" },
  { key: "closedOther", label: "Closed", colour: "var(--agent-text-muted)" },
] as const;

export function ChasePerformanceView({ data }: { data: ChasePerformance }) {
  if (data.totalChased === 0) {
    return <EmptyState title="No client chases yet" description="Once chasing starts on a file, its performance shows here." compact />;
  }

  return (
    <div className="space-y-5">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
        <Tile label="Response rate" value={rate(data.responseRatePct)} sub={`${data.engaged} of ${data.totalChased} engaged after a chase`} />
        <Tile label="Resolution rate" value={rate(data.resolutionRatePct)} sub={`${data.resolved} chased steps completed`} />
        <Tile label="Avg chases to resolve" value={data.avgChasesToResolve === null ? "n/a" : String(data.avgChasesToResolve)} sub="Across resolved steps" />
        <Tile label={`Chases sent (${data.periodDays}d)`} value={data.chasesSentPeriod.toLocaleString()} sub="Client chase emails" />
      </div>

      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 8 }}>Outcome of every client chase</p>
        <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--agent-surface-nested, rgba(15,23,42,0.05))" }}>
          {OUTCOME.map((o) => {
            const v = data[o.key];
            if (v <= 0) return null;
            return <div key={o.key} title={`${o.label}: ${v}`} style={{ width: `${(v / data.totalChased) * 100}%`, background: o.colour }} />;
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          {OUTCOME.map((o) => (
            <span key={o.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--agent-text-secondary)" }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: o.colour }} />
              <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{data[o.key]}</b> {o.label}
            </span>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
        Across all client chases on files you can see. A response means the client engaged after we chased.
      </p>
    </div>
  );
}

function rate(p: number | null): string {
  return p === null ? "n/a" : `${p}%`;
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="agent-eyebrow" style={{ margin: 0, marginBottom: 2 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</p>
    </div>
  );
}
