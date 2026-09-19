"use client";

// All Files → Forecast view. A real revenue forecast, two layers stacked:
//
//  1. Cashflow curve — the cumulative fee line climbing across the next twelve
//     months. Not "£40k in November" but the running total banked by then.
//  2. Confidence bands — each month's bar split into LIKELY money (files far
//     enough along and healthy enough to trust the date) and AT-RISK money
//     (early-stage or high-risk files whose date is more hope than plan). A
//     flat forecast treats a day-one file like a ready-to-exchange one; this
//     doesn't.
//
// Built from the rows themselves (fee basis matches the board / strip /
// Completions). Clicking a month drills in via ?exchanging=YYYY-MM.

import Link from "next/link";
import { fileFeePence, type PipelineRow } from "./PipelineBoard";
import { riskLevelForRow } from "./TransactionRowView";
import { MonthlyTargetMenu } from "./MonthlyTargetMenu";
import { gbpCompact } from "./money";
import type { DisplayStageKey } from "@/lib/milestones/display-stages";

function exchangeDateOf(r: PipelineRow): Date | null {
  const raw = (r as { overridePredictedDate?: Date | string | null }).overridePredictedDate ?? r.expectedExchangeDate;
  return raw ? new Date(raw) : null;
}

// Confidence in a file actually exchanging on its predicted date: LIKELY when
// it's past the middle of the journey (enquiries onward) AND not high-risk;
// AT-RISK when it's early-stage or flagged. Stage comes from the same engine
// the board uses (decorated onto the row as boardStage).
const ADVANCED = new Set<DisplayStageKey>(["enquiries", "exchange", "completion"]);
function isLikely(r: PipelineRow): boolean {
  const advanced = r.boardStage ? ADVANCED.has(r.boardStage) : false;
  return advanced && riskLevelForRow(r) !== "high";
}

export function ForecastView({
  active,
  monthKey,
  basePath,
  monthlyTargetPence = null,
  canEditTarget = false,
}: {
  active: PipelineRow[];
  monthKey: string; // current calendar month, "YYYY-MM"
  basePath: string;
  // Agency monthly fees goal (pence) + whether this user (director) can edit it.
  monthlyTargetPence?: number | null;
  canEditTarget?: boolean;
}) {
  const [cy, cm] = monthKey.split("-").map(Number); // cm is 1-indexed

  const buckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(cy, cm - 1 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const files = active.filter((r) => {
      const ex = exchangeDateOf(r);
      return ex != null && ex.getFullYear() === y && ex.getMonth() === m;
    });
    let likelyFees = 0;
    let riskFees = 0;
    for (const f of files) {
      const fee = fileFeePence(f);
      if (isLikely(f)) likelyFees += fee; else riskFees += fee;
    }
    return {
      key,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      files,
      fees: likelyFees + riskFees,
      likelyFees,
      riskFees,
      isCurrent: i === 0,
    };
  });

  const undated = active.filter((r) => exchangeDateOf(r) == null).length;
  const totalFees = buckets.reduce((s, b) => s + b.fees, 0);
  const totalLikely = buckets.reduce((s, b) => s + b.likelyFees, 0);
  const totalFiles = buckets.reduce((s, b) => s + b.files.length, 0);
  // Bars (and the target line) scale to the biggest month OR the target,
  // whichever is larger, so the target line always sits on the bar.
  const scale = Math.max(1, monthlyTargetPence ?? 0, ...buckets.map((b) => b.fees));
  const target = monthlyTargetPence;
  const targetPct = target != null ? Math.min(100, (target / scale) * 100) : null;

  // ── Cashflow curve geometry ──────────────────────────────────────────────
  // Cumulative total fees across the twelve buckets → an area + line. A second
  // line tracks cumulative LIKELY fees, so the gap between them is the at-risk
  // upside. Non-scaling strokes keep the lines crisp at any width.
  const W = 720, H = 150, padL = 6, padR = 6, padT = 16, padB = 8;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = buckets.length;
  const cumTotal: number[] = [];
  const cumLikely: number[] = [];
  let rt = 0, rl = 0;
  for (const b of buckets) { rt += b.fees; cumTotal.push(rt); rl += b.likelyFees; cumLikely.push(rl); }
  const maxCum = Math.max(1, rt);
  const xAt = (i: number) => padL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (v: number) => padT + plotH - (v / maxCum) * plotH;
  const pts = (arr: number[]) => arr.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const totalLine = "M" + pts(cumTotal).join(" L");
  const likelyLine = "M" + pts(cumLikely).join(" L");
  const totalArea = `M${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} L` + pts(cumTotal).join(" L") + ` L${xAt(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  const endX = xAt(n - 1);
  const endY = yAt(cumTotal[n - 1]);

  return (
    <div className="fc">
      <div className="fc-head">
        <div style={{ minWidth: 0 }}>
          <p className="fc-title">Exchange forecast</p>
          <p className="fc-sub">
            {totalFiles} {totalFiles === 1 ? "file" : "files"} predicted to exchange over the next 12 months.
            {undated > 0 && ` ${undated} active ${undated === 1 ? "file has" : "files have"} no predicted date yet.`}
          </p>
        </div>
        <div className="fc-total">
          <span className="fc-total-v tabnum">{gbpCompact(totalFees)}</span>
          <span className="fc-total-l">forecast fees</span>
          {canEditTarget ? (
            <MonthlyTargetMenu currentPence={target ?? null} />
          ) : target != null ? (
            <span className="fc-target-static">Target £{Math.round(target / 100).toLocaleString("en-GB")}/mo</span>
          ) : null}
        </div>
      </div>

      {/* Cashflow curve — cumulative fees banked over the year */}
      <div className="fc-curve">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="fc-curve-svg" role="img" aria-label={`Cumulative forecast fees reaching ${gbpCompact(totalFees)} over 12 months`}>
          <defs>
            <linearGradient id="fc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--agent-coral)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--agent-coral)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--agent-border-subtle)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={totalArea} fill="url(#fc-area)" />
          <path d={likelyLine} fill="none" stroke="var(--agent-success)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.7" />
          <path d={totalLine} fill="none" stroke="var(--agent-coral-deep)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={endX} cy={endY} r="3.5" fill="var(--agent-coral-deep)" />
        </svg>
        <div className="fc-curve-cap">
          <span><b className="tabnum">{gbpCompact(totalFees)}</b> banked by {buckets[n - 1].label}</span>
          <span className="fc-curve-likely tabnum">{gbpCompact(totalLikely)} likely</span>
        </div>
      </div>

      <div className="fc-rows">
        {buckets.map((b) => {
          // Ahead / short vs the target — shown on months with activity and the
          // current month, so empty far-off months don't all read "short".
          const delta = target != null ? b.fees - target : null;
          const showDelta = delta != null && (b.files.length > 0 || b.isCurrent);
          return (
            <div key={b.key} className={`fc-row${b.isCurrent ? " now" : ""}`}>
              <span className="fc-month">
                {b.label}
                {b.isCurrent && <span className="fc-now-tag">This month</span>}
              </span>
              <div className="fc-bar-cell">
                <div className="fc-bar-wrap">
                  <span className="fc-bar-likely" style={{ width: `${(b.likelyFees / scale) * 100}%` }} />
                  <span className="fc-bar-risk" style={{ width: `${(b.riskFees / scale) * 100}%` }} />
                </div>
                {targetPct != null && <span className="fc-target-line" style={{ left: `${targetPct}%` }} aria-hidden />}
              </div>
              <span className="fc-count">
                <span className="fc-count-v tabnum">{b.files.length > 0 ? `${b.files.length} · ${gbpCompact(b.fees)}` : ""}</span>
                {showDelta && (
                  <span className={`fc-delta ${delta >= 0 ? "ahead" : "short"}`}>
                    {delta >= 0 ? `${gbpCompact(delta)} ahead` : `${gbpCompact(-delta)} short`}
                  </span>
                )}
              </span>
              {b.files.length > 0 ? (
                <Link href={`${basePath}?exchanging=${b.key}`} className="fc-open">View</Link>
              ) : (
                <span className="fc-open-none" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="fc-legend">
        <span><span className="fc-sw fc-sw-likely" />Likely — advanced &amp; healthy</span>
        <span><span className="fc-sw fc-sw-risk" />At risk — early or shaky</span>
        <span><span className="fc-sw fc-sw-line" />Likely cashflow</span>
      </div>
    </div>
  );
}
