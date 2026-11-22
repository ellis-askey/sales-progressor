"use client";

// Chase performance tab — "are our client chases working?" Headline rates on
// top (how often a chase gets a response and gets the step done), then the
// outcome of every chase as a single stacked bar. Client chases only: solicitor
// chases carry no engagement signal, so mixing them would fake a number.

import { ChartLineUp } from "@phosphor-icons/react";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { StatBlock } from "@/components/ui/StatBlock";
import { StackedBar } from "@/components/ui/StackedBar";
import { LegendItem } from "@/components/ui/LegendItem";
import type { ChasePerformance } from "@/lib/services/automated-emails-analytics";

const OUTCOME = [
  { key: "stillChasing", label: "Still chasing", colour: "var(--agent-info)" },
  { key: "resolved", label: "Resolved", colour: "var(--agent-success)" },
  { key: "escalated", label: "Needed a person", colour: "var(--agent-warning)" },
  { key: "closedOther", label: "Closed", colour: "var(--agent-text-muted)" },
] as const;

export function ChasePerformanceView({ data }: { data: ChasePerformance }) {
  if (data.totalChased === 0) {
    return <EmptyState icon={<ChartLineUp size={24} weight="regular" />} title="No client chases yet" description="Once chasing starts on a file, its performance shows here." />;
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
        <StackedBar
          segments={OUTCOME
            .filter((o) => data[o.key] > 0)
            .map((o) => ({ pct: (data[o.key] / data.totalChased) * 100, color: o.colour }))}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          {OUTCOME.map((o) => (
            <LegendItem key={o.key} color={o.colour} value={data[o.key]} label={o.label} />
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
  return <StatBlock eyebrow={label} value={value} sub={sub} numberSize="sm" />;
}
