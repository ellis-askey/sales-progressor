"use client";
/* Polish reference for /agent/transactions — Stage 2.
 *
 * Visual target for Stage 4. Every canonical class used here corresponds to a
 * Stage 4 conversion row in docs/polish-pass/inventory/transaction-list.md §13.
 * No inline replication of canonical patterns. §15 contributions: zero new
 * canonical classes — the library is mature for this page.
 *
 * Locked Stage 2 decisions:
 *   - Bloom decorations from inline header: DROPPED. Canonical PageHeader only.
 *   - 4 dropdown surfaces (3 chips + risk popover) use createPortal + agent-dropdown-in
 *     (work-queue B1+B2 pattern — escapes ancestor overflow:hidden / sticky stacking).
 *   - Voice fixes applied to all 7 flagged strings from §7.1.
 *
 * State toggles compare:
 *   - View: populated / zero-files / filter-empty / hub-filter active
 *   - Director / Negotiator (Owner column visibility)
 *   - Reduced motion
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import Link from "next/link";
import { Plus, HouseLine, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { X } from "lucide-react";

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
  /* Mobile column stack — TransactionRow uses dual layouts already, this just confirms */
  @media (max-width: 767px) {
    .tl-desktop-row { display: none !important; }
    .tl-mobile-row { display: flex !important; }
  }
  @media (min-width: 768px) {
    .tl-desktop-row { display: grid !important; }
    .tl-mobile-row { display: none !important; }
  }
`;

/* ─── Mock data ──────────────────────────────────────────────────────────── */

type MockRow = {
  id: string;
  addressLine: string;
  location: string;
  vendor: string;
  buyer: string;
  status: "active" | "on_hold" | "completed" | "withdrawn";
  risk: "low" | "medium" | "high";
  exchangeDate: string | null;     // ISO yyyy-mm-dd or null
  lastActive: { primary: string; secondary: string | null; tone: "normal" | "amber" | "red" | "muted"; stale: boolean };
  assignedUser: { name: string; initials: string } | null;
  agentUser?: { name: string; role: string };
  serviceType: "self_managed" | "outsourced";
  nextAction?: string;
};

const ROWS: MockRow[] = [
  { id: "tx1", addressLine: "14 Maple Drive", location: "Bristol, BS1 4QR", vendor: "Greene", buyer: "Patel S.",
    status: "active", risk: "high", exchangeDate: "2026-05-20",
    lastActive: { primary: "2 days ago", secondary: "10 May", tone: "normal", stale: false },
    assignedUser: { name: "Rachel Whitfield", initials: "RW" }, serviceType: "self_managed",
    nextAction: "Chase legal pack" },
  { id: "tx2", addressLine: "7 Orchard Road", location: "Bath, BA1 2NE", vendor: "Holloway", buyer: "Carter M.",
    status: "active", risk: "medium", exchangeDate: "2026-06-04",
    lastActive: { primary: "Today, 09:14", secondary: null, tone: "normal", stale: false },
    assignedUser: { name: "James Hunt", initials: "JH" }, serviceType: "outsourced" },
  { id: "tx3", addressLine: "22 Clifton Park", location: "Bristol, BS8 3HJ", vendor: "Whitmore", buyer: "Davies R.",
    status: "active", risk: "low", exchangeDate: "2026-07-12",
    lastActive: { primary: "Yesterday", secondary: null, tone: "normal", stale: false },
    assignedUser: { name: "Rachel Whitfield", initials: "RW" }, serviceType: "self_managed" },
  { id: "tx4", addressLine: "33 Park Street", location: "Bristol, BS1 5NE", vendor: "—", buyer: "—",
    status: "on_hold", risk: "medium", exchangeDate: null,
    lastActive: { primary: "12 days ago", secondary: "01 May", tone: "amber", stale: false },
    assignedUser: null, agentUser: { name: "James Hunt", role: "Negotiator" }, serviceType: "outsourced" },
  { id: "tx5", addressLine: "8 Victoria Road", location: "Bath, BA2 3RP", vendor: "Singh", buyer: "—",
    status: "active", risk: "low", exchangeDate: "2026-08-01",
    lastActive: { primary: "34 days ago", secondary: "08 Apr", tone: "red", stale: true },
    assignedUser: { name: "Rachel Whitfield", initials: "RW" }, serviceType: "self_managed" },
];

const STATUS_TABS = [
  { value: "all",       label: "All",       count: 18 },
  { value: "active",    label: "Active",    count: 12 },
  { value: "on_hold",   label: "On hold",   count: 2  },   // voice: "On hold" (sentence case)
  { value: "completed", label: "Completed", count: 3  },
  { value: "withdrawn", label: "Withdrawn", count: 1  },
] as const;

type RiskLevel = "low" | "medium" | "high";
const RISK_LABEL: Record<RiskLevel, string> = { low: "On track", medium: "Watch", high: "At risk" };
const RISK_CFG: Record<RiskLevel, { bg: string; border: string; color: string; dot: string }> = {
  low:    { bg: "#ecfdf5", border: "#a7f3d0", color: "#065f46", dot: "#10b981" },
  medium: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", dot: "#f59e0b" },
  high:   { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", dot: "#ef4444" },
};

const STATUS_CFG: Record<MockRow["status"], { bg: string; text: string; border: string; label: string }> = {
  active:    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", label: "Active" },
  on_hold:   { bg: "#fffbeb", text: "#b45309", border: "#fde68a", label: "On Hold" },
  completed: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", label: "Completed" },
  withdrawn: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", label: "Withdrawn" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TransactionListPolishPage() {
  const [rm,         setRm]         = useState(false);
  const [view,       setView]       = useState<"populated" | "zero-files" | "filter-empty" | "client-empty">("populated");
  const [showHubFilter, setShowHubFilter] = useState(false);
  const [isDirector, setIsDirector] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  /* Client-side filter chip state (visual only) */
  const [ownerSel, setOwnerSel] = useState<string | null>(null);
  const [riskSel,  setRiskSel]  = useState<Set<RiskLevel>>(new Set());
  const [mgdSel,   setMgdSel]   = useState<"all" | "self_managed" | "outsourced">("all");
  const [search,   setSearch]   = useState("");

  /* Reduced-motion detection */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRm(mq.matches);
    const handler = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const anyFilterActive = ownerSel !== null || riskSel.size > 0 || mgdSel !== "all" || search.length > 0;

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
          Transaction List · Stage 2
        </span>
        <div className="pp-bar">
          <span className="pp-bar-label">View:</span>
          <button className={`pp-pill${view === "populated"    ? " on" : ""}`} onClick={() => setView("populated")}>Populated</button>
          <button className={`pp-pill${view === "zero-files"   ? " on" : ""}`} onClick={() => setView("zero-files")}>Zero files</button>
          <button className={`pp-pill${view === "filter-empty" ? " on" : ""}`} onClick={() => setView("filter-empty")}>Filter empty</button>
          <button className={`pp-pill${view === "client-empty" ? " on" : ""}`} onClick={() => setView("client-empty")}>Client empty</button>
        </div>
        <div className="pp-bar">
          <button className={`pp-pill${showHubFilter ? " on" : ""}`} onClick={() => setShowHubFilter(v => !v)}>Hub filter</button>
          <button className={`pp-pill${isDirector    ? " on" : ""}`} onClick={() => setIsDirector(v => !v)}>Director view</button>
          <button className={`pp-pill${rm           ? " on" : ""}`} onClick={() => setRm(v => !v)}>Reduced motion</button>
        </div>
      </div>

      {/* ── PageHeader (canonical, NO bloom decorations — Stage 2 decision: A) ── */}
      <div className="agent-page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 32px 16px", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: TP, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {isDirector ? "All Files" : "My Files"}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: TM }}>
            {isDirector ? "Every file across the agency." : "Files assigned to you."}
          </p>
        </div>
        <Link href="#" className="agent-btn agent-btn-primary agent-btn-sm" style={{ textDecoration: "none" }}>
          <Plus size={14} weight="bold" />
          New sale
        </Link>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: "8px 32px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

        {view === "zero-files" ? <ZeroFilesEmpty />
         : view === "filter-empty" ? <ServerFilterEmpty />
         : (
          <>
            {showHubFilter && <HubFilterBanner />}

            {/* Status tabs — agent-segment-pill-sm */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", overflowX: "auto" }}>
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setStatusFilter(t.value)}
                  className={`agent-segment-pill agent-segment-pill-sm${statusFilter === t.value ? " on" : ""}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {t.label}
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    padding: "1px 7px", borderRadius: 99,
                    background: statusFilter === t.value ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
                    color: statusFilter === t.value ? "var(--agent-coral-deep)" : TM,
                  }}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Search + filter chips — agent-glass-strong wrapper for visual surface parity */}
            <div className="agent-glass-strong" style={{ padding: "12px 14px", borderRadius: "var(--agent-radius-xl)", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <MagnifyingGlass size={14} weight="regular" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TM, pointerEvents: "none" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by address…"
                  className="agent-input agent-input-sm"
                  style={{ width: "100%", paddingLeft: 34, paddingRight: 34, fontSize: 13 }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="agent-icon-btn agent-icon-btn-sm"
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
                    aria-label="Clear search"
                  >×</button>
                )}
              </div>

              {/* Filter chips row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <OwnerChip selected={ownerSel} onChange={setOwnerSel} />
                <RiskChip selected={riskSel} onToggle={(l) => setRiskSel(prev => {
                  const next = new Set(prev); if (next.has(l)) next.delete(l); else next.add(l); return next;
                })} />
                <ManagedByChip value={mgdSel} onChange={setMgdSel} />
                {anyFilterActive && (
                  <button
                    onClick={() => { setOwnerSel(null); setRiskSel(new Set()); setMgdSel("all"); setSearch(""); }}
                    className="agent-link agent-link-muted"
                    style={{ fontSize: 12, marginLeft: 4 }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Table or client-empty */}
            {view === "client-empty"
              ? <ClientFilterEmpty hasSearch={search.length > 0} query={search} onClear={() => { setOwnerSel(null); setRiskSel(new Set()); setMgdSel("all"); setSearch(""); }} />
              : <TransactionTable rows={ROWS} showOwner={isDirector && ownerSel === null} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hub filter banner
   ═══════════════════════════════════════════════════════════════════════════ */

function HubFilterBanner() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderRadius: 10,
      background: "rgba(var(--agent-coral-base-rgb), 0.07)",
      border: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.18)",
    }}>
      <span style={{ fontSize: 13, color: TS, flex: 1 }}>
        Showing{" "}
        <strong style={{ color: TP, fontWeight: 600 }}>exchanging this week</strong>{" "}
        <span style={{ color: TM }}>(3)</span>
      </span>
      <Link href="#" className="agent-link agent-link-muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <X size={11} />
        Clear filter
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Filter chips — agent-segment-pill-sm trigger + portal dropdown (B1+B2 pattern)
   ═══════════════════════════════════════════════════════════════════════════ */

function useChipDropdown() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);
  function openDropdown() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(v => !v);
  }
  return { open, pos, ref, openDropdown, setOpen };
}

function OwnerChip({ selected, onChange }: { selected: string | null; onChange: (id: string | null) => void }) {
  const { open, pos, ref, openDropdown, setOpen } = useChipDropdown();
  const isActive = selected !== null;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
      >
        {isActive ? `Owner: ${selected}` : "Owner"}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div className="agent-dropdown-in" style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
          minWidth: 180,
        }}>
          <button className="agent-dropdown-item" onClick={() => { onChange(null); setOpen(false); }}>All owners</button>
          {["Rachel", "James", "Sophie"].map(u => (
            <button key={u} className="agent-dropdown-item" onClick={() => { onChange(u); setOpen(false); }}>
              {u}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function RiskChip({ selected, onToggle }: { selected: Set<RiskLevel>; onToggle: (l: RiskLevel) => void }) {
  const { open, pos, ref, openDropdown } = useChipDropdown();
  const isActive = selected.size > 0;
  const label = isActive
    ? `Risk: ${[...selected].map(l => RISK_LABEL[l]).join(", ")}`
    : "Risk";
  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
      >
        {label}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div className="agent-dropdown-in" style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
          minWidth: 170, padding: "4px 0",
        }}>
          {(["low", "medium", "high"] as RiskLevel[]).map(l => {
            const checked = selected.has(l);
            return (
              <button key={l} className="agent-dropdown-item" onClick={() => onToggle(l)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  background: checked ? "var(--agent-coral-deep)" : "transparent",
                  border: `1px solid ${checked ? "var(--agent-coral-deep)" : "rgba(0,0,0,0.20)"}`,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <span style={{ color: "white", fontSize: 9, lineHeight: 1 }}>✓</span>}
                </span>
                {/* Voice fix: RISK_LABEL values are full phrases. NO " risk" appended. */}
                <span style={{ color: TS }}>{RISK_LABEL[l]}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function ManagedByChip({ value, onChange }: {
  value: "all" | "self_managed" | "outsourced";
  onChange: (v: "all" | "self_managed" | "outsourced") => void;
}) {
  const { open, pos, ref, openDropdown, setOpen } = useChipDropdown();
  const isActive = value !== "all";
  // Voice fix: translation table per VOICE_GUIDELINES.md
  const labelMap = { all: "Managed by", self_managed: "Managed by you", outsourced: "Our team is handling" } as const;
  const opts: { value: "all" | "self_managed" | "outsourced"; label: string }[] = [
    { value: "all",          label: "All" },
    { value: "self_managed", label: "Managed by you" },
    { value: "outsourced",   label: "Our team is handling" },
  ];
  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
      >
        {labelMap[value]}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div className="agent-dropdown-in" style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
          minWidth: 200,
        }}>
          {opts.map(opt => (
            <button key={opt.value} className="agent-dropdown-item" onClick={() => { onChange(opt.value); setOpen(false); }}>
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TransactionTable — agent-glass-strong + grid; rows hover via agent-hover-row
   ═══════════════════════════════════════════════════════════════════════════ */

function TransactionTable({ rows, showOwner }: { rows: MockRow[]; showOwner: boolean }) {
  const gridCols = showOwner
    ? "4px minmax(0,1fr) 160px 160px 110px 120px 100px 130px"
    : "4px minmax(0,1fr) 160px 160px 110px 120px 100px";

  return (
    <div className="agent-glass-strong" style={{ borderRadius: 20, overflow: "hidden" }}>
      {/* Header — desktop only */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: gridCols,
          background: "rgba(var(--agent-shadow-rgb), 0.04)",
          borderBottom: "0.5px solid var(--agent-border-subtle)",
        }}
      >
        <div />
        {(["Property", "Assigned to", "Exchange target", "Status", "Risk", "Last active", ...(showOwner ? ["Owner"] : [])] as string[]).map((label) => (
          <button
            key={label}
            className="agent-link agent-link-muted"
            style={{
              padding: "12px 16px",
              fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.04em",
              color: TM,
              textAlign: "left",
              background: "none", border: "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.map((tx, i) => (
        <TransactionRow key={tx.id} tx={tx} showOwner={showOwner} isLast={i === rows.length - 1} />
      ))}
    </div>
  );
}

function TransactionRow({ tx, showOwner, isLast }: { tx: MockRow; showOwner: boolean; isLast: boolean }) {
  const gridCols = showOwner
    ? "4px minmax(0,1fr) 160px 160px 110px 120px 100px 130px"
    : "4px minmax(0,1fr) 160px 160px 110px 120px 100px";

  const riskStripe = tx.risk === "high" ? "#ef4444" : tx.risk === "medium" ? "#f59e0b" : "#10b981";
  const divider = !isLast ? "0.5px solid var(--agent-border-subtle)" : "none";

  return (
    <>
      {/* ── Desktop row ─────────────────────────────────────── */}
      <Link
        href="#"
        className="tl-desktop-row agent-hover-row"
        style={{
          gridTemplateColumns: gridCols,
          alignItems: "center",
          textDecoration: "none",
          borderBottom: divider,
        }}
      >
        <div style={{ background: riskStripe, alignSelf: "stretch" }} />

        <div style={{ padding: "14px 16px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tx.addressLine}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: TM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tx.location}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: TM }}>
            Vendor: {tx.vendor} · Buyer: {tx.buyer}
          </p>
          {tx.nextAction && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-coral-deep)", fontWeight: 600 }}>
              → {tx.nextAction}
            </p>
          )}
        </div>

        <div style={{ padding: "14px 16px" }}>
          {tx.assignedUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{tx.assignedUser.initials}</span>
              </div>
              <span style={{ fontSize: 13, color: TS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.assignedUser.name}</span>
            </div>
          ) : tx.serviceType === "outsourced" ? (
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-warning)" }}>Awaiting assignment</span>
          ) : (
            <span style={{ fontSize: 13, fontStyle: "italic", color: TM }}>Unassigned</span>
          )}
        </div>

        <div style={{ padding: "14px 16px" }}>
          {tx.exchangeDate ? (
            <span style={{ fontSize: 12, color: TS }}>{formatDate(tx.exchangeDate)}</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)" }}>Set exchange date</span>
          )}
        </div>

        <div style={{ padding: "14px 16px" }}>
          <StatusPill status={tx.status} />
        </div>

        <div style={{ padding: "14px 16px" }}>
          <RiskPill level={tx.risk} />
        </div>

        <div style={{ padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: lastActiveToneColor(tx.lastActive.tone) }}>
            {tx.lastActive.primary}
          </p>
          {tx.lastActive.secondary && (
            <p style={{ margin: "2px 0 0", fontSize: 10, color: TM }}>{tx.lastActive.secondary}</p>
          )}
          {tx.lastActive.stale && (
            // Voice fix: "Stale" → "Quiet" (Rule 2, same precedent as work-queue's FileAlertsStrip fix)
            <span style={{
              display: "inline-block", marginTop: 2,
              fontSize: 9, fontWeight: 600,
              padding: "1px 5px", borderRadius: 4,
              background: "#fef2f2", color: "#dc2626",
              border: "1px solid #fecaca", lineHeight: 1.2,
            }}>
              Quiet
            </span>
          )}
        </div>

        {showOwner && (
          <div style={{ padding: "14px 16px" }}>
            {tx.agentUser ? (
              <>
                <p style={{ margin: 0, fontSize: 13, color: TS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.agentUser.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: TM }}>{tx.agentUser.role}</p>
              </>
            ) : (
              <span style={{ fontSize: 13, color: TM }}>—</span>
            )}
          </div>
        )}
      </Link>

      {/* ── Mobile card row ──────────────────────────────────── */}
      <Link
        href="#"
        className="tl-mobile-row agent-hover-row"
        style={{
          display: "flex",
          textDecoration: "none",
          borderBottom: divider,
        }}
      >
        <div style={{ background: riskStripe, width: 4, alignSelf: "stretch", flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "14px 16px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TP }}>{tx.addressLine}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: TM }}>{tx.location}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: TM }}>Vendor: {tx.vendor} · Buyer: {tx.buyer}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <StatusPill status={tx.status} />
            <RiskPill level={tx.risk} />
            <span style={{ fontSize: 11, fontWeight: 500, color: lastActiveToneColor(tx.lastActive.tone) }}>
              Last: {tx.lastActive.primary}
            </span>
          </div>
          {tx.exchangeDate && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: TS }}>
              Exchange: {formatDate(tx.exchangeDate)}
            </p>
          )}
        </div>
      </Link>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function lastActiveToneColor(tone: MockRow["lastActive"]["tone"]) {
  return tone === "red" ? "var(--agent-danger)"
       : tone === "amber" ? "var(--agent-warning)"
       : tone === "muted" ? TM
       : TS;
}

/* ═══════════════════════════════════════════════════════════════════════════
   StatusPill + RiskPill — solid pale-tint StatusBadge pattern
   ═══════════════════════════════════════════════════════════════════════════ */

function StatusPill({ status }: { status: MockRow["status"] }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 99,
      fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

function RiskPill({ level }: { level: RiskLevel }) {
  const cfg = RISK_CFG[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 99,
      fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {RISK_LABEL[level]}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Empty states
   ═══════════════════════════════════════════════════════════════════════════ */

function ZeroFilesEmpty() {
  return (
    <div className="agent-glass-strong" style={{
      padding: "48px 24px", textAlign: "center",
      borderRadius: "var(--agent-radius-xl)",
    }}>
      <HouseLine weight="regular" size={32} style={{ color: TM, opacity: 0.45, margin: "0 auto 16px", display: "block" }} />
      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: TP }}>
        Create your first sale
      </p>
      <p style={{ margin: "0 auto 24px", fontSize: 13, color: TM, maxWidth: 340, lineHeight: 1.5 }}>
        {/* OLD: "Once you submit a sale, you'll see it here. Track milestones, manage chases, and progress to exchange." — Rule 1 system-narration */}
        Sales appear here once you submit one. Track milestones, manage chases, and progress to exchange.
      </p>
      <Link href="#" className="agent-btn agent-btn-primary agent-btn-md" style={{ textDecoration: "none" }}>
        <Plus size={16} weight="bold" />
        New sale
      </Link>
    </div>
  );
}

function ServerFilterEmpty() {
  // Demonstrates the EmptyState-wrapped-in-agent-glass-strong pattern
  return (
    <div className="agent-glass-strong" style={{
      padding: "40px 24px", textAlign: "center",
      borderRadius: "var(--agent-radius-xl)",
    }}>
      {/* Voice fix: "No on_hold files" → "No on-hold files" (schema underscore → hyphen) */}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TP }}>No on-hold files</p>
      <p style={{ margin: "4px auto 16px", fontSize: 13, color: TM, maxWidth: 320 }}>
        Try a different filter.
      </p>
      <Link href="#" className="agent-link" style={{ fontSize: 13 }}>
        View all
      </Link>
    </div>
  );
}

function ClientFilterEmpty({ hasSearch, query, onClear }: { hasSearch: boolean; query: string; onClear: () => void }) {
  return (
    <div className="agent-glass-strong" style={{
      padding: "32px 20px", textAlign: "center",
      borderRadius: "var(--agent-radius-xl)",
    }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: TM }}>
        {/* Voice fix: "No files match the active filters." → "No files match." */}
        {hasSearch ? `No files match "${query}"` : "No files match."}
      </p>
      <button onClick={onClear} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
        Clear filters
      </button>
    </div>
  );
}
