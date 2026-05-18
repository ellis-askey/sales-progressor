"use client";
/*
 * Polish reference for /agent/analytics — Stage 2.
 * Visual target for Stage 4 production swap.
 *
 * Period tabs:        agent-segment-pill (production: replace custom inline button styles)
 * MissingFees:        agent-acc accordion + CaretDown rotation (production: replace plain setState)
 * Empty state card:   agent-glass-strong (production: was glass-card)
 * Ghost opacity:      0.35 (production: was 0.3)
 *
 * Mobile treatment (Section 9):
 *   PRIMARY charts (work at 375px):   SubmissionFunnel, SpeedGauge
 *   REFERENCE charts (hidden <768px): VolumeBarChart, MonthlyMixChart, ValueHeatTiles
 *
 * getThemeColor: resolves --agent-* CSS variables from the nearest [data-theme] container.
 * Used for Recharts JS-prop colour values. SVG fill/stroke attrs accept var() directly.
 * Stage 4: call getThemeColor inside useMemo keyed to theme to re-resolve on theme switch.
 *
 * Chart animation policy:
 *   KpiSparkline:    isAnimationActive={false} is DELIBERATE — 3 simultaneous sparkline
 *                    animations on every period-tab change would be visually noisy/janky.
 *                    No value in animating compact 28px lines. Keep as-is at Stage 4.
 *   VolumeBarChart:  animation ON (Recharts default). Single chart; bar draw-in on mount
 *                    feels alive. Keep as-is.
 *   MonthlyMixChart: animation ON (Recharts default). Same reasoning. Keep as-is.
 *
 * KpiSparkline zero-data behaviour: when all data values are 0, renders an invisible 28px
 * spacer. This does NOT look broken — the number stands alone with adequate breathing room
 * and the absence of a line implicitly signals "no trend data yet". No fix needed at Stage 4.
 * Toggle "zero-spark" in pp-controls to verify this visually.
 *
 * Chart tokenisation (Stage 4 applies to source components):
 *   SubmissionFunnel:  STAGE_COLORS.completed.bar/dot = "#16A34A" → "var(--agent-success)"
 *   SpeedGauge:        track gradient #16A34A/#C97D1A/#D94F4F → var(--agent-success/warning/danger)
 *   ValueHeatTiles:    rgba(255,138,101,…) → rgba(var(--agent-coral-rgb),…)
 *   AnalyticsCharts:   CartesianGrid stroke rgba(180,130,90,0.12) → rgba(var(--agent-border-rgb),0.12)
 *   KpiSparkline:      default color="#FF8A65" → caller passes "var(--agent-coral)"
 *   LeaderboardTable:  isFirst row rgba(255,138,101,…) → rgba(var(--agent-coral-base-rgb),…)
 *
 * Sub-decisions (inventory §14):
 *   Period tabs:       agent-segment-pill — canonical per ANIMATION_STANDARDS.md §1
 *   Missing fees acc:  agent-acc — canonical per ANIMATION_STANDARDS.md §1
 *   REFERENCE mobile:  hidden md:block wrapper — matches completions/comms precedent
 *   Ghost opacity:     0.35 — canonical per POST_LAUNCH_FIXES.md ghost convention
 *   Director mock:     isDirector=true shows leaderboard, team filter, referral sections
 *   All-time referral: not filtered by period — classified theoretical (docs/POST_LAUNCH_FIXES.md)
 */

import { useState, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { VolumeBarChart, MonthlyMixChart } from "@/components/analytics/AnalyticsCharts";
import { KpiSparkline } from "@/components/analytics/KpiSparkline";
import { SubmissionFunnel } from "@/components/analytics/SubmissionFunnel";
import { SpeedGauge } from "@/components/analytics/SpeedGauge";
import { ValueHeatTiles } from "@/components/analytics/ValueHeatTiles";
import { FilesAtRiskPanel } from "@/components/analytics/FilesAtRiskPanel";
import { LeaderboardTable, type LeaderboardRow } from "@/components/analytics/LeaderboardTable";
import type { SubmissionFunnelData, FilesAtRiskData } from "@/lib/services/analytics";
import type { VolumeEntry } from "@/components/analytics/AnalyticsCharts";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ThemeName     = "sunset" | "coastal" | "heritage" | "slate" | "emerald" | "claret";
type ViewState     = "populated" | "partial-empty" | "empty" | "loading";
type Period        = "week" | "month" | "year" | "all";
type SolicitorMode = "none" | "single" | "multi";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function getThemeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const themed = document.querySelector<HTMLElement>("[data-theme]");
  const target  = themed ?? document.documentElement;
  const val = getComputedStyle(target).getPropertyValue(varName).trim();
  return val || fallback;
}

function fmtGBP(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

function speedBadge(days: number) {
  if (days <= 70)  return { label: "Fast",    color: "var(--agent-success)", bg: "var(--agent-success-bg)", border: "var(--agent-success-border)" };
  if (days <= 100) return { label: "Typical", color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" };
  return               { label: "Slow",    color: "var(--agent-danger)",  bg: "var(--agent-danger-bg)",  border: "var(--agent-danger-border)"  };
}

/* ─── Mock data ──────────────────────────────────────────────────────────── */

const PERIODS: { key: Period; label: string }[] = [
  { key: "week",  label: "This week"  },
  { key: "month", label: "This month" },
  { key: "year",  label: "This year"  },
  { key: "all",   label: "All time"   },
];

const THEME_NAMES: ThemeName[] = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"];

const MOCK_KPI = {
  labels:         ["Nov", "Nov", "Dec", "Dec", "Jan", "Jan", "Feb", "Feb", "Mar", "Mar", "Apr", "Apr"],
  submitted:      [3, 4, 2, 5, 3, 6, 4, 5, 3, 7, 5, 4],
  exchanged:      [2, 3, 1, 4, 2, 4, 3, 4, 2, 5, 4, 3],
  completed:      [1, 2, 1, 2, 1, 3, 2, 2, 1, 3, 2, 2],
  submittedValue: [42, 56, 28, 70, 42, 84, 56, 70, 42, 98, 70, 56].map((v) => v * 100_000_00),
};

const MOCK_KPI_ZERO = {
  submitted:      new Array(12).fill(0) as number[],
  exchanged:      new Array(12).fill(0) as number[],
  completed:      new Array(12).fill(0) as number[],
  submittedValue: new Array(12).fill(0) as number[],
};

const MOCK_FUNNEL: SubmissionFunnelData = {
  stages: [
    { key: "submitted", label: "Submitted", count: 12 },
    { key: "exchanged", label: "Exchanged", count:  8 },
    { key: "completed", label: "Completed", count:  5 },
  ],
  conversions: [
    { from: "submitted", to: "exchanged", percent: 67 },
    { from: "exchanged", to: "completed", percent: 63 },
  ],
};

const MOCK_SPEED_DAYS = 82;

const MOCK_VOLUME_BARS: VolumeEntry[] = [
  { label: "Nov 24", count: 3 }, { label: "Dec 24", count: 2 },
  { label: "Jan 25", count: 5 }, { label: "Feb 25", count: 4 },
  { label: "Mar 25", count: 7 }, { label: "Apr 25", count: 4 },
];

const MOCK_MONTHLY_MIX = [
  { month: "Jun", created: 2, exchanged: 1 }, { month: "Jul", created: 3, exchanged: 2 },
  { month: "Aug", created: 1, exchanged: 1 }, { month: "Sep", created: 4, exchanged: 3 },
  { month: "Oct", created: 3, exchanged: 2 }, { month: "Nov", created: 3, exchanged: 2 },
  { month: "Dec", created: 2, exchanged: 1 }, { month: "Jan", created: 5, exchanged: 3 },
  { month: "Feb", created: 4, exchanged: 3 }, { month: "Mar", created: 7, exchanged: 5 },
  { month: "Apr", created: 4, exchanged: 3 }, { month: "May", created: 4, exchanged: 0 },
];

const MOCK_SOLICITOR_STATS = [
  { firmId: "s1", firmName: "Harrison Solicitors",   exchangeCount: 5, avgDaysToExchange: 64  },
  { firmId: "s2", firmName: "Smith & Co Solicitors", exchangeCount: 3, avgDaysToExchange: 87  },
  { firmId: "s3", firmName: "Clifton Law Partners",  exchangeCount: 2, avgDaysToExchange: 108 },
];

const MOCK_MISSING_FEES = [
  { id: "m1", address: "14 Birchwood Lane, Guildford, GU1 1AB", ownerLine: "Sarah Chen · Negotiator"  },
  { id: "m2", address: "7 Orchard Road, Bath, BA1 2NE",         ownerLine: "Tom Wallace · Negotiator" },
  { id: "m3", address: "22 Clifton Park, Bristol, BS8 3HJ",     ownerLine: null                        },
  { id: "m4", address: "33 Park Street, Bristol, BS1 5NE",      ownerLine: "Sarah Chen · Negotiator"  },
  { id: "m5", address: "8 Victoria Road, Brighton, BN1 1XZ",    ownerLine: "Tom Wallace · Negotiator" },
];

const MOCK_FILES_AT_RISK_ISSUES: FilesAtRiskData = {
  overdueChases:    { count: 2, transactionIds: ["tx1", "tx2"] },
  stalled:          { count: 1, transactionIds: ["tx3"] },
  missingEventDate: { count: 0, transactionIds: [] },
};

const MOCK_FILES_AT_RISK_CLEAR: FilesAtRiskData = {
  overdueChases:    { count: 0, transactionIds: [] },
  stalled:          { count: 0, transactionIds: [] },
  missingEventDate: { count: 0, transactionIds: [] },
};

const MOCK_LEADERBOARD: LeaderboardRow[] = [
  { id: "u1", name: "Sarah Chen",  role: "negotiator", submitted: 7, exchanged: 5, conversion: 71,  pipelineValue: 140_000_000, avgFee: 126_000, lockedFees: 525_000 },
  { id: "u2", name: "Tom Wallace", role: "negotiator", submitted: 4, exchanged: 2, conversion: 50,  pipelineValue:  80_000_000, avgFee: 108_000, lockedFees: 180_000 },
  { id: "u3", name: "Priya Mehta", role: "director",   submitted: 1, exchanged: 1, conversion: 100, pipelineValue:  20_000_000, avgFee: 132_000, lockedFees: 132_000 },
];

const MOCK_REFERRAL_STATS = [
  { firmId: "r1", firmName: "Harrison Solicitors", referralCount: 5, feeReceivedPence: 125_000, feeExpectedPence: 200_000 },
];

const MOCK_BROKER_STATS = [
  { firmId: "b1", firmName: "Prime Mortgages Ltd", referralCount: 3, feeReceivedPence: 75_000, feeExpectedPence: 75_000 },
];

/* ─── Page-level CSS ─────────────────────────────────────────────────────── */

const CSS = `
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }

  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    animation-delay: 0ms !important; transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  [data-rm="1"] .agent-acc, [data-rm="1"] .agent-acc.open { transition: none !important; }
`;

/* ─── Main page ───────────────────────────────────────────────────────────── */

export default function AnalyticsPolishPage() {
  const [viewState,       setViewState]       = useState<ViewState>("populated");
  const [period,          setPeriod]          = useState<Period>("month");
  const [isDirector,      setIsDirector]      = useState(true);
  const [solicitorMode,   setSolicitorMode]   = useState<SolicitorMode>("multi");
  const [hasConvRefs,     setHasConvRefs]     = useState(true);
  const [hasBrokerRefs,   setHasBrokerRefs]   = useState(true);
  const [hasRiskIssues,   setHasRiskIssues]   = useState(true);
  const [hasMissingFees,  setHasMissingFees]  = useState(true);
  const [zeroSparklines,  setZeroSparklines]  = useState(false);
  const [theme,           setTheme]           = useState<ThemeName>("sunset");
  const [night,           setNight]           = useState(false);
  const [rm,              setRm]              = useState(false);
  const [feesOpen,        setFeesOpen]        = useState(false);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!shell) return;
    if (night) shell.setAttribute("data-night", "");
    else shell.removeAttribute("data-night");
    return () => { shell.removeAttribute("data-night"); };
  }, [night]);

  const isPartialEmpty = viewState === "partial-empty";
  const showMainContent = viewState === "populated" || isPartialEmpty;

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Month";
  const periodWord  = period === "week" ? "week" : period === "month" ? "month" : "year";
  const chartTitle  =
    period === "week"  ? "Files submitted — last 7 days"   :
    period === "month" ? "Files submitted — last 6 months" :
    period === "year"  ? "Files submitted — last 12 months":
                         "Files submitted — all time";
  const thisMonthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const useZeroKpi = zeroSparklines || isPartialEmpty;
  const kpiData    = useZeroKpi ? MOCK_KPI_ZERO : MOCK_KPI;

  const coralColor   = getThemeColor("--agent-coral",         "var(--agent-coral)");
  const successColor = getThemeColor("--agent-success",       "var(--agent-success)");
  const mutedColor   = getThemeColor("--agent-text-secondary","var(--agent-text-secondary)");

  const badge         = speedBadge(MOCK_SPEED_DAYS);
  const riskData      = hasRiskIssues ? MOCK_FILES_AT_RISK_ISSUES : MOCK_FILES_AT_RISK_CLEAR;
  const solicitorRows = solicitorMode === "none" ? [] : solicitorMode === "single" ? [MOCK_SOLICITOR_STATS[0]] : MOCK_SOLICITOR_STATS;
  const showLeaderboard = isDirector && viewState !== "empty";

  return (
    <>
      <style>{CSS}</style>

      {/* ── pp-controls ───────────────────────────────────────────────────── */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(30,45,74,0.08)",
        background: "rgba(30,45,74,0.03)",
        display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
      }}>
        <span className="pp-bar-label" style={{ fontWeight: 600 }}>analytics — Stage 2</span>

        <div className="pp-bar">
          <span className="pp-bar-label">state</span>
          {(["populated", "partial-empty", "empty", "loading"] as ViewState[]).map((s) => (
            <button key={s} type="button" className={`pp-pill${viewState === s ? " on" : ""}`}
              onClick={() => setViewState(s)}>{s}</button>
          ))}
        </div>

        <div className="pp-bar">
          <span className="pp-bar-label">role</span>
          <button type="button" className={`pp-pill${isDirector ? " on" : ""}`}
            onClick={() => setIsDirector(true)}>director</button>
          <button type="button" className={`pp-pill${!isDirector ? " on" : ""}`}
            onClick={() => setIsDirector(false)}>negotiator</button>
        </div>

        {/* Conditional sections — on=present, off=absent/zero. Solicitor: radio for count. */}
        <div className="pp-bar">
          <span className="pp-bar-label">solicitors</span>
          <button type="button" className={`pp-pill${solicitorMode === "none" ? " on" : ""}`}
            onClick={() => setSolicitorMode("none")}>none</button>
          <button type="button" className={`pp-pill${solicitorMode === "single" ? " on" : ""}`}
            onClick={() => setSolicitorMode("single")}>1</button>
          <button type="button" className={`pp-pill${solicitorMode === "multi" ? " on" : ""}`}
            onClick={() => setSolicitorMode("multi")}>3</button>
        </div>

        <div className="pp-bar">
          <span className="pp-bar-label">sections</span>
          <button type="button" className={`pp-pill${hasConvRefs ? " on" : ""}`}
            onClick={() => setHasConvRefs((v) => !v)}>conv-refs</button>
          <button type="button" className={`pp-pill${hasBrokerRefs ? " on" : ""}`}
            onClick={() => setHasBrokerRefs((v) => !v)}>broker-refs</button>
          <button type="button" className={`pp-pill${hasRiskIssues ? " on" : ""}`}
            onClick={() => setHasRiskIssues((v) => !v)}>risk</button>
          <button type="button" className={`pp-pill${hasMissingFees ? " on" : ""}`}
            onClick={() => setHasMissingFees((v) => !v)}>fees</button>
          <button type="button" className={`pp-pill${zeroSparklines ? " on" : ""}`}
            onClick={() => setZeroSparklines((v) => !v)}>zero-spark</button>
        </div>

        <div className="pp-bar">
          <span className="pp-bar-label">theme</span>
          {THEME_NAMES.map((t) => (
            <button key={t} type="button" className={`pp-pill${theme === t ? " on" : ""}`}
              onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>

        <div className="pp-bar">
          <span className="pp-bar-label">opts</span>
          <button type="button" className={`pp-pill${night ? " on" : ""}`}
            onClick={() => setNight((v) => !v)}>night</button>
          <button type="button" className={`pp-pill${rm ? " on" : ""}`}
            onClick={() => setRm((v) => !v)}>rm</button>
        </div>
      </div>

      {/* ── Production content ────────────────────────────────────────────── */}
      <div className="agent-bg" data-theme={theme} data-rm={rm ? "1" : "0"}>

        <PageHeader title="Analytics" subtitle="Performance and revenue across your pipeline.">
          {/* Director: mock team filter — negotiator sees nothing here */}
          {isDirector && showMainContent && (
            <select className="glass-input" style={{ fontSize: 12, padding: "5px 10px" }} defaultValue="">
              <option value="">All team</option>
              {MOCK_LEADERBOARD.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </PageHeader>

        <div className="px-4 py-5 sm:px-8 flex flex-col gap-[18px]">

          {/* ── Loading ───────────────────────────────────────────────────── */}
          {viewState === "loading" && <AnalyticsSkeleton />}

          {/* ── Empty (zero transactions ever) ────────────────────────────── */}
          {viewState === "empty" && (
            <>
              <div
                className="agent-glass-strong"
                style={{ padding: "48px 24px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}
              >
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none"
                  style={{ margin: "0 auto 16px", display: "block", opacity: 0.45 }} aria-hidden="true">
                  <rect x="6"  y="30" width="10" height="12" rx="2" fill="var(--agent-coral)" />
                  <rect x="19" y="20" width="10" height="22" rx="2" fill="var(--agent-coral)" />
                  <rect x="32" y="10" width="10" height="32" rx="2" fill="var(--agent-coral)" />
                </svg>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                  Analytics will appear here as you submit sales.
                </p>
                <p style={{ margin: "0 auto 20px", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                  Once your first file is submitted, you&apos;ll see pipeline value, fee tracking, conversion rates, and monthly trends.
                </p>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="agent-btn agent-btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", fontSize: 13, textDecoration: "none" }}
                >
                  + Submit your first sale
                </a>
              </div>
              <AnalyticsGhost />
            </>
          )}

          {/* ── Populated + Partial-empty (share one render path) ─────────── */}
          {showMainContent && (
            <>

              {/* Period tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto",
                WebkitOverflowScrolling: "touch", paddingBottom: 2, scrollbarWidth: "none" }}>
                {PERIODS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`agent-segment-pill${period === key ? " on" : ""}`}
                    onClick={() => setPeriod(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Partial-empty banner — transactions exist but selected period is empty */}
              {isPartialEmpty && (
                <div style={{
                  background: "rgba(var(--agent-coral-base-rgb),0.06)",
                  border: "1px solid rgba(var(--agent-coral-base-rgb),0.20)",
                  borderRadius: 10, padding: "10px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                    No activity {period === "week" ? "this week" : period === "month" ? "this month" : period === "year" ? "this year" : "in this period"}. Try changing the period.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPeriod("all")}
                    className="agent-link"
                    style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                  >
                    All time →
                  </button>
                </div>
              )}

              {/* Counts — zeros in partial-empty; zero-spark toggles KpiSparkline data */}
              <div className="agent-glass" style={{ padding: "16px 20px" }}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="agent-eyebrow" style={{ marginBottom: 4 }}>Submitted</p>
                    <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--agent-coral)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {isPartialEmpty ? "0" : "12"}
                    </p>
                    {/* Stage 4: color={getThemeColor("--agent-coral", "#FF8A65")} */}
                    <KpiSparkline data={kpiData.submitted} labels={MOCK_KPI.labels} color={coralColor} />
                    {!isPartialEmpty && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: "var(--agent-success)" }}>↑ 3 vs last {periodWord}</p>
                    )}
                  </div>
                  <div>
                    <p className="agent-eyebrow" style={{ marginBottom: 4 }}>Exchanged</p>
                    <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--agent-success)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {isPartialEmpty ? "0" : "8"}
                    </p>
                    {!isPartialEmpty && <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>67% of submitted</p>}
                    {/* Stage 4: color={getThemeColor("--agent-success", "#1F8A4A")} */}
                    <KpiSparkline data={kpiData.exchanged} labels={MOCK_KPI.labels} color={successColor} />
                    {!isPartialEmpty && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: "var(--agent-success)" }}>↑ 2 vs last {periodWord}</p>
                    )}
                  </div>
                  <div>
                    <p className="agent-eyebrow" style={{ marginBottom: 4 }}>Completed</p>
                    <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {isPartialEmpty ? "0" : "5"}
                    </p>
                    {!isPartialEmpty && <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>63% of exchanged</p>}
                    {/* Stage 4: color={getThemeColor("--agent-text-secondary", ...)} */}
                    <KpiSparkline data={kpiData.completed} labels={MOCK_KPI.labels} color={mutedColor} />
                    {!isPartialEmpty && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: "var(--agent-success)" }}>↑ 2 vs last {periodWord}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Funnel + Speed — absent in partial-empty (no period activity) */}
              {!isPartialEmpty && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* SubmissionFunnel — PRIMARY: works at 375px */}
                  <div className="agent-glass" style={{ padding: "16px 20px" }}>
                    <p className="agent-eyebrow" style={{ marginBottom: 12 }}>
                      Conversion funnel — {periodLabel.toLowerCase()}
                    </p>
                    <SubmissionFunnel data={MOCK_FUNNEL} />
                  </div>
                  {/* SpeedGauge — PRIMARY: works at 375px */}
                  <div className="agent-glass" style={{ padding: "16px 20px" }}>
                    <p className="agent-eyebrow" style={{ marginBottom: 12 }}>Speed to exchange</p>
                    <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {MOCK_SPEED_DAYS} days
                    </p>
                    <p style={{ margin: "4px 0 8px", fontSize: 10, color: "var(--agent-text-muted)" }}>
                      avg from instruction · 8 files exchanged
                    </p>
                    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
                      {badge.label}
                    </span>
                    <SpeedGauge avgDays={MOCK_SPEED_DAYS} />
                  </div>
                </div>
              )}

              {/* Values */}
              <div className="agent-glass" style={{ padding: "16px 20px" }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="agent-eyebrow" style={{ marginBottom: 4 }}>Pipeline value</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                      {isPartialEmpty ? "£0" : "£2.40m"}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>Purchase prices</p>
                    {/* ValueHeatTiles — REFERENCE: hidden below 768px */}
                    <div className="hidden md:block">
                      <ValueHeatTiles data={kpiData.submittedValue} labels={MOCK_KPI.labels} />
                    </div>
                  </div>
                  <div>
                    <p className="agent-eyebrow" style={{ marginBottom: 4 }}>Value exchanged</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-success)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                      {isPartialEmpty ? "£0" : "£1.60m"}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>Exchanged files</p>
                    {!isPartialEmpty && (
                      <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: "var(--agent-success)" }}>
                        ↑ £400,000 vs last {periodWord}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Fees */}
              <div className="agent-glass" style={{ padding: "16px 20px" }}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Fee pipeline",  sub: "Inc. VAT where set", val: isPartialEmpty ? "—" : fmtGBP(1_440_000), color: "var(--agent-text-primary)" },
                    { label: "Locked in",     sub: "Exchanged files",    val: isPartialEmpty ? "—" : fmtGBP(960_000),   color: "var(--agent-success)"      },
                    { label: "Average fee",   sub: "Inc. VAT per file",  val: isPartialEmpty ? "—" : fmtGBP(120_000),   color: "var(--agent-text-primary)" },
                  ].map(({ label, sub, val, color }) => (
                    <div key={label}>
                      <p className="agent-eyebrow" style={{ marginBottom: 3 }}>{label}</p>
                      <p style={{ margin: "0 0 3px", fontSize: 10, color: "var(--agent-text-muted)" }}>{sub}</p>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fee forecast */}
              <div className="agent-glass" style={{ padding: "18px 22px" }}>
                <p className="agent-eyebrow" style={{ marginBottom: 12 }}>Fee forecast</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--agent-text-muted)" }}>Predicted for {thisMonthLabel}</p>
                    {isPartialEmpty ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>No exchanges predicted this month</p>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>{fmtGBP(360_000)}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>3 files · inc. VAT where set</p>
                      </>
                    )}
                  </div>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--agent-text-muted)" }}>Locked in already</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-success)", letterSpacing: "-0.02em" }}>
                      {isPartialEmpty ? "—" : fmtGBP(960_000)}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>from exchanged files</p>
                  </div>
                </div>
              </div>

              {/* REFERENCE charts — hidden below 768px */}
              <div className="hidden md:grid grid-cols-2 gap-3">
                <div className="agent-glass" style={{ padding: "18px 22px" }}>
                  <p className="agent-eyebrow" style={{ marginBottom: 14 }}>{chartTitle}</p>
                  <VolumeBarChart data={MOCK_VOLUME_BARS} />
                </div>
                <div className="agent-glass" style={{ padding: "18px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <p className="agent-eyebrow">Monthly activity — last 12 months</p>
                    <div style={{ display: "flex", gap: 12 }}>
                      {[{ label: "Created", color: "var(--agent-coral)" }, { label: "Exchanged", color: "var(--agent-warning)" }].map(({ label, color }) => (
                        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--agent-text-muted)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <MonthlyMixChart data={MOCK_MONTHLY_MIX} />
                </div>
              </div>

              {/* Solicitor exchange performance — absent when solicitorMode="none" */}
              {solicitorRows.length > 0 && (
                <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Solicitor exchange performance</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Average days from instruction to exchange · fastest first</p>
                  </div>
                  {solicitorRows.map((s, i) => {
                    const sb = speedBadge(s.avgDaysToExchange);
                    return (
                      <div
                        key={s.firmId}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                        style={{ padding: "11px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{s.firmName}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{s.exchangeCount} exchange{s.exchangeCount !== 1 ? "s" : ""}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 64, textAlign: "right" }}>{s.avgDaysToExchange} days</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>{sb.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Referral income · Conveyancers — director only, all-time, conv-refs toggle */}
              {isDirector && hasConvRefs && (
                <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Referral income · Conveyancers</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>All-time solicitor referral fees by firm</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-success)" }}>
                      {fmtGBP(MOCK_REFERRAL_STATS.reduce((s, r) => s + r.feeReceivedPence, 0))}
                    </p>
                  </div>
                  {MOCK_REFERRAL_STATS.map((r, i) => {
                    const pending = r.feeExpectedPence - r.feeReceivedPence;
                    return (
                      <div
                        key={r.firmId}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                        style={{ padding: "11px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{r.firmName}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{r.referralCount} referrals</span>
                          {r.feeReceivedPence > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-success)" }}>{fmtGBP(r.feeReceivedPence)} received</span>}
                          {pending > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-warning)" }}>{fmtGBP(pending)} pending</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Referral income · Brokers — director only, all-time, broker-refs toggle */}
              {isDirector && hasBrokerRefs && (
                <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Referral income · Brokers</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>All-time mortgage broker referral fees</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-success)" }}>
                      {fmtGBP(MOCK_BROKER_STATS.reduce((s, r) => s + r.feeReceivedPence, 0))}
                    </p>
                  </div>
                  {MOCK_BROKER_STATS.map((r, i) => {
                    const pending = r.feeExpectedPence - r.feeReceivedPence;
                    return (
                      <div
                        key={r.firmId}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                        style={{ padding: "11px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{r.firmName}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{r.referralCount} referrals</span>
                          {r.feeReceivedPence > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-success)" }}>{fmtGBP(r.feeReceivedPence)} received</span>}
                          {pending > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-warning)" }}>{fmtGBP(pending)} pending</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Referral income — period (director only, period-filtered) */}
              {isDirector && !isPartialEmpty && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p className="agent-eyebrow" style={{ paddingLeft: 2 }}>Referral income — {periodLabel.toLowerCase()}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="agent-glass" style={{ padding: "18px 22px" }}>
                      <p className="agent-eyebrow" style={{ marginBottom: 2 }}>In pipeline</p>
                      <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Active, pre-exchange</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em" }}>{fmtGBP(200_000)}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>5 files</p>
                    </div>
                    <div className="agent-glass" style={{ padding: "18px 22px" }}>
                      <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Exchanged — due</p>
                      <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)" }}>Payable on/after completion</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-warning)", letterSpacing: "-0.02em" }}>{fmtGBP(150_000)}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>3 files</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Files missing a fee — absent when hasMissingFees=false */}
              {hasMissingFees && (
                <div id="missing-fees" className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Files missing a fee</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Set the agent fee to include these files in your pipeline total.</p>
                  </div>
                  {MOCK_MISSING_FEES.slice(0, 3).map((f, i) => (
                    <div key={f.id} style={{ padding: "10px 20px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.address}</p>
                        {f.ownerLine && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{f.ownerLine}</p>}
                      </div>
                      <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", textDecoration: "none", flexShrink: 0 }}>Set fee →</a>
                    </div>
                  ))}
                  {/* Overflow rows in agent-acc */}
                  <div className={`agent-acc${feesOpen ? " open" : ""}`} style={rm ? { transition: "none" } : undefined}>
                    <div className="agent-acc-in">
                      {MOCK_MISSING_FEES.slice(3).map((f) => (
                        <div key={f.id} style={{ padding: "10px 20px", borderTop: "0.5px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.address}</p>
                            {f.ownerLine && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{f.ownerLine}</p>}
                          </div>
                          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", textDecoration: "none", flexShrink: 0 }}>Set fee →</a>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", padding: "10px 20px" }}>
                    <button
                      type="button"
                      onClick={() => setFeesOpen((v) => !v)}
                      className="agent-link agent-link-muted"
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
                    >
                      {feesOpen ? "Show less" : `Show all (${MOCK_MISSING_FEES.length})`}
                      <CaretDown style={{ width: 12, height: 12, flexShrink: 0, transition: "transform 200ms", transform: feesOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Files at risk — always shown; hasRiskIssues toggles issues vs clear */}
              <FilesAtRiskPanel data={riskData} />

              {/* Team leaderboard — director only */}
              {showLeaderboard && (
                <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Team leaderboard</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                      Performance by team member · {periodLabel.toLowerCase()}
                    </p>
                  </div>
                  <LeaderboardTable rows={MOCK_LEADERBOARD} currentUserId="u3" period={period} />
                </div>
              )}

            </>
          )}

        </div>

        {/* ── Mobile 375px frame ────────────────────────────────────────── */}
        <div style={{ borderTop: "1px solid rgba(30,45,74,0.08)", marginTop: 8, padding: "20px 16px 32px" }}>
          <p className="pp-bar-label" style={{ fontWeight: 600, marginBottom: 12 }}>Mobile — 375px (PRIMARY charts · period tabs · partial-empty banner)</p>
          <div style={{ width: 375, maxWidth: "100%", border: "1px solid rgba(30,45,74,0.12)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

              {viewState === "loading" && <AnalyticsSkeleton compact />}

              {viewState === "empty" && <AnalyticsGhost />}

              {showMainContent && (
                <>
                  {/* Period tabs — sm variant scrollable */}
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
                    {PERIODS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`agent-segment-pill agent-segment-pill-sm${period === key ? " on" : ""}`}
                        style={{ flexShrink: 0 }}
                        onClick={() => setPeriod(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Partial-empty banner on mobile */}
                  {isPartialEmpty && (
                    <div style={{ background: "rgba(var(--agent-coral-base-rgb),0.06)", border: "1px solid rgba(var(--agent-coral-base-rgb),0.20)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>
                        No activity {period === "week" ? "this week" : period === "month" ? "this month" : "this year"}.
                      </p>
                      <button type="button" onClick={() => setPeriod("all")} className="agent-link" style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                        All time →
                      </button>
                    </div>
                  )}
                  {/* Counts compact */}
                  <div className="agent-glass" style={{ padding: "12px 14px" }}>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Submitted", value: isPartialEmpty ? "0" : "12", color: "var(--agent-coral)"       },
                        { label: "Exchanged", value: isPartialEmpty ? "0" : "8",  color: "var(--agent-success)"     },
                        { label: "Completed", value: isPartialEmpty ? "0" : "5",  color: "var(--agent-text-primary)"},
                      ].map(({ label, value, color }) => (
                        <div key={label}>
                          <p className="agent-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{label}</p>
                          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* PRIMARY charts — shown on mobile */}
                  {!isPartialEmpty && (
                    <>
                      <div className="agent-glass" style={{ padding: "14px 16px" }}>
                        <p className="agent-eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>Conversion funnel</p>
                        <SubmissionFunnel data={MOCK_FUNNEL} />
                      </div>
                      <div className="agent-glass" style={{ padding: "14px 16px" }}>
                        <p className="agent-eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>Speed to exchange</p>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {MOCK_SPEED_DAYS} days
                        </p>
                        <SpeedGauge avgDays={MOCK_SPEED_DAYS} />
                      </div>
                    </>
                  )}
                  <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-disabled)", fontFamily: "monospace", textAlign: "center" }}>
                    VolumeBarChart · MonthlyMixChart · ValueHeatTiles hidden below 768px
                  </p>
                </>
              )}

            </div>
          </div>
        </div>

      </div>{/* /agent-bg */}
    </>
  );
}

/* ─── Loading skeleton ────────────────────────────────────────────────────── */

function AnalyticsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 18 }}>
      {!compact && (
        <div style={{ display: "flex", gap: 6 }}>
          {[72, 88, 72, 68].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 34, width: w, borderRadius: 99 }} />
          ))}
        </div>
      )}
      <div className="agent-glass" style={{ padding: "16px 20px" }}>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="agent-skeleton" style={{ height: 9, width: 56, borderRadius: 3, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 28, width: 40, borderRadius: 4, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 28, width: "100%", borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[[85, 55, 35], [40, 80]].map((widths, ci) => (
            <div key={ci} className="agent-glass" style={{ padding: "16px 20px" }}>
              <div className="agent-skeleton" style={{ height: 9, width: 120, borderRadius: 3, marginBottom: 16 }} />
              {widths.map((w, j) => (
                <div key={j} className="agent-skeleton" style={{ height: 9, width: `${w}%`, borderRadius: 3, marginBottom: 10 }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ghost — abstract skeleton shapes, opacity 0.35 ─────────── */

function AnalyticsGhost() {
  return (
    <div style={{ opacity: 0.35, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[72, 88, 72, 68].map((w, i) => (
          <div key={i} className="agent-skeleton" style={{ height: 34, width: w, borderRadius: 99 }} />
        ))}
      </div>
      <div className="agent-glass" style={{ padding: "16px 20px" }}>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="agent-skeleton" style={{ height: 9, width: 48, borderRadius: 3, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 24, width: 36, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[[85, 55, 35], [70, 45]].map((widths, ci) => (
          <div key={ci} className="agent-glass" style={{ padding: "16px 20px" }}>
            <div className="agent-skeleton" style={{ height: 9, width: 110, borderRadius: 3, marginBottom: 14 }} />
            {widths.map((w, j) => (
              <div key={j} className="agent-skeleton" style={{ height: 9, width: `${w}%`, borderRadius: 3, marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="agent-glass" style={{ padding: "16px 20px" }}>
        <div className="agent-skeleton" style={{ height: 9, width: 140, borderRadius: 3, marginBottom: 14 }} />
        <div className="agent-skeleton" style={{ height: 120, width: "100%", borderRadius: 4 }} />
      </div>
    </div>
  );
}
