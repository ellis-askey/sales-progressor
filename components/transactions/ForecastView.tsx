"use client";

// All Files → Forecast view. A real revenue/volume forecast that stays clean at
// any width and lets you hover for the story behind each month.
//
//  1. Confidence band — a shaded range between the CONFIDENT total (files far
//     enough along and healthy enough to trust the date) and the OPTIMISTIC
//     total (everything, including early/shaky files). The gap between the two
//     lines is the uncertainty, drawn as a band rather than pretended away.
//  2. Responsive — the chart is measured and drawn to its real pixel width
//     (ResizeObserver), so it never stretches or flattens on a wide screen.
//  3. Hover — mousing over the chart (or a month row) reveals that month's
//     files, likely vs at-risk split, and the realistic exchange window.
//  4. Fees / Files toggle — the book is fee-light (many self-progress files are
//     £0), so a pure fee curve can look empty. The Files basis forecasts how
//     many exchange each month instead, and never reads as nothing.
//
// Built from the rows themselves (fee basis matches the board / strip /
// Completions). Clicking a month drills in via ?exchanging=YYYY-MM.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { fileFeePence, type PipelineRow } from "./PipelineBoard";
import { riskLevelForRow } from "./TransactionRowView";
import { MonthlyTargetMenu } from "./MonthlyTargetMenu";
import { gbpCompact } from "./money";
import type { DisplayStageKey } from "@/lib/milestones/display-stages";

function exchangeDateOf(r: PipelineRow): Date | null {
  const raw = (r as { overridePredictedDate?: Date | string | null }).overridePredictedDate ?? r.expectedExchangeDate;
  return raw ? new Date(raw) : null;
}

// Confidence in a file actually exchanging on its predicted date: LIKELY (firm)
// when it's past the middle of the journey (enquiries onward) AND not high-risk;
// AT-RISK (shaky) when it's early-stage or flagged. Stage comes from the same
// engine the board uses (decorated onto the row as boardStage).
const ADVANCED = new Set<DisplayStageKey>(["enquiries", "exchange", "completion"]);
function isLikely(r: PipelineRow): boolean {
  const advanced = r.boardStage ? ADVANCED.has(r.boardStage) : false;
  return advanced && riskLevelForRow(r) !== "high";
}

// Phase 2 — how wide a file's realistic exchange window is, in days each side of
// its predicted date. Advanced + healthy files land close to the date; early or
// high-risk files can drift. This spread is what turns a single predicted date
// into an earliest–latest window; today it's a sensible fixed spread, and it's
// the seam we later calibrate from real completed-sale history (Phase 3).
function windowDaysOf(r: PipelineRow): number {
  const advanced = r.boardStage ? ADVANCED.has(r.boardStage) : false;
  const high = riskLevelForRow(r) === "high";
  if (advanced && !high) return 5;   // firm
  if (advanced) return 11;           // advanced but shaky
  return 20;                         // early-stage: wide
}
const DAY_MS = 86_400_000;
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Mode = "fees" | "files";

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
  const [mode, setMode] = useState<Mode>("fees");
  const [hoverI, setHoverI] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(680); // measured chart width in px

  // Measure the plot so the chart draws to real pixels and never stretches.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    if (el.clientWidth > 0) setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const buckets = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(cy, cm - 1 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const files = active.filter((r) => {
      const ex = exchangeDateOf(r);
      return ex != null && ex.getFullYear() === y && ex.getMonth() === m;
    });
    let likelyFees = 0, riskFees = 0, likelyCount = 0, riskCount = 0;
    let earliest: Date | null = null, latest: Date | null = null;
    for (const f of files) {
      const fee = fileFeePence(f);
      if (isLikely(f)) { likelyFees += fee; likelyCount++; } else { riskFees += fee; riskCount++; }
      const ex = exchangeDateOf(f);
      if (ex) {
        const wd = windowDaysOf(f);
        const e = new Date(ex.getTime() - wd * DAY_MS);
        const l = new Date(ex.getTime() + wd * DAY_MS);
        if (!earliest || e < earliest) earliest = e;
        if (!latest || l > latest) latest = l;
      }
    }
    return {
      key,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      files,
      count: files.length,
      fees: likelyFees + riskFees,
      likelyFees, riskFees, likelyCount, riskCount,
      earliest, latest,
      isCurrent: i === 0,
    };
  }), [active, cy, cm]);

  type Bucket = (typeof buckets)[number];
  const n = buckets.length;
  const undated = active.filter((r) => exchangeDateOf(r) == null).length;
  const totalFiles = buckets.reduce((s, b) => s + b.count, 0);

  const lowOf = (b: Bucket) => (mode === "fees" ? b.likelyFees : b.likelyCount);
  const highOf = (b: Bucket) => (mode === "fees" ? b.fees : b.count);
  const fmtVal = (v: number) => (mode === "fees" ? gbpCompact(v) : String(v));

  // ── Cumulative geometry (drawn in real pixels) ───────────────────────────────
  const cumLo: number[] = [];
  const cumHi: number[] = [];
  let rl = 0, rh = 0;
  for (const b of buckets) { rl += lowOf(b); cumLo.push(rl); rh += highOf(b); cumHi.push(rh); }
  const totalLo = cumLo[n - 1];
  const totalHi = cumHi[n - 1];
  const maxCum = Math.max(1, totalHi);

  const H = 168, padL = 8, padR = 8, padT = 18, padB = 22;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = H - padT - padB;
  const xAt = (i: number) => padL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (v: number) => padT + plotH - (v / maxCum) * plotH;
  const loPts = cumLo.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const hiPts = cumHi.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const loLine = "M" + loPts.join(" L");
  const hiLine = "M" + hiPts.join(" L");
  const band = "M" + hiPts.join(" L") + " L" + [...loPts].reverse().join(" L") + " Z";

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = plotRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = n > 1 ? plotW / (n - 1) : plotW;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - padL) / step)));
    setHoverI(i);
  };

  const hb = hoverI != null ? buckets[hoverI] : null;

  // ── Month-row bars ───────────────────────────────────────────────────────────
  const target = monthlyTargetPence;
  const maxBar = Math.max(1, mode === "fees" ? target ?? 0 : 0, ...buckets.map(highOf));
  const targetPct = mode === "fees" && target != null ? Math.min(100, (target / maxBar) * 100) : null;

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
          <span className="fc-range">
            <span className="fc-range-lo tabnum">{fmtVal(totalLo)}</span>
            <span className="fc-range-sep">–</span>
            <span className="fc-range-hi tabnum">{fmtVal(totalHi)}</span>
          </span>
          <span className="fc-total-l">{mode === "fees" ? "forecast fees range" : "files exchanging range"}</span>
          <div className="fc-toggle" role="group" aria-label="Forecast basis">
            <button type="button" className={mode === "fees" ? "on" : ""} aria-pressed={mode === "fees"} onClick={() => setMode("fees")}>Fees</button>
            <button type="button" className={mode === "files" ? "on" : ""} aria-pressed={mode === "files"} onClick={() => setMode("files")}>Files</button>
          </div>
          {canEditTarget ? (
            <MonthlyTargetMenu currentPence={target ?? null} />
          ) : target != null ? (
            <span className="fc-target-static">Target £{Math.round(target / 100).toLocaleString("en-GB")}/mo</span>
          ) : null}
        </div>
      </div>

      {/* Confidence band — confident vs optimistic cumulative, drawn to real width */}
      <div className="fc-curve">
        <div className="fc-plot" ref={plotRef} onMouseMove={onMove} onMouseLeave={() => setHoverI(null)}>
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="fc-curve-svg" role="img"
            aria-label={`Forecast ${fmtVal(totalLo)} to ${fmtVal(totalHi)} over 12 months`}>
            <defs>
              <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--agent-coral)" stopOpacity="0.18" />
                <stop offset="1" stopColor="var(--agent-coral)" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="var(--agent-border-subtle)" strokeWidth="1" />
            <path d={band} fill="url(#fc-band)" />
            <path d={hiLine} fill="none" stroke="var(--agent-coral-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={loLine} fill="none" stroke="var(--agent-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={xAt(n - 1)} cy={yAt(totalHi)} r="3.5" fill="var(--agent-coral-deep)" />
            <circle cx={xAt(n - 1)} cy={yAt(totalLo)} r="3.5" fill="var(--agent-success)" />
            {hoverI != null && (
              <>
                <line x1={xAt(hoverI)} y1={padT} x2={xAt(hoverI)} y2={padT + plotH} stroke="var(--agent-text-muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
                <circle cx={xAt(hoverI)} cy={yAt(cumHi[hoverI])} r="4" fill="var(--agent-coral-deep)" stroke="#fff" strokeWidth="1.5" />
                <circle cx={xAt(hoverI)} cy={yAt(cumLo[hoverI])} r="4" fill="var(--agent-success)" stroke="#fff" strokeWidth="1.5" />
              </>
            )}
          </svg>
          {hb && (
            <div className="fc-tip" style={{ left: Math.max(78, Math.min(w - 78, xAt(hoverI as number))) }}>
              <div className="fc-tip-h">{hb.label}<span>{hb.count} {hb.count === 1 ? "file" : "files"}</span></div>
              {mode === "fees" ? (
                <>
                  <div className="fc-tip-r"><i className="lk" />Likely<b className="tabnum">{gbpCompact(hb.likelyFees)}</b></div>
                  <div className="fc-tip-r"><i className="rk" />At risk<b className="tabnum">{gbpCompact(hb.riskFees)}</b></div>
                </>
              ) : (
                <>
                  <div className="fc-tip-r"><i className="lk" />Firm date<b className="tabnum">{hb.likelyCount}</b></div>
                  <div className="fc-tip-r"><i className="rk" />Shaky date<b className="tabnum">{hb.riskCount}</b></div>
                </>
              )}
              {hb.count > 0 && hb.earliest && hb.latest && (
                <div className="fc-tip-d">likely {shortDate(hb.earliest)} – {shortDate(hb.latest)}</div>
              )}
            </div>
          )}
        </div>
        <div className="fc-curve-cap">
          <span>
            <b className="tabnum fc-cap-lo">{fmtVal(totalLo)}</b> confident
            <span className="fc-cap-sep">·</span>
            <b className="tabnum fc-cap-hi">{fmtVal(totalHi)}</b> if it all lands
          </span>
          <span className="fc-curve-end">by {buckets[n - 1].label}</span>
        </div>
      </div>

      <div className="fc-rows">
        {buckets.map((b, i) => {
          const lo = lowOf(b), hi = highOf(b), risk = hi - lo;
          const delta = mode === "fees" && target != null ? b.fees - target : null;
          const showDelta = delta != null && (b.count > 0 || b.isCurrent);
          const valLabel = b.count > 0
            ? (mode === "fees" ? `${b.count} · ${gbpCompact(b.fees)}` : `${b.count} ${b.count === 1 ? "file" : "files"}`)
            : "";
          return (
            <div
              key={b.key}
              className={`fc-row${b.isCurrent ? " now" : ""}${hoverI === i ? " hot" : ""}`}
              onMouseEnter={() => setHoverI(i)}
              onMouseLeave={() => setHoverI(null)}
            >
              <span className="fc-month">
                {b.label}
                {b.isCurrent && <span className="fc-now-tag">This month</span>}
              </span>
              <div className="fc-bar-cell">
                <div className="fc-bar-wrap">
                  <span className="fc-bar-likely" style={{ width: `${(lo / maxBar) * 100}%` }} />
                  <span className="fc-bar-risk" style={{ width: `${(risk / maxBar) * 100}%` }} />
                </div>
                {targetPct != null && <span className="fc-target-line" style={{ left: `${targetPct}%` }} aria-hidden />}
              </div>
              <span className="fc-count">
                <span className="fc-count-v tabnum">{valLabel}</span>
                {showDelta && (
                  <span className={`fc-delta ${delta >= 0 ? "ahead" : "short"}`}>
                    {delta >= 0 ? `${gbpCompact(delta)} ahead` : `${gbpCompact(-delta)} short`}
                  </span>
                )}
              </span>
              {b.count > 0 ? (
                <Link href={`${basePath}?exchanging=${b.key}`} className="fc-open">View</Link>
              ) : (
                <span className="fc-open-none" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="fc-legend">
        <span><span className="fc-sw fc-sw-likely" />{mode === "fees" ? "Likely — advanced & healthy" : "Firm date — advanced & healthy"}</span>
        <span><span className="fc-sw fc-sw-risk" />{mode === "fees" ? "At risk — early or shaky" : "Shaky date — early or shaky"}</span>
        <span><span className="fc-sw fc-sw-band" />Confidence band</span>
      </div>
    </div>
  );
}
