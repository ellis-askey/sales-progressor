"use client";

// Email health tab — deliverability of the automated email queue over the
// period. Headline rates first (how much we've confirmed delivered, and the
// bounce/block rate), then the full breakdown as a stacked bar. "Awaiting
// confirmation" is shown honestly and never folded into delivered.

import { EmptyState } from "@/components/ui/EmptyState";
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
    return <EmptyState title="No automated email activity in this period" description="Delivery health appears once emails have gone out." compact />;
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
        <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--agent-surface-nested, rgba(15,23,42,0.05))" }}>
          {BREAKDOWN.map((b, i) => {
            const v = data[b.key];
            if (v <= 0) return null;
            return <div key={b.key} title={`${b.label}: ${v}`} style={{ width: `${(v / data.totalSent) * 100}%`, background: b.colour, opacity: b.key === "blocked" ? 0.7 : 1, marginLeft: i > 0 ? 1 : 0 }} />;
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          {BREAKDOWN.map((b) => (
            <span key={b.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--agent-text-secondary)" }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: b.colour, opacity: b.key === "blocked" ? 0.7 : 1 }} />
              <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{data[b.key]}</b> {b.label}
            </span>
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
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</p>
    </div>
  );
}
