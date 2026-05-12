"use client";
/* Polish reference for /agent/work-queue — Stage 2.
 *
 * Visual target for Stage 4. Every canonical class used here corresponds to a
 * Stage 4 conversion row in docs/polish-pass/inventory/work-queue.md §13.
 * No inline replication of canonical patterns — see §15 for any new classes
 * added during this Stage.
 *
 * State toggles at the top let you compare states:
 *   - Default        — populated with 3 urgency groups + file alerts strip
 *   - Snoozed view   — toggle to view the snoozed list (uses agent-snoozed tokens)
 *   - Zero-files     — empty state for new agencies
 *   - All caught up  — empty state when reminders are all clear
 *   - File alerts    — toggle FileAlertsStrip on/off
 *   - rm             — prefers-reduced-motion override
 */

import { useState, useEffect } from "react";
import type React from "react";
import Link from "next/link";
import {
  Bell, Warning, Clock, ArrowRight, CheckCircle,
  CaretDown,
} from "@phosphor-icons/react/dist/ssr";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const TP = "var(--agent-text-primary)";
const TS = "var(--agent-text-secondary)";
const TM = "var(--agent-text-muted)";

/* ─── Page-level CSS — polish-controls + reduced-motion only ─────────────── */
const CSS = `
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }
  /* SplitFileCard two-column → stack on mobile */
  @media (max-width: 640px) {
    .wq-split-body { flex-direction: column; gap: 8px; }
  }
`;

/* ─── Mock data ──────────────────────────────────────────────────────────── */

type MockReminder = {
  id: string;
  name: string;
  urgency: "escalated" | "overdue" | "due_today" | "coming_up";
  daysOverdue?: number;
  isDueToday?: boolean;
  fromDate?: string;
  side: "seller" | "buyer";
};

type MockFile = {
  txId: string;
  address: string;
  reminders: MockReminder[];
};

const ESCALATED_FILES: MockFile[] = [
  { txId: "t1", address: "14 Maple Drive, Bristol, BS1 4QR", reminders: [
    { id: "r1", name: "Legal pack not received", urgency: "escalated", daysOverdue: 21, side: "seller" },
  ]},
];

const OVERDUE_FILES: MockFile[] = [
  { txId: "t2", address: "7 Orchard Road, Bath, BA1 2NE", reminders: [
    { id: "r2", name: "Mortgage offer — confirm extension",  urgency: "overdue", daysOverdue: 4, side: "buyer" },
    { id: "r3", name: "Searches — chase council",            urgency: "overdue", daysOverdue: 6, side: "buyer" },
  ]},
  { txId: "t3", address: "22 Clifton Park, Bristol, BS8 3HJ", reminders: [
    { id: "r4", name: "Memorandum of sale — return signed",  urgency: "overdue", daysOverdue: 2, side: "seller" },
  ]},
];

const DUE_TODAY_FILES: MockFile[] = [
  { txId: "t4", address: "33 Park Street, Bristol, BS1 5NE", reminders: [
    { id: "r5", name: "Contract pack — review with vendor", urgency: "due_today", isDueToday: true, side: "seller" },
    { id: "r6", name: "Survey booked — confirm date",        urgency: "due_today", isDueToday: true, side: "buyer" },
  ]},
];

const COMING_UP_FILES: MockFile[] = [
  { txId: "t5", address: "8 Victoria Road, Bath, BA2 3RP", reminders: [
    { id: "r7", name: "Searches expected back",   urgency: "coming_up", fromDate: "14 May", side: "buyer" },
    { id: "r8", name: "Enquiries — chase reply", urgency: "coming_up", fromDate: "15 May", side: "seller" },
  ]},
];

const FILE_ALERTS = [
  { txId: "t6", address: "12 Elm Avenue, Bath, BA1 5QR", who: "Sarah Greene",   badge: "Missing solicitor", action: "Add purchaser solicitor →" },
  { txId: "t7", address: "5 Beech Lane, Bristol, BS2 9LM", who: null,            badge: "Overdue exchange",  action: "Update exchange date →" },
];

const SNOOZED_LIST = [
  { id: "s1", address: "44 Cedar Mews, Bath, BA1 6FT",     name: "Buildings insurance — chase quote", wakes: "13 May" },
  { id: "s2", address: "9 Oakridge Close, Bristol, BS9 4PB", name: "Stamp duty — confirm to buyer",     wakes: "14 May" },
];

/* ─── Urgency group config (E1 exception — semantic colour coding kept) ──── */

const GROUP_CONFIG = {
  escalated: { label: "Escalated", headerCls: "bg-red-50/70 border border-red-200",       labelCls: "text-red-700",      badgeCls: "bg-red-100 text-red-700",       leftBorder: "#dc2626", dotColor: "#dc2626" },
  overdue:   { label: "Overdue",   headerCls: "bg-orange-50/70 border border-orange-100", labelCls: "text-orange-700",   badgeCls: "bg-orange-100 text-orange-700", leftBorder: "#ea580c", dotColor: "#ea580c" },
  due_today: { label: "Due today", headerCls: "bg-amber-50/60 border border-amber-100",   labelCls: "text-amber-700",    badgeCls: "bg-amber-100 text-amber-700",   leftBorder: "#d97706", dotColor: "#d97706" },
  coming_up: { label: "Coming up", headerCls: "bg-white/30 border border-white/50",       labelCls: "text-slate-900/60", badgeCls: "bg-white/60 text-slate-900/60", leftBorder: "rgba(148,163,184,0.4)", dotColor: "#94a3b8" },
} as const;

type UrgencyKey = keyof typeof GROUP_CONFIG;

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WorkQueuePolishPage() {
  const [rm,           setRm]           = useState(false);
  const [view,         setView]         = useState<"active" | "snoozed">("active");
  const [emptyMode,    setEmptyMode]    = useState<"none" | "zero-files" | "all-clear">("none");
  const [showAlerts,   setShowAlerts]   = useState(true);
  const [alertsOpen,   setAlertsOpen]   = useState(true);

  /* Reduced-motion detection */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRm(mq.matches);
    const handler = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Filter pill state */
  const [sideFilter,   setSideFilter]   = useState<"all" | "seller" | "buyer">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "snoozed">("active");

  /* Sync statusFilter with view toggle */
  useEffect(() => { setStatusFilter(view); }, [view]);

  /* Urgency-group collapsed state (default open in polish — production starts collapsed) */
  const [collapsed, setCollapsed] = useState<Record<UrgencyKey, boolean>>({
    escalated: false, overdue: false, due_today: false, coming_up: true,
  });

  /* Stat counts */
  const overdueCount  = ESCALATED_FILES.reduce((s,f) => s + f.reminders.length, 0)
                      + OVERDUE_FILES.reduce((s,f) => s + f.reminders.length, 0);
  const dueTodayCount = DUE_TODAY_FILES.reduce((s,f) => s + f.reminders.length, 0);
  const comingUpCount = COMING_UP_FILES.reduce((s,f) => s + f.reminders.length, 0);

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
          Work Queue · Stage 2
        </span>
        <div className="pp-bar">
          <span className="pp-bar-label">View:</span>
          <button className={`pp-pill${view === "active"  ? " on" : ""}`} onClick={() => setView("active")}>Active</button>
          <button className={`pp-pill${view === "snoozed" ? " on" : ""}`} onClick={() => setView("snoozed")}>Snoozed</button>
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">Empty:</span>
          <button className={`pp-pill${emptyMode === "none"        ? " on" : ""}`} onClick={() => setEmptyMode("none")}>None</button>
          <button className={`pp-pill${emptyMode === "zero-files"  ? " on" : ""}`} onClick={() => setEmptyMode("zero-files")}>Zero files</button>
          <button className={`pp-pill${emptyMode === "all-clear"   ? " on" : ""}`} onClick={() => setEmptyMode("all-clear")}>All caught up</button>
        </div>
        <div className="pp-bar">
          <button className={`pp-pill${showAlerts ? " on" : ""}`} onClick={() => setShowAlerts(v => !v)}>File alerts</button>
          <button className={`pp-pill${rm         ? " on" : ""}`} onClick={() => setRm(v => !v)}>Reduced motion</button>
        </div>
      </div>

      {/* ── PageHeader (mocked inline — same structure as production) ──────── */}
      <div className="agent-page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 32px 16px", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: TP, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Reminders
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: TM }}>
            What needs chasing, today and ahead.
          </p>
        </div>
        {emptyMode !== "zero-files" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {overdueCount  > 0 && <StatPill href="#section-overdue"   label={`${overdueCount} overdue`}   color="danger"  />}
            {dueTodayCount > 0 && <StatPill href="#section-due_today" label={`${dueTodayCount} due today`} color="warning" />}
            {comingUpCount > 0 && <StatPill href="#section-upcoming"  label={`${comingUpCount} coming up`} color="muted"   />}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: "8px 32px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Zero-files empty state */}
        {emptyMode === "zero-files" && <ZeroFilesEmpty />}

        {/* All-caught-up empty state */}
        {emptyMode === "all-clear" && <AllClearEmpty />}

        {/* Active / Snoozed views */}
        {emptyMode === "none" && (
          <>
            {showAlerts && <FileAlertsStrip open={alertsOpen} onToggle={() => setAlertsOpen(v => !v)} />}

            {/* Filter bar — sticky */}
            <FilterBar
              sideFilter={sideFilter} setSideFilter={setSideFilter}
              statusFilter={statusFilter} setStatusFilter={(v) => { setStatusFilter(v); setView(v); }}
              snoozedCount={SNOOZED_LIST.length}
            />

            {view === "active" ? (
              <>
                <UrgencyGroup
                  groupKey="escalated"
                  files={ESCALATED_FILES}
                  collapsed={collapsed.escalated}
                  onToggle={() => setCollapsed(p => ({ ...p, escalated: !p.escalated }))}
                />
                <UrgencyGroup
                  groupKey="overdue"
                  files={OVERDUE_FILES}
                  collapsed={collapsed.overdue}
                  onToggle={() => setCollapsed(p => ({ ...p, overdue: !p.overdue }))}
                />
                <UrgencyGroup
                  groupKey="due_today"
                  files={DUE_TODAY_FILES}
                  collapsed={collapsed.due_today}
                  onToggle={() => setCollapsed(p => ({ ...p, due_today: !p.due_today }))}
                />
                <UrgencyGroup
                  groupKey="coming_up"
                  files={COMING_UP_FILES}
                  collapsed={collapsed.coming_up}
                  onToggle={() => setCollapsed(p => ({ ...p, coming_up: !p.coming_up }))}
                />
              </>
            ) : (
              <SnoozedView />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   StatPill — same structure as components/layout/StatPill.tsx + hover state
   added (Stage 4 conversion: this is the target).
   ═══════════════════════════════════════════════════════════════════════════ */

type PillColor = "danger" | "warning" | "muted";

function StatPill({ href, label, color }: { href: string; label: string; color: PillColor }) {
  /* Solid pale-tint backgrounds matching StatusBadge (bg-red-50/border-red-200 pattern).
   * Theme-fixed semantic pills — pop on any agent background, including cool-toned
   * themes (Heritage, Slate) where rgba-tinted bgs blend into the page. */
  const styleMap: Record<PillColor, React.CSSProperties> = {
    danger:  { color: "var(--agent-danger)",         background: "#fef2f2", border: "1px solid #fecaca" }, // red-50  / red-200
    warning: { color: "var(--agent-warning)",        background: "#fffbeb", border: "1px solid #fde68a" }, // amber-50 / amber-200
    muted:   { color: "var(--agent-text-secondary)", background: "#f8fafc", border: "1px solid #e2e8f0" }, // slate-50 / slate-200
  };
  return (
    <a href={href} className="agent-link" style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, textDecoration: "none",
      transition: "filter 150ms ease, background 150ms ease",
      ...styleMap[color],
    }}>
      {label}
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FileAlertsStrip — uses NEW agent-card-hdr-warning canonical class.
   ═══════════════════════════════════════════════════════════════════════════ */

function FileAlertsStrip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header — agent-card-hdr-warning (NEW canonical, see ANIMATION_STANDARDS.md §S5) */}
      <div className="agent-card-hdr-warning">
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <Warning weight="fill" size={13} color="var(--agent-warning)" />
          <span className="agent-card-title">2 file alerts</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 6, color: "var(--agent-warning)", background: "var(--agent-warning-bg)", border: "1px solid var(--agent-warning-border)" }}>
            1 overdue exchange
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 6, color: "var(--agent-warning)", background: "var(--agent-warning-bg)", border: "1px solid var(--agent-warning-border)" }}>
            1 missing solicitor
          </span>
        </div>
        <button onClick={onToggle} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {/* Body — agent-acc / agent-acc-in for animated collapse */}
      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
          {FILE_ALERTS.map((alert, i) => (
            <Link
              key={alert.txId}
              href={`/agent/transactions/${alert.txId}`}
              className="agent-hover-row"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "12px 16px",
                borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                textDecoration: "none",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {alert.address}
                </p>
                {alert.who && (
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: TM }}>
                    {alert.who}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, color: "var(--agent-warning)", background: "var(--agent-warning-bg)", border: "1px solid var(--agent-warning-border)" }}>
                  {alert.badge}
                </span>
                <span className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
                  {alert.action}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FilterBar — agent-segment-pill replaces bespoke FilterChip
   ═══════════════════════════════════════════════════════════════════════════ */

function FilterBar({
  sideFilter, setSideFilter,
  statusFilter, setStatusFilter,
  snoozedCount,
}: {
  sideFilter: "all" | "seller" | "buyer";
  setSideFilter: (v: "all" | "seller" | "buyer") => void;
  statusFilter: "active" | "snoozed";
  setStatusFilter: (v: "active" | "snoozed") => void;
  snoozedCount: number;
}) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 20,
      background: "rgba(var(--agent-bg-base-rgb),0.93)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderRadius: "var(--agent-radius-lg)",
      border: "0.5px solid rgba(var(--agent-coral-base-rgb),0.18)",
      padding: "10px 16px",
    }}>
      <input
        type="text"
        placeholder="Search address or reminder…"
        className="agent-input agent-input-sm"
        style={{ width: "100%", marginBottom: 10, fontSize: 13 }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "all"    ? " on" : ""}`} onClick={() => setSideFilter("all")}>All</button>
          <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "seller" ? " on" : ""}`} onClick={() => setSideFilter("seller")}>Seller</button>
          <button className={`agent-segment-pill agent-segment-pill-sm${sideFilter === "buyer"  ? " on" : ""}`} onClick={() => setSideFilter("buyer")}>Buyer</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className={`agent-segment-pill agent-segment-pill-sm${statusFilter === "active"  ? " on" : ""}`} onClick={() => setStatusFilter("active")}>Active</button>
          <button className={`agent-segment-pill agent-segment-pill-sm${statusFilter === "snoozed" ? " on" : ""}`} onClick={() => setStatusFilter("snoozed")}>
            Snoozed{snoozedCount > 0 ? ` (${snoozedCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   UrgencyGroup — E1 exception: semantic colour headers kept (NOT agent-acc-hdr).
   Body wrapped in agent-acc / agent-acc-in for animated expand/collapse.
   ═══════════════════════════════════════════════════════════════════════════ */

function UrgencyGroup({
  groupKey, files, collapsed, onToggle,
}: {
  groupKey: UrgencyKey;
  files: MockFile[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (files.length === 0) return null;
  const cfg = GROUP_CONFIG[groupKey];
  const totalReminders = files.reduce((s, f) => s + f.reminders.length, 0);
  const sectionId = groupKey === "coming_up" ? "section-upcoming" : `section-${groupKey}`;

  return (
    <div id={sectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Group header — E1 exception: semantic colours kept, NOT agent-acc-hdr */}
      <div className={`flex items-center justify-between rounded-xl ${cfg.headerCls}`}
        style={{ padding: "8px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.labelCls}`}>{cfg.label}</span>
          <span className={`text-xs font-bold rounded-full ${cfg.badgeCls}`} style={{ padding: "1px 8px" }}>{totalReminders}</span>
        </div>
        <button onClick={onToggle} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {/* Body — agent-acc / agent-acc-in (canonical collapse animation) */}
      <div className={`agent-acc${!collapsed ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {files.map((file) => (
              <SplitFileCard key={file.txId} file={file} leftBorder={cfg.leftBorder} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SplitFileCard — agent-glass-strong + agent-card-hdr for address header.
   Address: agent-link on text, arrow extracted to sibling span (no underline
   on the arrow). See work-queue.md §13 + §15 — address-link decision.
   ═══════════════════════════════════════════════════════════════════════════ */

function SplitFileCard({ file, leftBorder }: { file: MockFile; leftBorder: string }) {
  const sellerReminders = file.reminders.filter(r => r.side === "seller");
  const buyerReminders  = file.reminders.filter(r => r.side === "buyer");

  return (
    <div className="agent-glass-strong" style={{
      borderRadius: 20, overflow: "hidden",
      borderLeft: `4px solid ${leftBorder}`,
    }}>
      {/* Address header — follows agent-card-hdr spacing intent with semi-transparent bg */}
      <div className="agent-card-hdr" style={{
        background: "rgba(255,255,255,0.28)",
        padding: "10px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
          <Link href={`/agent/transactions/${file.txId}`} className="agent-link"
            style={{
              fontSize: 13, fontWeight: 600, color: TP,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textDecoration: "none",
            }}>
            {file.address}
          </Link>
          {/* Arrow extracted to sibling span — outside the anchor, so agent-link's
              hover underline does not extend across the arrow. */}
          <span aria-hidden style={{ fontSize: 13, color: TM, flexShrink: 0 }}>→</span>
        </div>
        <span style={{ fontSize: 11, color: TM, flexShrink: 0, whiteSpace: "nowrap" }}>
          {file.reminders.length} {file.reminders.length === 1 ? "reminder" : "reminders"}
        </span>
      </div>

      {/* Two-column body — stacks on mobile via .wq-split-body media query */}
      <div className="wq-split-body" style={{ display: "flex", gap: 10, padding: "12px 14px 14px" }}>
        {sellerReminders.length > 0
          ? <SideColumn side="seller" reminders={sellerReminders} />
          : <EmptyColumn side="seller" />}
        {buyerReminders.length > 0
          ? <SideColumn side="buyer" reminders={buyerReminders} />
          : <EmptyColumn side="buyer" />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SideColumn — colour-coded header (seller/buyer); chase button uses
   agent-btn-primary; snooze trigger / Done use agent-btn-sm.
   ═══════════════════════════════════════════════════════════════════════════ */

function SideColumn({ side, reminders }: { side: "seller" | "buyer"; reminders: MockReminder[] }) {
  const isSeller = side === "seller";
  const dotColor = isSeller ? "#ea580c" : "#3b82f6";
  const columnBg = isSeller ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)";
  const borderCol = isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)";
  const labelColor = isSeller ? "#ea580c" : "#3b82f6";

  return (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 14,
      background: columnBg, border: `0.5px solid ${borderCol}`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px",
        borderBottom: `0.5px solid ${borderCol}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor }}>
          {isSeller ? "Seller" : "Buyer"}
        </span>
        {/* OLD: "{N} item / items" — Rule 3: "item" is generic; "reminder" is the page's primary noun and more specific */}
        <span style={{ fontSize: 10, color: TM, marginLeft: "auto" }}>
          {reminders.length} {reminders.length === 1 ? "reminder" : "reminders"}
        </span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, padding: "6px 0" }}>
        {reminders.map((r, i) => {
          const urgencyColor =
              r.urgency === "escalated" ? "#dc2626"
            : r.urgency === "overdue"   ? "#ea580c"
            : r.urgency === "due_today" ? "#d97706"
            : TM;
          const urgencyLabel =
              r.urgency === "escalated" ? "Escalated"
            : r.urgency === "overdue"   ? `${r.daysOverdue}d overdue`
            : r.urgency === "due_today" ? "Due today"
            : r.fromDate                ? `From ${r.fromDate}`
            : null;

          return (
            <div key={r.id} style={{
              padding: "7px 12px",
              borderTop: i > 0 ? "0.5px solid rgba(15,23,42,0.06)" : undefined,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: TP, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                </p>
                {urgencyLabel && (
                  <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 600, color: urgencyColor }}>
                    {urgencyLabel}
                  </p>
                )}
              </div>
              {/* Snooze trigger — agent-btn-secondary (neutral white-glass hover) */}
              <button className="agent-btn agent-btn-sm agent-btn-secondary" title="Snooze">
                <Clock size={12} weight="regular" />
              </button>
              {/* Done — agent-btn-secondary (neutral white-glass hover, matches Snooze) */}
              {/* OLD: title="Confirm milestone done" — Rule 2: "milestone" is schema jargon (translation table: milestone → step) */}
              <button className="agent-btn agent-btn-sm agent-btn-secondary" title="Mark step done">
                <CheckCircle size={12} weight="fill" /> Done
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer — Chase + Snooze all */}
      <div style={{
        padding: "8px 12px",
        borderTop: "0.5px solid rgba(15,23,42,0.06)",
        display: "flex", gap: 6, alignItems: "center",
      }}>
        <button className="agent-btn agent-btn-sm agent-btn-primary" style={{ flex: 1 }}>
          {reminders.length === 1 ? "Chase" : `Chase all (${reminders.length})`}
        </button>
        <button className="agent-btn agent-btn-sm agent-btn-ghost">
          <Clock size={12} weight="regular" /> Snooze all
        </button>
      </div>
    </div>
  );
}

function EmptyColumn({ side }: { side: "seller" | "buyer" }) {
  const isSeller = side === "seller";
  const dotColor = isSeller ? "#ea580c" : "#3b82f6";
  const columnBg = isSeller ? "rgba(251,146,60,0.06)" : "rgba(59,130,246,0.06)";
  const borderCol = isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)";
  const labelColor = isSeller ? "#ea580c" : "#3b82f6";

  return (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 14,
      background: columnBg, border: `0.5px solid ${borderCol}`,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "8px 12px",
        borderBottom: `0.5px solid ${borderCol}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor }}>
          {isSeller ? "Seller" : "Buyer"}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
        <span style={{ fontSize: 11, color: TM, fontStyle: "italic" }}>
          {isSeller ? "Seller" : "Buyer"} is all up to date
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SnoozedView — uses --agent-snoozed-* tokens (NEW, see ANIMATION_STANDARDS.md
   "Snoozed token family"). agent-glass-strong card + snoozed banner header.
   ═══════════════════════════════════════════════════════════════════════════ */

function SnoozedView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {SNOOZED_LIST.map((item) => (
        <div key={item.id} className="agent-glass-strong" style={{
          borderRadius: 20, overflow: "hidden",
          borderLeft: "4px solid var(--agent-snoozed-border)",
        }}>
          {/* Snoozed banner — agent-snoozed token family */}
          <div style={{
            padding: "8px 16px",
            background: "var(--agent-snoozed-bg)",
            color: "var(--agent-snoozed)",
            borderBottom: "0.5px solid var(--agent-snoozed-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12, fontWeight: 500,
          }}>
            <span>Wakes {item.wakes}</span>
            <button
              className="agent-link agent-link-muted"
              style={{ fontSize: 12, color: "var(--agent-snoozed)" }}
            >
              Wake now
            </button>
          </div>
          {/* Body */}
          <div style={{ padding: "12px 20px" }}>
            <Link href={`/agent/transactions/${item.id}`} className="agent-link" style={{
              fontSize: 12, color: TS, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {item.address}
              <span aria-hidden style={{ color: TM }}>→</span>
            </Link>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: TP }}>
              {item.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ZeroFilesEmpty — agent-glass-strong card + Bell icon + fixed voice copy
   ═══════════════════════════════════════════════════════════════════════════ */

function ZeroFilesEmpty() {
  return (
    <>
      <div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
        <Bell weight="regular" size={32} style={{ color: TM, opacity: 0.45, margin: "0 auto 16px", display: "block" }} />
        <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: TP }}>
          Your reminders will appear here
        </p>
        <p style={{ margin: "0 auto", fontSize: 13, color: TM, maxWidth: 340, lineHeight: 1.5 }}>
          {/* OLD: "Once you create a sale, we'll surface chases and follow-ups as files progress." — Rule 1 (VOICE_GUIDELINES.md pre-catalogued) */}
          Chases and follow-ups appear here as your files move forward.
        </p>
      </div>

      {/* Ghost group preview — skeleton lines, not mock data.
       * Keeps group headers + row count to convey the structure agents will see;
       * replaces hardcoded addresses/reminders/tags with .agent-skeleton shapes. */}
      <div style={{ opacity: 0.5, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
        {[
          { label: "Overdue",   rows: 2 },
          { label: "Due today", rows: 1 },
        ].map(group => (
          <div key={group.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TM }}>{group.label}</span>
              <div className="agent-skeleton" style={{ height: 18, width: 22, borderRadius: 99 }} />
            </div>
            <div className="agent-glass-strong" style={{ borderRadius: 12, overflow: "hidden" }}>
              {Array.from({ length: group.rows }).map((_, i) => (
                <div key={i} style={{
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="agent-skeleton" style={{ height: 12, width: "55%", borderRadius: 6, marginBottom: 7 }} />
                    <div className="agent-skeleton" style={{ height: 10, width: "38%", borderRadius: 6 }} />
                  </div>
                  <div className="agent-skeleton" style={{ height: 20, width: 76, borderRadius: 6, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AllClearEmpty — agent-glass-strong card + CheckCircle + fixed voice copy
   ═══════════════════════════════════════════════════════════════════════════ */

function AllClearEmpty() {
  return (
    <div className="agent-glass-strong" style={{ padding: "40px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
      <CheckCircle weight="fill" size={32} style={{ color: "var(--agent-success)", margin: "0 auto 10px", display: "block" }} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TP }}>All caught up</p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: TM }}>
        {/* OLD: "No reminders due right now. We'll surface them here as files progress." — Rule 1 (system self-reference) */}
        {/* Refined Stage 3: "show up" → "appear" — matches the canonical verb used in the zero-files copy (VOICE_GUIDELINES.md After value) */}
        No reminders due right now. They&apos;ll appear here as files move forward.
      </p>
    </div>
  );
}
