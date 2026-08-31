"use client";

// components/billing/v2/MetricsStrip.tsx
//
// Lighter than v1 MetricsBand. A thin row of four labelled figures
// separated by hairline dividers, sitting on the clean canvas — no card
// chrome. Numbers still count up on mount (calm money UI), but at a
// quieter size. Context, not hero. The building invoice below carries
// the visual weight.

import { useCountUp } from "@/lib/hooks/useCountUp";

export type MetricsStripProps = {
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

function Cell({
  label,
  display,
  format,
  sub,
}: {
  label: string;
  display: number;
  format: (n: number) => string;
  sub?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "6px 4px" }}>
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 0.7,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 17,
          fontWeight: 500,
          color: "#111827",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {format(display)}
      </div>
      {sub && (
        <div style={{ marginTop: 2, fontSize: 11, color: "#9ca3af" }}>{sub}</div>
      )}
    </div>
  );
}

export function MetricsStrip(props: MetricsStripProps) {
  const thisMonth = useCountUp(props.thisMonthPence, { duration: 700 });
  const exchanges = useCountUp(props.exchangesThisMonth, { duration: 700 });
  const saved = useCountUp(props.savedViaTrialLifetimePence, { duration: 700 });
  const lifetime = useCountUp(props.billedLifetimePence, { duration: 700 });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        padding: "10px 0",
        borderTop: "0.5px solid rgba(0,0,0,0.08)",
        borderBottom: "0.5px solid rgba(0,0,0,0.08)",
      }}
    >
      <Cell label="This month" display={thisMonth} format={poundsTwoDp} />
      <div style={{ width: "0.5px", background: "rgba(0,0,0,0.08)" }} />
      <Cell
        label="Exchanges this month"
        display={exchanges}
        format={(n) => Math.round(n).toString()}
        sub={`${props.inHouseThisMonth} self-progress · ${props.outsourcedThisMonth} outsourced`}
      />
      <div style={{ width: "0.5px", background: "rgba(0,0,0,0.08)" }} />
      <Cell
        label="Given free"
        display={saved}
        format={pounds}
        sub={`${props.trialExchangeCountLifetime} file${props.trialExchangeCountLifetime === 1 ? "" : "s"} given free`}
      />
      <div style={{ width: "0.5px", background: "rgba(0,0,0,0.08)" }} />
      <Cell
        label="Billed lifetime"
        display={lifetime}
        format={pounds}
        sub="From your invoice history"
      />
    </div>
  );
}
