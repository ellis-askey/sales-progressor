"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import type {
  StageStatsNew,
  StageStatsOnboarding,
  StageStatsSearches,
  StageStatsEnquiries,
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

export type StageKey = "new" | "onboarding" | "searches" | "enquiries" | "ready" | "exchanging" | "completed";

export type StageHoverProps =
  | { stage: "new"; stats: StageStatsNew; anchor: DOMRect | null }
  | { stage: "onboarding"; stats: StageStatsOnboarding; anchor: DOMRect | null }
  | { stage: "searches"; stats: StageStatsSearches; anchor: DOMRect | null }
  | { stage: "enquiries"; stats: StageStatsEnquiries; anchor: DOMRect | null }
  | { stage: "ready"; stats: StageStatsReady; anchor: DOMRect | null }
  | { stage: "exchanging"; stats: StageStatsExchanging; anchor: DOMRect | null }
  | { stage: "completed"; stats: StageStatsCompleted; anchor: DOMRect | null };

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

// Bubble is rendered into a portal on document.body so it escapes the
// pipeline strip's overflow-x context (which would otherwise clip it).
// We compute a fixed viewport position from the circle's bounding rect,
// preferring above the circle but flipping below if it would clip the
// top of the viewport.
const BUBBLE_WIDTH = 224;
const BUBBLE_GAP = 12;

function positionFor(anchor: DOMRect): { style: CSSProperties; placement: "above" | "below" } {
  const centreX = anchor.left + anchor.width / 2;
  // Clamp the bubble horizontally so it stays inside the viewport with an
  // 8px margin — small screens with a stage near the edge don't lose it.
  const halfWidth = BUBBLE_WIDTH / 2;
  const minLeft = 8;
  const maxLeft = window.innerWidth - BUBBLE_WIDTH - 8;
  const rawLeft = centreX - halfWidth;
  const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));

  // Room above? If not, place below.
  const roomAbove = anchor.top;
  const placement: "above" | "below" = roomAbove > 140 ? "above" : "below";

  const top = placement === "above"
    ? anchor.top - BUBBLE_GAP
    : anchor.bottom + BUBBLE_GAP;

  return {
    style: {
      position: "fixed",
      top,
      left,
      transform: placement === "above" ? "translateY(-100%)" : "none",
      width: BUBBLE_WIDTH,
    },
    placement,
  };
}

const bubbleBaseStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--agent-surface-elevated)",
  border: "0.5px solid var(--agent-glass-border)",
  boxShadow: "0 12px 32px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.06)",
  backdropFilter: "blur(24px) saturate(1.8)",
  WebkitBackdropFilter: "blur(24px) saturate(1.8)",
  // Shell topbar dropdown is 200, sidebar 100. Stay above both so the
  // bubble never gets covered when a stage circle is near the top of
  // the viewport and the bubble flips above the header.
  zIndex: 300,
  pointerEvents: "none",
  // opacity-only fade so the animation doesn't clobber the inline
  // transform (translateY(-100%)) that anchors the bubble above the
  // circle. `enter` animates translateY and would flash the bubble
  // below the anchor for a frame before snapping into place.
  animation: "enter-fade 140ms cubic-bezier(0.4,0,0.2,1)",
};

function arrowStyleFor(placement: "above" | "below", anchor: DOMRect, bubbleLeft: number): CSSProperties {
  // The arrow points at the circle centre. Because the bubble may be
  // clamped horizontally, compute the arrow's left offset inside the
  // bubble from the anchor centre X.
  const centreX = anchor.left + anchor.width / 2;
  const arrowLeft = Math.max(12, Math.min(BUBBLE_WIDTH - 12, centreX - bubbleLeft));
  const base: CSSProperties = {
    position: "absolute",
    left: arrowLeft,
    transform: "translateX(-50%) rotate(45deg)",
    width: 10,
    height: 10,
    background: "var(--agent-surface-elevated)",
    borderRight: "0.5px solid var(--agent-glass-border)",
    borderBottom: "0.5px solid var(--agent-glass-border)",
  };
  return placement === "above"
    ? { ...base, top: "100%", marginTop: -5 }
    : { ...base, bottom: "100%", marginBottom: -5, borderRight: "none", borderBottom: "none", borderLeft: "0.5px solid var(--agent-glass-border)", borderTop: "0.5px solid var(--agent-glass-border)" };
}

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

// Canonical hub-popup palette. The bubble is portaled to document.body,
// OUTSIDE .agent-shell-root, so the --agent-* tokens don't inherit here. We
// inject the values the bubble needs onto its root (light/dark) so every child
// — surface, text, arrow — resolves against them. Frosty translucent surface,
// matching the status menu + portal nav; item 5 makes every hub popup share it.
const HOVER_TOKENS_DARK: Record<string, string> = {
  "--agent-surface-elevated": "rgba(20, 28, 44, 0.72)",
  "--agent-glass-border": "rgba(255, 255, 255, 0.14)",
  "--agent-text-primary": "#EFF6FF",
  "--agent-text-secondary": "rgba(226, 232, 240, 0.88)",
  "--agent-text-muted": "rgba(226, 232, 240, 0.62)",
  "--agent-warning": "#FBBF24",
  "--agent-success": "#34D399",
};
const HOVER_TOKENS_LIGHT: Record<string, string> = {
  "--agent-surface-elevated": "rgba(255, 255, 255, 0.85)",
  "--agent-glass-border": "rgba(15, 23, 42, 0.08)",
  "--agent-text-primary": "#1e293b",
  "--agent-text-secondary": "#475569",
  "--agent-text-muted": "#64748b",
  "--agent-warning": "#b45309",
  "--agent-success": "#059669",
};

export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function PipelineStageHover(props: StageHoverProps) {
  const [mounted, setMounted] = useState(false);
  const isDark = useIsDarkTheme();
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !props.anchor) return null;

  const { style: posStyle, placement } = positionFor(props.anchor);
  const bubbleLeft = typeof posStyle.left === "number" ? posStyle.left : 0;
  const tokens = (isDark ? HOVER_TOKENS_DARK : HOVER_TOKENS_LIGHT) as CSSProperties;

  const bubble = (
    <div style={{ ...tokens, ...bubbleBaseStyle, ...posStyle }} role="tooltip">
      <div style={arrowStyleFor(placement, props.anchor, bubbleLeft)} />
      {renderBody(props)}
    </div>
  );

  return createPortal(bubble, document.body);
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

  if (props.stage === "onboarding") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="Nothing in onboarding" />;
    return (
      <>
        <Header title="Getting set up" count={s.count} />
        <StatList>
          <StatRow label="Awaiting draft pack" value={String(s.awaitingDraftPack)} tone={s.awaitingDraftPack > 0 ? "warn" : "neutral"} />
          <StatRow label="Oldest here" value={formatDays(s.oldestDays)} />
        </StatList>
      </>
    );
  }

  if (props.stage === "searches") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="No files in searches" />;
    return (
      <>
        <Header title="Searches" count={s.count} />
        <StatList>
          <StatRow label="Awaiting results" value={String(s.awaitingResults)} tone={s.awaitingResults > 0 ? "warn" : "neutral"} />
          <StatRow label="Oldest here" value={formatDays(s.oldestDays)} />
        </StatList>
      </>
    );
  }

  if (props.stage === "enquiries") {
    const s = props.stats;
    if (s.count === 0) return <Empty label="No files in enquiries" />;
    return (
      <>
        <Header title="Enquiries" count={s.count} />
        <StatList>
          <StatRow label="Loop still open" value={String(s.openLoops)} tone={s.openLoops > 0 ? "warn" : "neutral"} />
          <StatRow label="Oldest here" value={formatDays(s.oldestDays)} />
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
