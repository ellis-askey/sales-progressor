"use client";
import { useState, useEffect } from "react";
import type React from "react";
import Link from "next/link";
import { Plus, Clock, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { AlertCircle, ChevronRight } from "lucide-react";
import { ServiceSplitDonut, ExchangeForecastChart } from "@/components/hub/HubCharts";
import type { WeekBucket } from "@/lib/services/hub";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const CORAL  = "var(--agent-coral-deep)";
const TP     = "var(--agent-text-primary)";
const TS     = "var(--agent-text-secondary)";
const TM     = "var(--agent-text-muted)";

/* ─── Page-level CSS ─────────────────────────────────────────────────────── */
const CSS = `
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  .pp-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.45); margin: 52px 0 14px; padding: 9px 16px;
    background: rgba(30,45,74,.05); border-left: 3px solid rgba(30,45,74,.2);
    border-radius: 0 6px 6px 0; font-family: monospace;
  }
  .pp-sub { font-size: 11px; color: rgba(30,45,74,.4); font-family: monospace; margin: -10px 0 16px; }
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 20px; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }
  .stalled-row-link:hover { background: rgba(0,0,0,0.04); }
  .coming-up-link:hover { color: var(--agent-text-primary) !important; }
`;

/* ─── Mock data ──────────────────────────────────────────────────────────── */

const ATTENTION_ITEMS = [
  { id: "a1", urgency: "escalated" as const, reminderName: "Legal pack not received — 21 days overdue",          transaction: { id: "t1", propertyAddress: "14 Maple Drive, Bristol, BS1 4QR" } },
  { id: "a2", urgency: "overdue"   as const, reminderName: "Mortgage offer — confirm extension with buyer",       transaction: { id: "t2", propertyAddress: "7 Orchard Road, Bath, BA1 2NE" } },
  { id: "a3", urgency: "due_today" as const, reminderName: "Chase solicitor — enquiries outstanding",             transaction: { id: "t3", propertyAddress: "22 Clifton Park, Bristol, BS8 3HJ" } },
];

const URGENCY_STYLE = {
  escalated: { border: "var(--agent-danger)",   bg: "rgba(var(--agent-danger-rgb),0.05)",  color: "var(--agent-danger)",     label: "Escalated" },
  overdue:   { border: "var(--agent-warning)",  bg: "rgba(var(--agent-warning-rgb),0.05)", color: "var(--agent-warning)",    label: "Overdue"   },
  due_today: { border: "var(--agent-coral)",    bg: "var(--agent-coral-bg-tint)",          color: "var(--agent-coral-deep)", label: "Due today" },
} as const;

const DIARY_ITEMS = [
  { transactionId: "t4", address: "33 Park Street, Bristol, BS1 5NE", type: "exchange"   as const },
  { transactionId: "t5", address: "8 Victoria Road, Bath, BA2 3RP",   type: "completion" as const },
];

const FORECAST: WeekBucket[] = [
  { label: "This wk", count: 2, isCurrentWeek: true  },
  { label: "Wk 2",    count: 5, isCurrentWeek: false },
  { label: "Wk 3",    count: 3, isCurrentWeek: false },
  { label: "Wk 4",    count: 1, isCurrentWeek: false },
  { label: "+30",     count: 0, isCurrentWeek: false },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmtCurrency(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

function fmtCompact(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (p >= 1_000)     return `£${Math.round(p / 1_000)}k`;
  return `£${Math.round(p)}`;
}

/* ─── MomentumRing — A6 draw-on (C3 pattern, matches SidebarProgressRing) ─── */
/*
 * Production MomentumRing in HubCharts.tsx has no draw-on animation — it renders
 * at final offset immediately. Stage 4 adds this pattern to the production component.
 * Reference: app/agent/polish/transaction-detail/page.tsx → SidebarProgressRing
 */
function MomentumRingAnimated({ percent, rm }: { percent: number | null; rm: boolean }) {
  const r = 32; const cx = 40; const cy = 40;
  const circ = 2 * Math.PI * r;
  const progress = percent !== null ? Math.min(100, Math.max(0, percent)) / 100 : 0;
  const target   = circ * (1 - progress);
  const [offset, setOffset] = useState(rm ? target : circ);

  useEffect(() => {
    if (percent === null) return;
    if (rm) { setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (percent === null) {
    return (
      <div style={{ textAlign: "center", maxWidth: 160, padding: "4px 0" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TS, lineHeight: 1.5 }}>
          No comparison yet
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: TM, lineHeight: 1.5 }}>
          {/* OLD: "Month-on-month comparison appears after your first full month." — Rule 1: system narrates its own data gap; rewrite as instruction to user */}
          Check back after your first full month.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={80} height={80} viewBox="0 0 80 80" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(var(--agent-coral-base-rgb),0.18)" strokeWidth={7} />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--agent-coral)" strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: rm ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 15, fontWeight: 600, fill: TP, fontFamily: "inherit" }}>
          {percent}%
        </text>
      </svg>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function HubPolishPage() {
  const [rm,            setRm]            = useState(false);
  const [showEmpty,     setShowEmpty]     = useState(false);
  const [showDiary,     setShowDiary]     = useState(true);
  const [allClear,      setAllClear]      = useState(false);
  const [momentumNull,  setMomentumNull]  = useState(false);
  const [forecastEmpty, setForecastEmpty] = useState(false);
  const [stalledClean,  setStalledClean]  = useState(false);
  const [allSelfManaged, setAllSelfManaged] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRm(mq.matches);
    const handler = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Derived mock state */
  const attentionItems  = allClear ? [] : ATTENTION_ITEMS;
  const momentum        = momentumNull ? null : { percent: 73, thisMonth: 8, lastMonth: 11 };
  const stalledCount    = stalledClean ? 0 : 2;
  const selfManaged: number = allSelfManaged ? 24 : 18;
  const outsourced: number = allSelfManaged ? 0  : 6;
  const savedHours      = Math.round(outsourced * 2.5);
  const next7Days       = FORECAST[0].count;
  const next30Days      = FORECAST.reduce((s, w) => s + w.count, 0);
  const escalatedCount  = attentionItems.filter(i => i.urgency === "escalated").length;
  const attentionFileCt = new Set(attentionItems.map(i => i.transaction.id)).size;
  const attnColor       = escalatedCount > 0 ? "var(--agent-danger)" : attentionFileCt > 0 ? "var(--agent-warning)" : TP;

  return (
    <div data-rm={rm ? "1" : "0"} style={{ background: "var(--agent-bg-base)", minHeight: "100vh" }}>
      <style>{CSS}</style>

      {/* ── Polish controls ────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 32px", display: "flex", flexWrap: "wrap", gap: 16,
        alignItems: "center", background: "rgba(30,45,74,.03)",
        borderBottom: "1px solid rgba(30,45,74,.08)",
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "rgba(30,45,74,.5)", textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap" }}>
          Hub · Stage 2
        </span>
        <div className="pp-bar" style={{ margin: 0 }}>
          <span className="pp-bar-label">State:</span>
          <button className={`pp-pill${showEmpty     ? " on" : ""}`} onClick={() => setShowEmpty(v => !v)}>Empty</button>
          <button className={`pp-pill${showDiary     ? " on" : ""}`} onClick={() => setShowDiary(v => !v)}>Diary</button>
          <button className={`pp-pill${allClear      ? " on" : ""}`} onClick={() => setAllClear(v => !v)}>All-clear</button>
          <button className={`pp-pill${momentumNull  ? " on" : ""}`} onClick={() => setMomentumNull(v => !v)}>Momentum null</button>
          <button className={`pp-pill${forecastEmpty ? " on" : ""}`} onClick={() => setForecastEmpty(v => !v)}>Forecast empty</button>
          <button className={`pp-pill${stalledClean  ? " on" : ""}`} onClick={() => setStalledClean(v => !v)}>No stalled</button>
          <button className={`pp-pill${allSelfManaged ? " on" : ""}`} onClick={() => setAllSelfManaged(v => !v)}>All self-managed</button>
          <button className={`pp-pill${rm            ? " on" : ""}`} onClick={() => setRm(v => !v)}>Reduced motion</button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* EMPTY STATE                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {showEmpty ? (
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px 16px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--agent-text-h2)", fontWeight: 600, color: TP }}>
                Good morning, Sarah
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: TM }}>
                No active files yet.
              </p>
            </div>
            <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
              <Plus size={14} weight="bold" />
              New sale
            </Link>
          </div>

          {/* Welcome card */}
          <div style={{ padding: "0 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="agent-glass" style={{ padding: "28px 32px", borderRadius: "var(--agent-radius-xl)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "var(--agent-text-h3)", fontWeight: 600, color: TP, letterSpacing: "var(--agent-tracking-tight)" }}>
                  Your pipeline starts here.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: TS, lineHeight: 1.6 }}>
                  {/* OLD: "Add your first sale and we'll track it from offer to completion." — Rule 1: system-POV "we'll"; Rule 3: split into two active sentences */}
                  Add your first sale. Track each one from offer through to completion.
                </p>
              </div>
              <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-md" style={{ textDecoration: "none", flexShrink: 0 }}>
                <Plus size={16} weight="bold" />
                Add a sale
              </Link>
            </div>

            {/* Ghost cards */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, opacity: 0.3, pointerEvents: "none" }}>
              <div className="agent-glass" style={{ padding: "20px 24px" }}>
                <p className="agent-eyebrow" style={{ marginBottom: 20 }}>Pipeline health</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
                  {["Active files", "Exchanging soon", "Need attention", "Pipeline value"].map((l, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 12px", gap: 6, borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined }}>
                      <div className="agent-skeleton" style={{ width: 36, height: 22, borderRadius: 4 }} />
                      <span style={{ fontSize: 11, color: TM, textAlign: "center" }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="agent-glass" style={{ padding: "20px 24px" }}>
                {/* OLD: "Service split" eyebrow — Rule 2: internal system noun; rewrite as user intent */}
                <p className="agent-eyebrow" style={{ marginBottom: 16 }}>Who&apos;s managing</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 8, paddingBottom: 8 }}>
                  <div className="agent-skeleton" style={{ width: 80, height: 80, borderRadius: "50%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

      ) : (

      /* ═══════════════════════════════════════════════════════════════════ */
      /* POPULATED HUB                                                      */
      /* ═══════════════════════════════════════════════════════════════════ */

      <div style={{ display: "flex", flexDirection: "column" }}>

        {/* PageHeader (mocked inline — same structure as production) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px 16px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "var(--agent-text-h2)", fontWeight: 600, color: TP }}>
              Good morning, Sarah
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: TM }}>
              {/* OLD: "Here's what matters today." — Rule 1: system deciding what "matters"; rewrite as factual description */}
              Your pipeline at a glance.
            </p>
          </div>
          <Link href="/agent/transactions/new" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
            <Plus size={14} weight="bold" />
            New sale
          </Link>
        </div>

        {/* Content */}
        <div className="hub-content-pad" style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Diary ──────────────────────────────────────────────────────── */}
          {showDiary && (
            <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
              {/*
               * agent-card-hdr: padding overridden to 14px 20px (hub uses wider header padding).
               * Stage 4: update production to use agent-card-hdr + override padding, replace inline div.
               */}
              <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p className="agent-card-title-emphasis">Today&apos;s diary</p>
                  <p style={{ margin: 0, fontSize: 11, color: TM }}>
                    {/* OLD: "Exchanges and completions scheduled for today" — fine, factual */}
                    Exchanges and completions scheduled for today
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--agent-success)", background: "var(--agent-success-bg)", border: "1px solid var(--agent-success-border)", padding: "3px 10px", borderRadius: 99, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {DIARY_ITEMS.length} events today
                </span>
              </div>
              {DIARY_ITEMS.map((item, i) => (
                /* OLD: hover:brightness-[0.97] (Tailwind) → agent-hover-row */
                <Link key={item.transactionId} href={`/agent/transactions/${item.transactionId}`}
                  className="agent-hover-row"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "13px 20px 13px 17px",
                    borderLeft: `3px solid ${item.type === "completion" ? "var(--agent-success)" : "var(--agent-coral)"}`,
                    background: item.type === "completion" ? "var(--agent-success-bg)" : "var(--agent-coral-bg-tint)",
                    borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                    textDecoration: "none", gap: 12,
                  }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.address}
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: item.type === "completion" ? "var(--agent-success)" : CORAL }}>
                    {item.type === "completion" ? "Completion" : "Exchange"}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* ── Attention ──────────────────────────────────────────────────── */}
          <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            {/*
             * agent-card-hdr: padding overridden to 14px 20px for hub header spacing.
             * agent-card-title-emphasis: 13px/500/primary (matches production "Needs your attention").
             * Stage 4: update AttentionListView.tsx header div → agent-card-hdr + agent-card-title-emphasis.
             */}
            <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Clock size={15} color={TM} />
                <div>
                  <p className="agent-card-title-emphasis">
                    Needs your attention
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: TM }}>
                    {/* OLD: "Files where something's stuck or due" — Rule 2: vague "stuck or due"; rewrite as specific, present */}
                    Reminders due today or overdue.
                  </p>
                </div>
              </div>
              {attentionItems.length > 0 && (
                /* OLD: inline-styled anchor → agent-link */
                <Link href="/agent/work-queue" className="agent-link" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  {/* OLD: "Reminders" — Rule 3: bare noun; add "All" for clearer action */}
                  All reminders
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-success)", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, color: TS }}>
                  {/* OLD: "No reminders due right now. All clear." — Rule 3: "right now" is filler; trimmer is equally clear */}
                  No reminders due. All clear.
                </p>
              </div>
            ) : (
              attentionItems.slice(0, 3).map((item, i) => {
                const s = URGENCY_STYLE[item.urgency];
                return (
                  /* OLD: hover:brightness-[0.97] (Tailwind) → agent-hover-row */
                  <Link key={item.id} href={`/agent/transactions/${item.transaction.id}?tab=reminders`}
                    className="agent-hover-row"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 20px 13px 17px",
                      borderLeft: `3px solid ${s.border}`,
                      background: s.bg,
                      borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                      textDecoration: "none", gap: 12,
                    }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.transaction.propertyAddress}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: TS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.reminderName}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, flexShrink: 0 }}>
                      {s.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {/* ── Pipeline health + Momentum ─────────────────────────────────── */}
          <div className="hub-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>

            {/* Pipeline health */}
            <div className="agent-glass" style={{ padding: "20px 24px" }}>
              {/*
               * agent-card-hdr-internal: NEW PATTERN — eyebrow + subtitle, no border-bottom.
               * Stage 4: replace inline flex div with agent-card-hdr-internal in hub/page.tsx.
               */}
              <div className="agent-card-hdr-internal" style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Pipeline health</p>
                  <p className="agent-card-subtitle">
                    {/* OLD: "Where your business sits right now" — Rule 3: "sits" is slack; "stands today" is more direct */}
                    Where your business stands today.
                  </p>
                </div>
              </div>

              <div className="hub-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
                {([
                  { value: "24",                           label: "Active files",     color: "var(--agent-coral)",  href: "/agent/dashboard",                                          delta: "+4 this month" },
                  { value: "3",                            label: "Exchanging soon",  color: "var(--agent-success)", href: "/agent/transactions?filter=exchanging-next-30-days",        delta: null },
                  { value: attentionFileCt.toString(),     label: "Need attention",   color: attnColor,              href: attentionFileCt > 0 ? "/agent/work-queue" : null,            delta: null },
                  { value: fmtCurrency(537500000),         label: "Pipeline value",   color: TP,                     href: null,                                                        delta: null },
                ] as { value: string; label: string; color: string; href: string | null; delta: string | null }[]).map(({ value, label, color, href, delta }, i) => {
                  const inner = (
                    <>
                      <span style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
                      <span style={{ fontSize: 11, color: TM, textAlign: "center", lineHeight: 1.3 }}>{label}</span>
                      {delta && <span style={{ fontSize: 10, color: "var(--agent-success)", fontWeight: 500, textAlign: "center" }}>{delta}</span>}
                    </>
                  );
                  const cellStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 12px", gap: 4, borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined, borderRadius: 8, transition: "background 120ms" };
                  return href ? (
                    <Link key={i} href={href} style={{ ...cellStyle, textDecoration: "none" }} className="hover:bg-black/[0.04]">{inner}</Link>
                  ) : (
                    <div key={i} style={cellStyle}>{inner}</div>
                  );
                })}
              </div>

              {/* Coming up strip */}
              <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginTop: 14, paddingTop: 10, paddingBottom: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: TS, whiteSpace: "nowrap" }}>Coming up:</span>
                <Link href="/agent/transactions?filter=exchanging-this-week" className="coming-up-link" style={{ fontSize: 13, color: TS, textDecoration: "none", whiteSpace: "nowrap" }}>2 exchanging this week</Link>
                <span style={{ color: "var(--agent-border-subtle)", fontSize: 13, userSelect: "none" }}>·</span>
                <Link href="/agent/transactions?filter=completing-this-week" className="coming-up-link" style={{ fontSize: 13, color: TS, textDecoration: "none", whiteSpace: "nowrap" }}>1 completing this week</Link>
                <span style={{ color: "var(--agent-border-subtle)", fontSize: 13, userSelect: "none" }}>·</span>
                <Link href="/agent/transactions?filter=closing-this-month" className="coming-up-link" style={{ fontSize: 13, color: TS, textDecoration: "none", whiteSpace: "nowrap" }}>{fmtCompact(89750000)} closing this month</Link>
              </div>

              {/* Stalled files */}
              <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginTop: 10 }}>
                {stalledCount === 0 ? (
                  <div style={{ paddingTop: 10, paddingBottom: 2, fontSize: 13, color: TM }}>
                    All files have recent activity
                  </div>
                ) : (
                  <Link href="/agent/work-queue" className="stalled-row-link" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, paddingBottom: 2, textDecoration: "none", borderRadius: 6, gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={14} color="var(--agent-warning)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: TP }}>
                        {/* OLD: "N files stalled — no activity in 14+ days" — Rule 2: "stalled" is system-jargon; Rule 3: "no activity" → "nothing logged" is more concrete */}
                        <strong>{stalledCount} files need chasing</strong>
                        {" — "}
                        <span style={{ color: TS }}>nothing logged in 14+ days</span>
                      </span>
                    </div>
                    <ChevronRight size={14} color={TM} style={{ flexShrink: 0 }} />
                  </Link>
                )}
              </div>
            </div>

            {/* Momentum card */}
            <div className="agent-glass" style={{ padding: "20px 24px", display: "flex", flexDirection: "column" }}>
              <div className="agent-card-hdr-internal">
                <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Momentum</p>
                <p className="agent-card-subtitle">Exchanges this month vs last</p>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 8 }}>
                {/* A6 draw-on: stage 4 adds this pattern to production MomentumRing in HubCharts.tsx */}
                <MomentumRingAnimated percent={momentum?.percent ?? null} rm={rm} />
              </div>
              {momentum && (
                <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 5 }}>
                  {[{ label: "This month", count: momentum.thisMonth }, { label: "Last month", count: momentum.lastMonth }].map(({ label, count }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 11, color: TM }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TP }}>{count} {count === 1 ? "exchange" : "exchanges"}</span>
                    </div>
                  ))}
                  <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, textAlign: "right", color: momentum.percent >= 100 ? "var(--agent-success)" : "var(--agent-warning)" }}>
                    {momentum.percent >= 100 ? "Ahead of last month" : "Below last month"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Exchange forecast + Service split ──────────────────────────── */}
          <div className="hub-grid-half" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Exchange forecast */}
            <div className="agent-glass" style={{ padding: "20px 24px" }}>
              <div className="agent-card-hdr-internal">
                <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Exchange forecast</p>
                <p className="agent-card-subtitle">
                  {/* OLD: "When your sales expect to exchange" — Rule 2: "your sales" is ambiguous (files/sellers); rewrite with "files" */}
                  When your files are due to exchange.
                </p>
              </div>

              {forecastEmpty ? (
                <p style={{ fontSize: 13, color: TM, margin: "0 0 16px", lineHeight: 1.6 }}>
                  {/* OLD: "No exchange dates set in the next 30 days. Add expected exchange dates to active files to build your forecast." — Rule 2: "build your forecast" is system-process jargon; rewrite as outcome-first instruction */}
                  No exchange dates in the next 30 days. Add expected exchange dates to your files to see them here.
                </p>
              ) : (
                <>
                  {/* Production uses recharts ExchangeForecastChart — imported from HubCharts */}
                  <ExchangeForecastChart data={FORECAST} />
                  <div style={{ display: "flex", justifyContent: "space-around", marginTop: 6, marginBottom: 4 }}>
                    {FORECAST.map((w, i) => (
                      <span key={i} style={{ fontSize: 10, color: w.isCurrentWeek ? CORAL : TM, fontWeight: w.isCurrentWeek ? 600 : 400, textAlign: "center", flex: 1 }}>
                        {w.label}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12, marginTop: forecastEmpty ? 4 : 8 }}>
                {[{ label: "This week", count: next7Days }, { label: "Next 30 days", count: next30Days }].map(({ label, count }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: TS }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: label === "This week" && count > 0 ? CORAL : TP }}>
                      {count} {count === 1 ? "exchange" : "exchanges"}
                    </p>
                  </div>
                ))}
                {next7Days > 0 && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: CORAL, fontWeight: 500 }}>
                    {/* OLD: "1 exchange due this week — files should be ready." / "N exchanges due this week — make sure files are ready." — Rule 3: "due this week" is redundant after the chart; rewrite as prompt to verify */}
                  {next7Days === 1 ? "1 exchange this week — check files are ready." : `${next7Days} exchanges this week — check all files are ready.`}
                  </p>
                )}
              </div>
            </div>

            {/* Service split */}
            <div className="agent-glass" style={{ padding: "20px 24px" }}>
              <div className="agent-card-hdr-internal">
                {/* OLD: "Service split" eyebrow — Rule 2: internal system noun; rewrite as user intent */}
                <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Who&apos;s managing</p>
                <p className="agent-card-subtitle">
                  {/* OLD: "How each active file is being handled" — Rule 2: passive voice; rewrite as agent-POV description */}
                  Files you manage and files our team handles.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 4 }}>
                {/* Production uses recharts ServiceSplitDonut — imported from HubCharts */}
                <ServiceSplitDonut selfManaged={selfManaged} outsourced={outsourced} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {(() => {
                    const total = selfManaged + outsourced;
                    return [
                      // OLD: "Self-managed" → "Managed by you" (Rule 2: passive label → active agent-POV)
                      { label: "Managed by you", count: selfManaged, color: "var(--agent-coral)"   },
                      // OLD: "With progressor" → "Our team" (Rule 2: "progressor" is system-brand jargon; agent-facing label)
                      { label: "Our team",        count: outsourced,  color: "var(--agent-warning)" },
                    ].map(({ label, count, color }) => {
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <p style={{ margin: 0, fontSize: 12, color: TS, flex: 1 }}>{label}</p>
                          <span style={{ fontSize: 13, fontWeight: 600, color: TP }}>{count}</span>
                          <span style={{ fontSize: 11, color: TM, minWidth: 30, textAlign: "right" }}>{pct}%</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12, marginTop: 12 }}>
                {outsourced > 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: TS, lineHeight: 1.6 }}>
                    {/* OLD: "{N} files our team is handling — saving you approximately {N} agent hours this week" — Rule 1: passive construction; Rule 3: "approximately" → "around", "agent hours" → "hours" */}
                    Our team is handling{" "}
                    <strong style={{ color: TP }}>{outsourced} {outsourced === 1 ? "file" : "files"}</strong>
                    {savedHours > 0 && (
                      <> — saving you around{" "}
                        <strong style={{ color: CORAL }}>{savedHours} hours</strong>{" "}
                        this week
                      </>
                    )}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: TM, lineHeight: 1.6 }}>
                    {/* OLD: "All files are self-managed. Move files to Sales Progressor to free up your time." — Rule 1: system self-reference ("Sales Progressor"); trim to fact only */}
                    All files are self-managed.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Activity ribbon ────────────────────────────────────────────── */}
          {/*
           * agent-glass-light: NEW CLASS — replaces inline rgba(255,255,255,0.42) glass.
           * Stage 4: replace inline style block in hub/page.tsx with className="agent-glass-light".
           * OLD (inline):
           *   background: "rgba(255,255,255,0.42)"
           *   backdropFilter: "blur(16px)"
           *   WebkitBackdropFilter: "blur(16px)"
           *   border: "0.5px solid var(--agent-glass-border)"
           *   borderRadius: "var(--agent-radius-lg)"
           */}
          <div className="agent-glass-light" style={{ padding: "12px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "var(--agent-coral)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={12} weight="bold" color="var(--agent-text-on-coral)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Last activity: Chase sent — mortgage offer status
                </p>
                <p style={{ margin: 0, fontSize: 11, color: TM }}>
                  14 mins ago · 14 Maple Drive, Bristol
                </p>
              </div>
            </div>
            {/* OLD: inline-styled anchor → agent-link */}
            <Link href="/agent/transactions/t1" className="agent-link" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              View file
              <ArrowRight size={12} />
            </Link>
          </div>

        </div>
      </div>
      )}
    </div>
  );
}
