"use client";
/*
 * Polish reference for /agent/completions — Stage 2.
 * Visual target for Stage 4 production swap.
 *
 * Urgency groups: agent-glass > agent-acc-hdr + agent-acc > agent-acc-in > agent-acc-body.
 * State: openGroups (truthy = open). All groups start closed per Section 4.
 * Urgency colour (dot + label + card border) is preserved inside agent-acc-hdr —
 * these are child elements and not overridden by the canonical class's hover/focus.
 * agent-acc-title is NOT used for urgency labels: agent-acc-title forces
 * color:var(--agent-text-primary) which would suppress urgency text colours.
 *
 * Sub-decisions (recorded for inventory §14):
 *   Accordion:    agent-acc system — canonical per ANIMATION_STANDARDS.md §1
 *   Ghost:        abstract agent-skeleton bars, neutral (no urgency colour, no fake copy)
 *   Loading:      agent-glass + agent-acc-hdr + agent-skeleton bars — mirrors real structure
 *   File hover:   hover:shadow-md transition-shadow (Tailwind) — kept as-is; no new canonical
 *   daysColor:    CSS variable tokens: var(--agent-danger) / var(--agent-warning) / var(--agent-text-muted)
 *   SET_DATE:     var(--agent-text-muted) + var(--agent-border-subtle) — tokenised from production's raw rgba
 *   Fee text:     var(--agent-text-primary) — replaces production's rgba(15,23,42,0.7)
 *   "No sols":    var(--agent-warning) — replaces production's hardcoded #b45309
 */

import { useState, useEffect } from "react";
import { CaretDown, ClockCountdown } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";
import { toUKDateStr } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type UrgencyKey = "overdue" | "this_week" | "next_week" | "later" | "no_date";

type MockFile = {
  id: string;
  propertyAddress: string;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  purchasers: string[];
  assignedUserName: string | null;
  exchangedAtIso: string | null;
  completionDateIso: string | null;
  vendorSolicitorName: string | null;
  purchaserSolicitorName: string | null;
};

type MockGroup = {
  key: UrgencyKey;
  label: string;
  files: MockFile[];
  groupValue: number;
  groupFeeTotal: number;
  missingFeeCount: number;
};

type ThemeName = "sunset" | "coastal" | "heritage" | "slate" | "emerald" | "claret";
type ViewState = "populated" | "empty" | "loading";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(pence: number) {
  return "£" + (pence / 100).toLocaleString("en-GB");
}

function fmtCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000)
    return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  return "£" + pounds.toLocaleString("en-GB");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "No date set";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

function timeSinceExchange(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "Exchanged today";
  if (days === 1) return "Exchanged yesterday";
  return `Exchanged ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${days} days ago`;
}

function computeDays(iso: string | null): { rel: number | null; label: string; color: string } {
  if (!iso) return { rel: null, label: "", color: "var(--agent-text-muted)" };
  const todayStr = toUKDateStr(new Date());
  const dStr = toUKDateStr(new Date(iso));
  const rel = Math.round((new Date(dStr).getTime() - new Date(todayStr).getTime()) / 86_400_000);
  let label = "";
  let color = "var(--agent-text-muted)";
  if (rel < 0)       { label = `${Math.abs(rel)} days overdue`; color = "var(--agent-danger)"; }
  else if (rel === 0) { label = "today";    color = "var(--agent-warning)"; }
  else if (rel === 1) { label = "tomorrow"; }
  else               { label = `in ${rel} days`; }
  return { rel, label, color };
}

/* ─── Design tokens ──────────────────────────────────────────────────────── */

const GROUP_STYLES = {
  overdue:   { dot: "bg-red-500",   label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dot: "bg-amber-500", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dot: "bg-blue-500",  label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dot: "bg-slate-400", label: "text-slate-900/60", border: "border-white/20"      },
  no_date:   { dot: "bg-slate-300", label: "text-slate-900/40", border: "border-white/15"      },
} as const;

const GROUP_STYLES_STAT: Record<UrgencyKey, { pillColor: PillColor }> = {
  overdue:   { pillColor: "danger"  },
  this_week: { pillColor: "warning" },
  next_week: { pillColor: "muted"   },
  later:     { pillColor: "muted"   },
  no_date:   { pillColor: "muted"   },
};

const STAT_LABELS: Record<UrgencyKey, string> = {
  overdue:   "overdue",
  this_week: "this week",
  next_week: "next week",
  later:     "later",
  no_date:   "no date",
};

const THEME_NAMES: ThemeName[] = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"];

/* ─── CSS (pp-controls chrome + reduced-motion) ──────────────────────────── */

const CSS = `
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }

  /* Reduced-motion override */
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  /* agent-acc has a multi-value transition shorthand that needs an explicit named override */
  [data-rm="1"] .agent-acc,
  [data-rm="1"] .agent-acc.open { transition: none !important; }
`;

/* ─── Mock data ──────────────────────────────────────────────────────────── */

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const MOCK_GROUPS: MockGroup[] = [
  {
    key: "overdue",
    label: "Overdue",
    groupFeeTotal: 405000,
    groupValue: 27000000,
    missingFeeCount: 0,
    files: [
      {
        id: "f1",
        propertyAddress: "14 High Street, Maidstone, ME15 9PQ",
        purchasePrice: 27000000,
        agentFeeAmount: 405000,
        purchasers: ["John & Emma Walker"],
        assignedUserName: null,
        exchangedAtIso: daysFromNow(-21),
        completionDateIso: daysFromNow(-5),
        vendorSolicitorName: "Smith & Co Solicitors",
        purchaserSolicitorName: "Jones & Partners LLP",
      },
    ],
  },
  {
    key: "this_week",
    label: "Completing this week",
    groupFeeTotal: 525000,
    groupValue: 77000000,
    missingFeeCount: 1,
    files: [
      {
        id: "f2",
        propertyAddress: "7 Orchard Road, Bath, BA1 2NE",
        purchasePrice: 35000000,
        agentFeeAmount: 525000,
        purchasers: ["Michael Brown"],
        assignedUserName: null,
        exchangedAtIso: daysFromNow(-14),
        completionDateIso: daysFromNow(3),
        vendorSolicitorName: "Harrison Solicitors",
        purchaserSolicitorName: "Clifton Law",
      },
      {
        id: "f3",
        propertyAddress: "22 Clifton Park, Bristol, BS8 3HJ",
        purchasePrice: 42000000,
        agentFeeAmount: null,
        purchasers: [],
        assignedUserName: null,
        exchangedAtIso: daysFromNow(-7),
        completionDateIso: daysFromNow(6),
        vendorSolicitorName: null,
        purchaserSolicitorName: null,
      },
    ],
  },
  {
    key: "no_date",
    label: "No completion date set",
    groupFeeTotal: 300000,
    groupValue: 20000000,
    missingFeeCount: 0,
    files: [
      {
        id: "f4",
        propertyAddress: "33 Park Street, Bristol, BS1 5NE",
        purchasePrice: 20000000,
        agentFeeAmount: 300000,
        purchasers: ["Sarah Chen"],
        assignedUserName: null,
        exchangedAtIso: daysFromNow(-5),
        completionDateIso: null,
        vendorSolicitorName: "Wilson & Associates",
        purchaserSolicitorName: "Park Road Legal",
      },
    ],
  },
];

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function CompletionsPolishPage() {
  const [viewState, setViewState] = useState<ViewState>("populated");
  const [theme, setTheme] = useState<ThemeName>("sunset");
  const [night, setNight] = useState(false);
  const [rm, setRm] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!shell) return;
    if (night) shell.setAttribute("data-night", "");
    else shell.removeAttribute("data-night");
    return () => { shell.removeAttribute("data-night"); };
  }, [night]);

  function toggle(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const totalFees   = MOCK_GROUPS.reduce((s, g) => s + g.groupFeeTotal, 0);
  const totalValue  = MOCK_GROUPS.reduce((s, g) => s + g.groupValue, 0);
  const filesWithFee   = MOCK_GROUPS.reduce((s, g) => s + g.files.filter((f) => f.agentFeeAmount).length, 0);
  const filesWithPrice = MOCK_GROUPS.reduce((s, g) => s + g.files.filter((f) => f.purchasePrice).length, 0);
  const totalFiles  = MOCK_GROUPS.reduce((s, g) => s + g.files.length, 0);

  const statSegments = MOCK_GROUPS.map((g) => ({
    key: g.key,
    label: `${g.files.length} ${STAT_LABELS[g.key]}`,
    pillColor: GROUP_STYLES_STAT[g.key].pillColor,
    anchor: `#section-${g.key}`,
  }));

  return (
    <>
      <style>{CSS}</style>

      {/* ── pp-controls ────────────────────────────────────────────────────── */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(30,45,74,0.08)",
        background: "rgba(30,45,74,0.03)",
        display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
      }}>
        <span className="pp-bar-label" style={{ fontWeight: 600 }}>completions — Stage 2</span>
        <div className="pp-bar">
          <span className="pp-bar-label">state</span>
          {(["populated", "empty", "loading"] as ViewState[]).map((s) => (
            <button key={s} type="button" className={`pp-pill${viewState === s ? " on" : ""}`}
              onClick={() => setViewState(s)}>{s}</button>
          ))}
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

      {/* ── Production content ──────────────────────────────────────────────── */}
      <div className="agent-bg" data-theme={theme} data-rm={rm ? "1" : "0"}>

        {/* PageHeader — varies by state */}
        {viewState === "loading" ? (
          <PageHeader title="Completions" subtitle="Exchanged files, tracking to completion.">
            <div className="agent-skeleton" style={{ height: 22, width: 68, borderRadius: 99 }} />
            <div className="agent-skeleton" style={{ height: 22, width: 82, borderRadius: 99 }} />
            <div className="agent-skeleton" style={{ height: 22, width: 74, borderRadius: 99 }} />
          </PageHeader>
        ) : viewState === "populated" ? (
          <PageHeader title="Completions" subtitle="Exchanged files, tracking to completion.">
            {statSegments.map((s) => (
              <StatPill key={s.key} href={s.anchor} label={s.label} color={s.pillColor} />
            ))}
          </PageHeader>
        ) : (
          <PageHeader title="Completions" subtitle="Exchanged files, tracking to completion." />
        )}

        {/*
          MOCKED: CompletionsGroupList — production import at components/completions/CompletionsGroupList.tsx.
          This inline implementation is the Stage 4 structural contract.
          Stage 4 must update production CompletionsGroupList and CompletionFileRowView to match this structure.
          Urgency group = agent-glass > agent-acc-hdr + agent-acc > agent-acc-in > agent-acc-body.
          FileCard interior tokenised: daysColor uses CSS var tokens, not hex strings.
        */}
        <div className="px-4 md:px-8 py-2 md:py-4 space-y-7">

          {viewState === "loading" && <LoadingSkeleton />}

          {viewState === "empty" && (
            <>
              {/* Empty state card */}
              <div className="glass-card px-6 py-12" style={{ textAlign: "center" }}>
                <ClockCountdown
                  size={32}
                  weight="regular"
                  style={{ color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }}
                />
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                  No completions
                </p>
                <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                  Once a file exchanges, it&apos;ll appear here as it heads toward completion.
                </p>
              </div>

              {/* Ghost — abstract skeleton shapes, filter-neutral */}
              <CompletionsGhost />
            </>
          )}

          {viewState === "populated" && (
            <>
              {/* Pipeline summary */}
              <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: 0 }}>
                <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{totalFiles}</span>
                {" "}{totalFiles !== 1 ? "files" : "file"}
                {filesWithFee > 0 && (
                  <>{" · "}<span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{fmtCompact(totalFees)}</span>{" total fees"}</>
                )}
                {filesWithPrice > 0 && (
                  <>{" · "}<span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{fmtCompact(totalValue)}</span>{" in sales"}</>
                )}
              </p>

              {/* Urgency groups */}
              <div className="space-y-4">
                {MOCK_GROUPS.map((g) => (
                  <UrgencyGroup
                    key={g.key}
                    g={g}
                    open={openGroups[g.key] ?? false}
                    onToggle={() => toggle(g.key)}
                    rm={rm}
                  />
                ))}
              </div>
            </>
          )}

        </div>

        {/* ── Mobile 375px frame ─────────────────────────────────────────── */}
        <div style={{
          borderTop: "1px solid rgba(30,45,74,0.08)",
          marginTop: 8,
          padding: "20px 16px 32px",
        }}>
          <p className="pp-bar-label" style={{ fontWeight: 600, marginBottom: 12 }}>Mobile — 375px</p>
          <div
            className="m-frame"
            style={{
              width: 375,
              maxWidth: "100%",
              border: "1px solid rgba(30,45,74,0.12)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* StatPills row for mobile header */}
            {viewState === "populated" && (
              <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(30,45,74,0.08)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {statSegments.map((s) => (
                  <StatPill key={s.key} href={`#m-section-${s.key}`} label={s.label} color={s.pillColor} />
                ))}
              </div>
            )}

            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {viewState === "loading" && <LoadingSkeleton compact />}
              {viewState === "empty" && <CompletionsGhost />}
              {viewState === "populated" && (
                <>
                  {/* Pipeline summary */}
                  <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: 0 }}>
                    <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{totalFiles}</span>
                    {" files · "}
                    <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{fmtCompact(totalFees)}</span>
                    {" total fees"}
                  </p>
                  {/* First two groups */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {MOCK_GROUPS.slice(0, 2).map((g) => (
                      <UrgencyGroup
                        key={`m-${g.key}`}
                        g={g}
                        open={openGroups[g.key] ?? false}
                        onToggle={() => toggle(g.key)}
                        rm={rm}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>{/* ── /agent-bg ─────────────────────────────────────────────── */}
    </>
  );
}

/* ─── Urgency group card (agent-glass + agent-acc-hdr + agent-acc) ─────────── */
/*
 * Urgency colour is applied to child elements within agent-acc-hdr, not to
 * agent-acc-hdr itself. The dot (bg-red-500 etc.) and label text (text-red-600
 * etc.) are child <div> and <span> elements — agent-acc-hdr's hover/focus
 * background change applies to the entire row but does not suppress child colours.
 * agent-acc-title is intentionally NOT used for urgency labels because it forces
 * color:var(--agent-text-primary) via CSS class, which would win over Tailwind
 * colour utilities at the same specificity level.
 */
function UrgencyGroup({ g, open, onToggle, rm }: {
  g: MockGroup;
  open: boolean;
  onToggle: () => void;
  rm: boolean;
}) {
  const s = GROUP_STYLES[g.key];

  return (
    <div id={`section-${g.key}`} className="agent-glass" style={{ overflow: "hidden" }}>
      <div
        className="agent-acc-hdr"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      >
        {/* Left: urgency dot + label — child elements, not overridden by agent-acc-hdr colour rule */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-[0.07em] truncate ${s.label}`}>
            {g.label} ({g.files.length})
          </span>
        </div>

        {/* Right: fee/value summary + caret */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {g.groupFeeTotal > 0 ? (
            <span className="agent-acc-summary">{fmt(g.groupFeeTotal)} fees</span>
          ) : g.groupValue > 0 ? (
            <span className="agent-acc-summary">{fmt(g.groupValue)}</span>
          ) : null}
          <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>
      </div>

      <div className={`agent-acc${open ? " open" : ""}`} style={rm ? { transition: "none" } : undefined}>
        <div className="agent-acc-in">
          <div className="agent-acc-body">
            {/* Missing fee note — rendered inside acc-body (Stage 4 contract: moves from outside to inside accordion) */}
            {g.groupFeeTotal > 0 && g.missingFeeCount > 0 && (
              <p className="text-xs text-slate-900/30 ml-[22px] -mt-2 mb-0">
                ({g.missingFeeCount} file{g.missingFeeCount !== 1 ? "s" : ""} with no fee set)
              </p>
            )}
            <div className="space-y-2">
              {g.files.map((f) => (
                <FileCard key={f.id} file={f} groupKey={g.key} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── File card ──────────────────────────────────────────────────────────── */
/*
 * Production: <Link className="glass-card block px-5 py-4 border {s.border} hover:shadow-md transition-shadow">
 * Polish: <a href="#" onClick prevent> — same classes, same hover, prevents navigation.
 * Token changes vs production CompletionFileRowView:
 *   - Fee text:       var(--agent-text-primary) instead of rgba(15,23,42,0.7)
 *   - "No sols" text: var(--agent-warning)       instead of #b45309
 *   - SET_DATE:       var(--agent-text-muted) + var(--agent-border-subtle)
 *   - daysColor:      computed via computeDays() — CSS var tokens, not hex strings
 */
function FileCard({ file, groupKey }: { file: MockFile; groupKey: UrgencyKey }) {
  const s = GROUP_STYLES[groupKey];
  const isNoDate = groupKey === "no_date";
  const hasNeitherSol = !file.vendorSolicitorName && !file.purchaserSolicitorName;
  const { label: daysLabel, color: daysColor } = computeDays(file.completionDateIso);
  const exchangeLine = timeSinceExchange(file.exchangedAtIso);

  const SET_DATE_STYLE = {
    fontSize: 12,
    color: "var(--agent-text-muted)",
    border: "1px solid var(--agent-border-subtle)",
    borderRadius: 6,
    padding: "3px 8px",
    whiteSpace: "nowrap" as const,
    display: "inline-block",
  };

  const DateBlock = () =>
    isNoDate ? (
      <span style={SET_DATE_STYLE}>Set date</span>
    ) : (
      <div className="text-right">
        <p className={`text-sm font-bold mb-0.5 ${s.label}`}>{fmtDate(file.completionDateIso)}</p>
        {daysLabel && <p className="text-xs" style={{ color: daysColor }}>{daysLabel}</p>}
      </div>
    );

  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={`glass-card block px-5 py-4 border ${s.border} hover:shadow-md transition-shadow`}
      style={{ textDecoration: "none" }}
    >
      {/* Desktop layout */}
      <div className="hidden md:flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-slate-900/90 mb-1 truncate">{file.propertyAddress}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1">
            {file.purchasePrice && (
              <span className="text-sm text-slate-900/50">{fmt(file.purchasePrice)}</span>
            )}
            {file.agentFeeAmount && (
              <span className="text-sm font-medium" style={{ color: "var(--agent-text-primary)" }}>
                Fee: {fmt(file.agentFeeAmount)}
              </span>
            )}
            {file.purchasers.length > 0 && (
              <span className="text-sm text-slate-900/50">Purchaser: {file.purchasers.join(", ")}</span>
            )}
            {file.assignedUserName && (
              <span className="text-sm text-slate-900/50">Handled by: {file.assignedUserName}</span>
            )}
          </div>
          {exchangeLine && <p className="text-xs text-slate-900/40 mb-0.5">{exchangeLine}</p>}
          {hasNeitherSol ? (
            <p className="text-xs" style={{ color: "var(--agent-warning)" }}>No solicitors on file</p>
          ) : (
            <p className="text-xs text-slate-900/40 truncate">
              Vendor sol: {file.vendorSolicitorName ?? <em>not set</em>}
              {" · "}
              Purchaser sol: {file.purchaserSolicitorName ?? <em>not set</em>}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 self-start">
          <DateBlock />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex md:hidden flex-col gap-1">
        <p className="text-[15px] font-bold text-slate-900/90 leading-snug">{file.propertyAddress}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {file.purchasePrice && (
            <span className="text-sm text-slate-900/50">{fmt(file.purchasePrice)}</span>
          )}
          {file.agentFeeAmount && (
            <span className="text-sm font-medium" style={{ color: "var(--agent-text-primary)" }}>
              Fee: {fmt(file.agentFeeAmount)}
            </span>
          )}
          {file.purchasers.length > 0 && (
            <span className="text-sm text-slate-900/50">Purchaser: {file.purchasers.join(", ")}</span>
          )}
          {file.assignedUserName && (
            <span className="text-sm text-slate-900/50">Handled by: {file.assignedUserName}</span>
          )}
        </div>
        {exchangeLine && <p className="text-xs text-slate-900/40">{exchangeLine}</p>}
        {hasNeitherSol ? (
          <p className="text-xs" style={{ color: "var(--agent-warning)" }}>No solicitors on file</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-slate-900/40">
              Vendor sol: {file.vendorSolicitorName ?? <em>not set</em>}
            </p>
            <p className="text-xs text-slate-900/40">
              Purchaser sol: {file.purchaserSolicitorName ?? <em>not set</em>}
            </p>
          </div>
        )}
        <div className="flex justify-end mt-1">
          <DateBlock />
        </div>
      </div>
    </a>
  );
}

/* ─── Loading skeleton — mirrors urgency-group-as-card structure ────────────── */
/* Stage 4 transplants this structure to app/agent/completions/loading.tsx.       */
function LoadingSkeleton({ compact = false }: { compact?: boolean }) {
  const gap = compact ? 16 : 28;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {!compact && (
        <div className="agent-skeleton" style={{ height: 13, width: 240, borderRadius: 6 }} />
      )}

      {[{ labelW: 80 }, { labelW: 170 }, { labelW: 130 }].map(({ labelW }, i) => (
        <div key={i} className="agent-glass" style={{ overflow: "hidden" }}>
          {/* Skeleton group header — agent-acc-hdr structure with skeleton bars */}
          <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <div className="agent-skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />
              <div className="agent-skeleton" style={{ height: 11, width: labelW, borderRadius: 4 }} />
            </div>
            <div className="agent-skeleton" style={{ height: 11, width: 56, borderRadius: 4 }} />
          </div>

          {/* First group is "open" to show file card row skeletons */}
          {i === 0 && (
            <div className="agent-acc open">
              <div className="agent-acc-in">
                <div className="agent-acc-body">
                  <div className="space-y-2">
                    {[0, 1].map((ri) => (
                      <div key={ri} className="glass-card overflow-hidden">
                        <div
                          className="px-5 py-4"
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                        >
                          <div>
                            <div className="agent-skeleton" style={{ height: 13, width: 200, borderRadius: 6, marginBottom: 5 }} />
                            <div className="agent-skeleton" style={{ height: 11, width: 130, borderRadius: 6 }} />
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                            <div className="agent-skeleton" style={{ height: 11, width: 60, borderRadius: 6 }} />
                            <div className="agent-skeleton" style={{ height: 22, width: 52, borderRadius: 99 }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Empty state ghost — abstract skeleton shapes, filter-neutral ───────────── */
function CompletionsGhost() {
  return (
    <div data-testid="completions-ghost" style={{ opacity: 0.35, pointerEvents: "none" }}>
      {/* Single abstract urgency group — neutral (no red/amber/blue dot) */}
      <div className="agent-glass" style={{ overflow: "hidden" }}>
        {/* Header skeleton */}
        <div className="agent-acc-hdr">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div className="agent-skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />
            <div className="agent-skeleton" style={{ height: 11, width: 100, borderRadius: 4 }} />
          </div>
          <div className="agent-skeleton" style={{ height: 11, width: 52, borderRadius: 4 }} />
        </div>
        {/* Body — always shown open in ghost */}
        <div className="agent-acc open">
          <div className="agent-acc-in">
            <div className="agent-acc-body">
              <div className="space-y-2">
                {[200, 240].map((addrW, i) => (
                  <div key={i} className="glass-card overflow-hidden">
                    <div className="px-5 py-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div className="agent-skeleton" style={{ height: 13, width: addrW, borderRadius: 6, marginBottom: 5 }} />
                        <div className="agent-skeleton" style={{ height: 11, width: 110, borderRadius: 6 }} />
                      </div>
                      <div className="agent-skeleton" style={{ height: 22, width: 52, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
