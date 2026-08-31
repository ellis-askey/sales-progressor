"use client";

// components/billing/v2/MetricsStrip.tsx
//
// Lighter than v1 MetricsBand. A thin row of four labelled figures
// separated by hairline dividers, sitting on the clean canvas — no card
// chrome. Numbers still count up on mount (calm money UI), but at a
// quieter size. Context, not hero. The building invoice below carries
// the visual weight.

import { CreditCard, ArrowsLeftRight, Gift, Receipt } from "@phosphor-icons/react";
import { useCountUp } from "@/lib/hooks/useCountUp";

export type MetricsStripProps = {
  thisMonthPence: number;
  exchangesThisMonth: number;
  inHouseThisMonth: number;
  outsourcedThisMonth: number;
  savedViaTrialLifetimePence: number;
  trialExchangeCountLifetime: number;
  billedLifetimePence: number;
  invoiceCount?: number;
};

function pounds(p: number): string {
  return `£${Math.round(p / 100).toLocaleString("en-GB")}`;
}
function poundsTwoDp(p: number): string {
  return `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  icon,
  label,
  display,
  format,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  display: number;
  format: (n: number) => string;
  sub?: string;
}) {
  return (
    <div
      className="account-card"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(14px) saturate(115%)",
        WebkitBackdropFilter: "blur(14px) saturate(115%)",
        border: "0.5px solid rgba(0,0,0,0.07)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 22px rgba(20,14,10,0.05)",
        padding: "16px 18px",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--agent-coral-deep, #E2452A)",
          marginBottom: 10,
        }}
      >
        {icon}
      </span>
      <div style={{ fontSize: 11.5, color: "#6b7280", fontWeight: 500 }}>{label}</div>
      <div
        style={{
          marginTop: 3,
          fontSize: 24,
          fontWeight: 700,
          color: "#111827",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {format(display)}
      </div>
      {sub && <div style={{ marginTop: 3, fontSize: 11.5, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

export function MetricsStrip(props: MetricsStripProps) {
  const thisMonth = useCountUp(props.thisMonthPence, { duration: 700 });
  const exchanges = useCountUp(props.exchangesThisMonth, { duration: 700 });
  const saved = useCountUp(props.savedViaTrialLifetimePence, { duration: 700 });
  const lifetime = useCountUp(props.billedLifetimePence, { duration: 700 });

  return (
    <div className="account-metrics-grid">
      <style>{`
        /* 4 across, or a clean 2x2, or 1 col — never a lopsided 3+1. */
        .account-metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 1100px) { .account-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 520px)  { .account-metrics-grid { grid-template-columns: 1fr; } }
      `}</style>
      <StatCard
        icon={<CreditCard size={22} weight="bold" />}
        label="This month"
        display={thisMonth}
        format={poundsTwoDp}
        sub={`${props.outsourcedThisMonth} outsourced exchange${props.outsourcedThisMonth === 1 ? "" : "s"}`}
      />
      <StatCard
        icon={<ArrowsLeftRight size={22} weight="bold" />}
        label="Exchanges this month"
        display={exchanges}
        format={(n) => Math.round(n).toString()}
        sub={`${props.outsourcedThisMonth} outsourced · ${props.inHouseThisMonth} self-progress`}
      />
      <StatCard
        icon={<Gift size={22} weight="bold" />}
        label="Given free"
        display={saved}
        format={pounds}
        sub={`${props.trialExchangeCountLifetime} file${props.trialExchangeCountLifetime === 1 ? "" : "s"} given free`}
      />
      <StatCard
        icon={<Receipt size={22} weight="bold" />}
        label="Billed lifetime"
        display={lifetime}
        format={pounds}
        sub={props.invoiceCount != null ? `From ${props.invoiceCount} invoice${props.invoiceCount === 1 ? "" : "s"}` : "From your invoice history"}
      />
    </div>
  );
}
