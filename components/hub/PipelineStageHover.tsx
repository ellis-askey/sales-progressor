"use client";

import type { CSSProperties, ReactNode } from "react";
import type {
  StageStatsNew,
  StageStatsLegals,
  StageStatsReady,
  StageStatsExchanging,
  StageStatsCompleted,
} from "@/lib/services/hub";

// Small glass bubble that anchors above (or below) a pipeline-stage circle
// on hover / focus / tap. Same visual family as the drawer glass tokens so
// it feels like part of the system rather than a bespoke tooltip.
//
// Data is already scoped to the viewer's visibility upstream, so every
// number here is safe to render as-is — nothing role-specific in the copy.

export type StageKey = "new" | "legals" | "ready" | "exchanging" | "completed";

export type StageHoverProps =
  | { stage: "new"; stats: StageStatsNew }
  | { stage: "legals"; stats: StageStatsLegals }
  | { stage: "ready"; stats: StageStatsReady }
  | { stage: "exchanging"; stats: StageStatsExchanging }
  | { stage: "completed"; stats: StageStatsCompleted };

function formatCurrency(pence: number | null): string {
  if (pence === null) return "–";
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`;
  if (pounds >= 1_000) return `£${Math.round(pounds / 1_000)}k`;
  return `£${Math.round(pounds)}`;
}

function formatDays(n: number | null): string {
  if (n === null) return "–";
  if (n === 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

function formatPercent(fraction: number | null): string {
  if (fraction === null) return "–";
  return `${Math.round(fraction * 100)}%`;
}

const bubbleStyle: CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 12px)",
  left: "50%",
  transform: "translateX(-50%)",
  minWidth: 200,
  maxWidth: 240,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--agent-surface-elevated)",
  border: "0.5px solid var(--agent-glass-border)",
  boxShadow: "0 12px 32px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.06)",
  backdropFilter: "blur(16px) saturate(1.1)",
  WebkitBackdropFilter: "blur(16px) saturate(1.1)",
  zIndex: 20,
  pointerEvents: "none",
  animation: "enter 140ms cubic-bezier(0.4,0,0.2,1)",
};

const arrowStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%) rotate(45deg)",
  width: 10,
  height: 10,
  marginTop: -5,
  background: "var(--agent-surface-elevated)",
  borderRight: "0.5px solid var(--agent-glass-border)",
  borderBottom: "0.5px solid var(--agent-glass-border)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  fontSize: 12,
  color: "var(--agent-text-secondary)",
  lineHeight: 1.5,
};

const valueStyle: CSSProperties = {
  fontWeight: 600,
  color: "var(--agent-text-primary)",
  fontVariantNumeric: "tabular-nums",
};

export function PipelineStageHover(props: StageHoverProps) {
  return (
    <div style={bubbleStyle} role="tooltip">
      <div style={arrowStyle} />
      {renderBody(props)}
    </div>
  );
}

function renderBody(props: StageHoverProps): ReactNode {
  if (props.stage === "new") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="No new files right now" />;
    return (
      <>
        <Header title="New files" count={s.count} />
        <StatList>
          <StatRow label="Oldest waiting" value={formatDays(s.oldestDays)} />
          <StatRow label="New this week" value={String(s.newThisWeek)} />
          <StatRow label="Quiet 7+ days" value={String(s.quietFiles)} tone={s.quietFiles > 0 ? "warn" : "neutral"} />
        </StatList>
      </>
    );
  }

  if (props.stage === "legals") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="No files in legals" />;
    return (
      <>
        <Header title="In legals" count={s.count} />
        <StatList>
          <StatRow label="Waiting on vendor" value={String(s.vendorBlocking + s.bothBlocking)} />
          <StatRow label="Waiting on buyer" value={String(s.buyerBlocking + s.bothBlocking)} />
          <StatRow label="Median time here" value={formatDays(s.medianDaysInLegals)} />
        </StatList>
      </>
    );
  }

  if (props.stage === "ready") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="Nothing ready to exchange" />;
    return (
      <>
        <Header title="Ready to exchange" count={s.count} />
        <StatList>
          <StatRow
            label="Overdue"
            value={String(s.overdueToExchange)}
            tone={s.overdueToExchange > 0 ? "warn" : "neutral"}
          />
          <StatRow label="Median days out" value={formatDays(s.medianDaysToExchange)} />
          <StatRow label="Value locked" value={formatCurrency(s.totalValueLocked)} />
        </StatList>
      </>
    );
  }

  if (props.stage === "exchanging") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="Nothing exchanged yet" />;
    return (
      <>
        <Header title="Exchanged, awaiting completion" count={s.count} />
        <StatList>
          <StatRow label="Completing this week" value={String(s.completingThisWeek)} />
          <StatRow label="Median days since exchange" value={formatDays(s.medianDaysSinceExchange)} />
          <StatRow label="Value about to land" value={formatCurrency(s.totalValueClosing)} />
        </StatList>
      </>
    );
  }

  const s = props.stats;
  if (s.count === 0) return <Empty label="No completions this year yet" />;
  return (
    <>
      <Header title="Completed this year" count={s.count} />
      <StatList>
        <StatRow label="Value closed" value={formatCurrency(s.totalValueClosed)} />
        <StatRow label="Median days to close" value={formatDays(s.medianDaysToComplete)} />
        <StatRow
          label="Within 12-week target"
          value={formatPercent(s.slaHitRate)}
          tone={s.slaHitRate !== null && s.slaHitRate >= 0.75 ? "good" : "neutral"}
        />
      </StatList>
    </>
  );
}

function Header({ title, count }: { title: string; count: number }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 8,
      paddingBottom: 6,
      borderBottom: "0.5px solid var(--agent-glass-border)",
      gap: 12,
    }}>
      <p style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--agent-text-primary)",
      }}>{title}</p>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--agent-text-muted)",
        fontVariantNumeric: "tabular-nums",
      }}>{count}</span>
    </div>
  );
}

function StatList({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
}

function StatRow({
  label, value, tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn" | "good";
}) {
  const toneColor =
    tone === "warn" ? "var(--agent-warning)" :
    tone === "good" ? "var(--agent-success, #059669)" :
    "var(--agent-text-primary)";
  return (
    <div style={rowStyle}>
      <span>{label}</span>
      <span style={{ ...valueStyle, color: toneColor }}>{value}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p style={{
      margin: 0,
      fontSize: 12,
      color: "var(--agent-text-muted)",
      lineHeight: 1.55,
      textAlign: "center",
      padding: "4px 4px",
    }}>{label}</p>
  );
}
