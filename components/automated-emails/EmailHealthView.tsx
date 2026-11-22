"use client";

// Email health tab — deliverability of the automated email queue over the
// period. Headline rates first (how much we've confirmed delivered, and the
// bounce/block rate), then the full breakdown as a stacked bar. "Awaiting
// confirmation" is shown honestly and never folded into delivered.

import { EnvelopeSimple } from "@phosphor-icons/react";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { StatNumber } from "@/components/ui/StatNumber";
import { StackedBar } from "@/components/ui/StackedBar";
import { LegendItem } from "@/components/ui/LegendItem";
import type { EmailHealth } from "@/lib/services/automated-emails-analytics";

const BREAKDOWN = [
  { key: "delivered", label: "Delivered", colour: "var(--agent-success)" },
  { key: "unknown", label: "Awaiting confirmation", colour: "var(--agent-text-muted)" },
  { key: "deferred", label: "Deferred", colour: "var(--agent-warning)" },
  { key: "bounced", label: "Bounced", colour: "var(--agent-danger)" },
  { key: "blocked", label: "Blocked", colour: "var(--agent-danger)" },
] as const;

export function EmailHealthView({ data }: { data: EmailHealth }) {
  if (data.totalSent === 0) {
    return <EmptyState icon={<EnvelopeSimple size={24} weight="regular" />} title="No automated email activity in this period" description="Delivery health appears once emails have gone out." />;
  }

  return (
    <div className="space-y-5">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
        <Tile label="Delivery rate" value={rate(data.deliveryRatePct)} sub="Confirmed delivered" />
        <Tile label="Bounce / block rate" value={rate(data.bounceRatePct)} sub={`${data.bounced + data.blocked} of ${data.totalSent} sends`} />
        <Tile label={`Sent (${data.periodDays}d)`} value={data.totalSent.toLocaleString()} sub="Automated emails" />
        <Tile label="Awaiting confirmation" value={data.unknown.toLocaleString()} sub="No delivery event yet" />
      </div>

      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 8 }}>Where every send ended up</p>
        <StackedBar
          gap={1}
          segments={BREAKDOWN
            .filter((b) => data[b.key] > 0)
            .map((b) => ({ pct: (data[b.key] / data.totalSent) * 100, color: b.colour, dim: b.key === "blocked" }))}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          {BREAKDOWN.map((b) => (
            <LegendItem key={b.key} color={b.colour} value={data[b.key]} label={b.label} />
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
        Covers automated emails from the queue. Delivery confirmation is partial, so awaiting-confirmation sends are counted on their own, never as delivered.
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
      <StatNumber size="sm">{value}</StatNumber>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</p>
    </div>
  );
}
