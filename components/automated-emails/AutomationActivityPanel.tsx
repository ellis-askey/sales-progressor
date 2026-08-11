"use client";

// "Automation activity" panel — one cohesive overview replacing the old trio
// of oversized KPI cards. Numbers lead; the per-day chart is secondary. Period
// is URL-driven (?period=7|30|90) so it's deep-linkable and server-computed.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass/GlassCard";
import { EmailActivityChart } from "./EmailActivityChart";
import type { AutomationOverview } from "@/lib/services/automated-emails-overview";

const PERIODS = [7, 30, 90] as const;

export function AutomationActivityPanel({ overview }: { overview: AutomationOverview }) {
  const searchParams = useSearchParams();
  const { metrics, periodDays } = overview;

  function periodHref(days: number): string {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", String(days));
    return `/agent/automated-emails?${p.toString()}`;
  }

  return (
    <GlassCard
      glassId="auto-emails-activity"
      label="Auto emails · Automation activity"
      defaultVariant="v05"
      style={{ padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Automation activity</h2>
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Last {periodDays} days</span>
        </div>
        <div role="tablist" aria-label="Activity period" style={{ display: "inline-flex", gap: 4 }}>
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={periodHref(d)}
              role="tab"
              aria-selected={d === periodDays}
              className={`agent-segment-pill agent-segment-pill-sm${d === periodDays ? " on" : ""}`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <StatTile
          label="Emails sent"
          value={metrics.emailsSent.toLocaleString()}
          delta={metrics.emailsSentDeltaPct}
          deltaGoodWhenUp
          sub={`${metrics.chasesSent.toLocaleString()} chase · ${metrics.notificationsSent.toLocaleString()} notification`}
        />
        <StatTile
          label="Delivery rate"
          value={metrics.deliveryRatePct === null ? "n/a" : `${metrics.deliveryRatePct}%`}
          hint="Sent minus known failures"
        />
        <StatTile
          label="Issues"
          value={metrics.issues.toLocaleString()}
          delta={metrics.issuesDeltaPct}
          deltaGoodWhenUp={false}
        />
        <StatTile label="Queued now" value={metrics.queuedNow.toLocaleString()} />
        <StatTile label="Files contacted" value={metrics.filesContacted.toLocaleString()} />
      </div>

      <EmailActivityChart data={overview.perDay} />
    </GlassCard>
  );
}

function StatTile({
  label,
  value,
  delta,
  deltaGoodWhenUp,
  sub,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaGoodWhenUp?: boolean;
  sub?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="agent-eyebrow" style={{ margin: 0, marginBottom: 2 }} title={hint}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {value}
      </p>
      {delta !== undefined && delta !== null && (
        <DeltaChip pct={delta} goodWhenUp={deltaGoodWhenUp ?? true} />
      )}
      {sub && <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</p>}
    </div>
  );
}

function DeltaChip({ pct, goodWhenUp }: { pct: number; goodWhenUp: boolean }) {
  if (pct === 0) {
    return <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>No change vs previous period</p>;
  }
  const up = pct > 0;
  const good = up === goodWhenUp;
  const colour = good ? "var(--agent-success)" : "var(--agent-danger)";
  return (
    <p style={{ margin: "2px 0 0", fontSize: 11, color: colour, display: "flex", alignItems: "center", gap: 3 }}>
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      <span>{Math.abs(pct)}%</span>
      <span style={{ color: "var(--agent-text-muted)" }}>vs prev</span>
    </p>
  );
}
