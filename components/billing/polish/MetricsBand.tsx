"use client";

// components/billing/polish/MetricsBand.tsx
//
// Four metric cards across the top of the billing hub. Numbers count up on
// mount via useCountUp (per-page JS pattern, see ANIMATION_STANDARDS.md B1).
// Cards are theme-aware via --agent-* tokens. Responsive: 4 across desktop,
// stacks to 2x2 on narrow viewports.

import { useCountUp } from "@/lib/hooks/useCountUp";

type Card = {
  label: string;
  value: number;
  formatter: (n: number) => string;
  sub?: string;
  emphasised?: boolean;
};

function MetricCard({ card }: { card: Card }) {
  const display = useCountUp(card.value, { duration: 700 });
  return (
    <div
      className="agent-glass"
      style={{
        borderRadius: "var(--agent-radius-xl, 14px)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--agent-text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 500,
        }}
      >
        {card.label}
      </div>
      <div
        style={{
          fontSize: card.emphasised ? 28 : 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--agent-text-primary)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.15,
          marginTop: 2,
        }}
      >
        {card.formatter(display)}
      </div>
      {card.sub && (
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{card.sub}</div>
      )}
    </div>
  );
}

export type MetricsBandProps = {
  thisMonthPence: number;
  exchangesThisMonth: number;
  inHouseThisMonth: number;
  outsourcedThisMonth: number;
  savedViaTrialLifetimePence: number;
  trialExchangeCountLifetime: number;
  billedLifetimePence: number;
};

function pounds(p: number): string {
  return `£${Math.round(p / 100).toLocaleString("en-GB")}`;
}
function poundsTwoDp(p: number): string {
  return `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MetricsBand(props: MetricsBandProps) {
  const cards: Card[] = [
    {
      label: "This month",
      value: props.thisMonthPence,
      formatter: poundsTwoDp,
      sub: undefined,
      emphasised: true,
    },
    {
      label: "Exchanges this month",
      value: props.exchangesThisMonth,
      formatter: (n) => Math.round(n).toString(),
      sub: `${props.inHouseThisMonth} in-house · ${props.outsourcedThisMonth} outsourced`,
    },
    {
      label: "Saved via trial",
      value: props.savedViaTrialLifetimePence,
      formatter: pounds,
      sub: `${props.trialExchangeCountLifetime} file${props.trialExchangeCountLifetime === 1 ? "" : "s"} given free`,
    },
    {
      label: "Billed lifetime",
      value: props.billedLifetimePence,
      formatter: pounds,
      sub: "From your invoice history",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {cards.map((c, i) => (
        <MetricCard key={i} card={c} />
      ))}
    </div>
  );
}
