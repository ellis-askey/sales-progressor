// The "finish line" band at the top of Completions — the payoff, not a nag.
// Deals landed in the last 30 days, the typical exchange->completion turnaround,
// how many landed on time, and what's still in flight. Presentational; the
// figures come from getCompletionsMomentum + the page's in-flight totals.

import { GlassCard } from "@/components/glass/GlassCard";
import { Trophy, Timer, CheckCircle, Airplane } from "@phosphor-icons/react/dist/ssr";

function fmtCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (pounds >= 1_000) return "£" + Math.round(pounds / 1_000) + "k";
  return "£" + pounds.toLocaleString("en-GB");
}

type Cell = {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  delta?: string;
  sub: string;
};

export function CompletionsMomentum({
  completed30dCount,
  completed30dValuePence,
  avgExchangeToCompletionDays,
  onTimePct,
  inFlightCount,
  inFlightValuePence,
}: {
  completed30dCount: number;
  completed30dValuePence: number;
  avgExchangeToCompletionDays: number | null;
  onTimePct: number | null;
  inFlightCount: number;
  inFlightValuePence: number;
}) {
  const cells: Cell[] = [
    {
      icon: <Trophy size={15} weight="fill" />,
      label: "Completed · 30 days",
      value: String(completed30dCount),
      valueColor: "var(--agent-success)",
      sub: completed30dValuePence > 0 ? `${fmtCompact(completed30dValuePence)} crossed the line` : "nothing landed yet",
    },
    {
      icon: <Timer size={15} weight="regular" />,
      label: "Avg exchange → completion",
      value: avgExchangeToCompletionDays != null ? `${avgExchangeToCompletionDays}d` : "—",
      sub: avgExchangeToCompletionDays != null ? "your typical turnaround" : "no completions to measure yet",
    },
    {
      icon: <CheckCircle size={15} weight="regular" />,
      label: "Completed on time",
      value: onTimePct != null ? `${onTimePct}%` : "—",
      valueColor: onTimePct == null ? undefined : onTimePct >= 70 ? "var(--agent-success)" : onTimePct >= 40 ? "var(--agent-warning)" : "var(--agent-text-primary)",
      sub: onTimePct != null ? "on or before target" : "no target dates set",
    },
    {
      icon: <Airplane size={15} weight="regular" />,
      label: "In flight",
      value: String(inFlightCount),
      valueColor: "var(--agent-coral-deep)",
      sub: inFlightValuePence > 0 ? `${fmtCompact(inFlightValuePence)} still to complete` : "nothing in flight",
    },
  ];

  return (
    <GlassCard
      glassId="completions-momentum"
      label="Completions · Finish line"
      defaultVariant="v05"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }} className="completions-momentum-grid">
        {cells.map((c, i) => (
          <div
            key={c.label}
            style={{
              padding: "16px 18px",
              borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--agent-text-muted)" }}>
              <span
                aria-hidden
                style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--agent-surface-glass)",
                  border: "0.5px solid var(--agent-border-subtle)",
                  color: c.valueColor ?? "var(--agent-text-secondary)",
                }}
              >
                {c.icon}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 8, color: c.valueColor ?? "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {c.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
