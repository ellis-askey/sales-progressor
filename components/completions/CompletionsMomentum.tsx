// The "finish line" band at the top of Completions — the payoff, not a nag.
// Deliberately identical to the chain summary hero (SummaryTile): an icon in a
// polished gradient circle, then value / label / sublabel — so the two read as
// one component in different states. Figures come from getCompletionsMomentum +
// the page's in-flight totals.

import { GlassCard } from "@/components/glass/GlassCard";
import { Trophy, Timer, CheckCircle, Airplane } from "@phosphor-icons/react/dist/ssr";

type Tone = "coral" | "info" | "warning" | "success" | "neutral";

function fmtCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (pounds >= 1_000) return "£" + Math.round(pounds / 1_000) + "k";
  return "£" + pounds.toLocaleString("en-GB");
}

type Cell = {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: string;
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
      icon: <Trophy size={22} weight="fill" />,
      tone: "success",
      label: "Completed · 30 days",
      value: String(completed30dCount),
      sub: completed30dValuePence > 0 ? `${fmtCompact(completed30dValuePence)} crossed the line` : "Nothing landed yet",
    },
    {
      icon: <Timer size={22} weight="regular" />,
      tone: "info",
      label: "Avg exchange → completion",
      value: avgExchangeToCompletionDays != null ? `${avgExchangeToCompletionDays}d` : "—",
      sub: avgExchangeToCompletionDays != null ? "Your typical turnaround" : "No completions to measure yet",
    },
    {
      icon: <CheckCircle size={22} weight="regular" />,
      tone: onTimePct == null ? "neutral" : onTimePct >= 70 ? "success" : "warning",
      label: "Completed on time",
      value: onTimePct != null ? `${onTimePct}%` : "—",
      sub: onTimePct != null ? "On or before target" : "No target dates set",
    },
    {
      icon: <Airplane size={22} weight="regular" />,
      tone: "coral",
      label: "In flight",
      value: String(inFlightCount),
      sub: inFlightValuePence > 0 ? `${fmtCompact(inFlightValuePence)} still to complete` : "Nothing in flight",
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
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px",
              borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined,
            }}
          >
            <span aria-hidden className={`stat-circle stat-circle--${c.tone}`}>{c.icon}</span>
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                {c.value}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>{c.label}</span>
              <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.2 }}>{c.sub}</span>
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
