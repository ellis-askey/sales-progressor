"use client";

/* Transaction-list information-architecture exploration.
 *
 * Three functional variants of the table — each represents a different
 * hypothesis about WHAT the table is FOR:
 *   A — Director Scan       (workload + roll-call across the agency)
 *   B — Activity Forward    (which files are moving vs stalled)
 *   C — Exchange Roadmap    (forward time-to-exchange roadmap)
 *
 * All three are functional: status tabs filter, sort headers sort, filter
 * chips open dropdowns and filter, search narrows rows, role toggle hides
 * the Owner column for negotiators. Mobile card layout under each desktop
 * table. Reduced-motion toggle suppresses animations.
 *
 * Temporary preview — deleted once Ellis picks a winner. */

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { AGENT_THEMES, type AgentTheme } from "@/lib/agent/themes";

/* ─── Mock data ────────────────────────────────────────────────────────────── */

type Status = "active" | "on_hold" | "completed" | "withdrawn";
type Risk = "low" | "medium" | "high" | "no_data";
type Managed = "self_managed" | "outsourced";
type Stage = "pre_contract" | "searches" | "enquiries" | "awaiting_exchange" | "completed";

type Row = {
  id: string;
  addressLine: string;
  location: string;
  vendor: string;
  buyer: string;
  status: Status;
  risk: Risk;
  exchangeTarget: Date | null;
  lastActivityAt: Date;
  lastActivityVerb: string;
  assignedTo: string;
  owner: string;
  managedBy: Managed;
  stage: Stage;
  activeChase: string | null;
  progressPercent: number;
};

const NOW = new Date("2026-05-12T20:00:00Z");
const d = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * 86400000);

const MOCK_ROWS: Row[] = [
  { id: "r1",  addressLine: "14 Maple Drive",                location: "Bristol, BS1 4QR",       vendor: "Greene",     buyer: "Patel S.",      status: "active",    risk: "high",    exchangeTarget: d(5),    lastActivityAt: d(0),   lastActivityVerb: "Chase sent",          assignedTo: "Sarah Whitfield", owner: "Sarah Whitfield", managedBy: "self_managed", stage: "awaiting_exchange", activeChase: "Chase MOS",        progressPercent: 86 },
  { id: "r2",  addressLine: "Flat 7, The Heights",           location: "Manchester, M1 5AB",     vendor: "Khan",       buyer: "Olabode O.",    status: "active",    risk: "medium",  exchangeTarget: d(21),   lastActivityAt: d(-2),  lastActivityVerb: "Awaiting reply",      assignedTo: "Tom Harding",     owner: "Sarah Whitfield", managedBy: "self_managed", stage: "enquiries",         activeChase: "Awaiting reply",   progressPercent: 58 },
  { id: "r3",  addressLine: "22 Birchwood Lane",             location: "Tonbridge, TN9 2PE",     vendor: "Hassan",     buyer: "Foster",        status: "active",    risk: "low",     exchangeTarget: d(56),   lastActivityAt: d(-5),  lastActivityVerb: "MOS confirmed",       assignedTo: "Tom Harding",     owner: "Tom Harding",     managedBy: "outsourced",   stage: "searches",          activeChase: null,               progressPercent: 32 },
  { id: "r4",  addressLine: "7 Hawthorn Close",              location: "Sevenoaks, TN13 1AX",    vendor: "Wright",     buyer: "Singh A.",      status: "on_hold",   risk: "no_data", exchangeTarget: null,    lastActivityAt: d(-14), lastActivityVerb: "Put on hold",         assignedTo: "Sarah Whitfield", owner: "Sarah Whitfield", managedBy: "self_managed", stage: "pre_contract",      activeChase: null,               progressPercent: 12 },
  { id: "r5",  addressLine: "Flat 2A, Kingsway Mansions",    location: "Holborn, London WC2B",   vendor: "Pemberton",  buyer: "Liu",           status: "active",    risk: "high",    exchangeTarget: d(-3),   lastActivityAt: d(-1),  lastActivityVerb: "Chase solicitor",     assignedTo: "Jamie Owusu",     owner: "Sarah Whitfield", managedBy: "outsourced",   stage: "awaiting_exchange", activeChase: "Chase solicitor",  progressPercent: 92 },
  { id: "r6",  addressLine: "39a Darnley Road",              location: "Gravesend, DA11 OSD",    vendor: "Adeyemi",    buyer: "Marsh",         status: "active",    risk: "low",     exchangeTarget: d(84),   lastActivityAt: d(-7),  lastActivityVerb: "Search ordered",      assignedTo: "Jamie Owusu",     owner: "Jamie Owusu",     managedBy: "self_managed", stage: "searches",          activeChase: null,               progressPercent: 28 },
  { id: "r7",  addressLine: "Acer Cottage, The Manwarings",  location: "Horsmodnen, Kent TN12",  vendor: "Davies",     buyer: "Howe",          status: "active",    risk: "low",     exchangeTarget: d(28),   lastActivityAt: d(-8),  lastActivityVerb: "Survey scheduled",    assignedTo: "Rachel Whitfield",owner: "Rachel Whitfield",managedBy: "self_managed", stage: "enquiries",         activeChase: null,               progressPercent: 51 },
  { id: "r8",  addressLine: "31 Victoria Parade",            location: "Margate, Kent CT9 1RE",  vendor: "Harding",    buyer: "Pemberton",     status: "on_hold",   risk: "low",     exchangeTarget: d(105),  lastActivityAt: d(-14), lastActivityVerb: "Status changed",      assignedTo: "Tom Harding",     owner: "Tom Harding",     managedBy: "self_managed", stage: "pre_contract",      activeChase: null,               progressPercent: 8  },
  { id: "r9",  addressLine: "Studio 7, The Mill Conversion", location: "Canterbury, CT1 2AJ",    vendor: "Marsh",      buyer: "Adeyemi",       status: "active",    risk: "medium",  exchangeTarget: d(63),   lastActivityAt: d(-4),  lastActivityVerb: "Enquiries returned",  assignedTo: "Jamie Owusu",     owner: "Sarah Whitfield", managedBy: "outsourced",   stage: "enquiries",         activeChase: "Survey scheduled", progressPercent: 47 },
  { id: "r10", addressLine: "4 Compton Way",                 location: "Brighton, BN1 4FG",      vendor: "Kapoor",     buyer: "Sykes",         status: "completed", risk: "no_data", exchangeTarget: d(-30),  lastActivityAt: d(-30), lastActivityVerb: "Completed",           assignedTo: "Sarah Whitfield", owner: "Sarah Whitfield", managedBy: "self_managed", stage: "completed",         activeChase: null,               progressPercent: 100 },
  { id: "r11", addressLine: "12 Holland Road",               location: "Bath, BA1 2AA",          vendor: "Edwards",    buyer: "—",             status: "withdrawn", risk: "no_data", exchangeTarget: null,    lastActivityAt: d(-45), lastActivityVerb: "Withdrawn",           assignedTo: "Tom Harding",     owner: "Tom Harding",     managedBy: "self_managed", stage: "pre_contract",      activeChase: null,               progressPercent: 18 },
  { id: "r12", addressLine: "Flat 4, 18 Cavendish Road",     location: "Brixton, London SW9",    vendor: "Owusu",      buyer: "Sykes",         status: "active",    risk: "medium",  exchangeTarget: d(42),   lastActivityAt: d(-3),  lastActivityVerb: "Searches received",   assignedTo: "Rachel Whitfield",owner: "Sarah Whitfield", managedBy: "self_managed", stage: "searches",          activeChase: null,               progressPercent: 38 },
];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function fmtExchange(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}
function daysAway(date: Date | null): number | null {
  if (!date) return null;
  return Math.round((date.getTime() - NOW.getTime()) / 86400000);
}
function daysAwayLabel(n: number | null): string {
  if (n === null) return "";
  if (n < 0)  return `${Math.abs(n)}d overdue`;
  if (n === 0) return "Today";
  if (n <= 14) return `${n} days`;
  const weeks = Math.round(n / 7);
  return `${weeks} weeks`;
}
function relTime(date: Date): string {
  const days = Math.round((NOW.getTime() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
function activityState(date: Date): "moving" | "stalled" | "stale" {
  const days = Math.round((NOW.getTime() - date.getTime()) / 86400000);
  if (days < 7)  return "moving";
  if (days < 14) return "stalled";
  return "stale";
}

const STATUS_LABEL: Record<Status, string> = { active: "Active", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn" };
const RISK_LABEL: Record<Risk, string> = { low: "On track", medium: "Watch", high: "At risk", no_data: "No data" };
const STAGE_LABEL: Record<Stage, string> = {
  pre_contract: "Pre-contract", searches: "Searches", enquiries: "Enquiries",
  awaiting_exchange: "Awaiting exchange", completed: "Completed",
};
const STATUS_ORDER: Record<Status, number> = { active: 0, on_hold: 1, completed: 2, withdrawn: 3 };
const RISK_ORDER: Record<Risk, number> = { low: 0, medium: 1, high: 2, no_data: 3 };

/* ─── Shared UI ────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, React.CSSProperties> = {
    active:    { background: "rgba(16,185,129,0.12)",  color: "#047857", border: "1px solid rgba(16,185,129,0.25)" },
    on_hold:   { background: "rgba(245,158,11,0.14)",  color: "#b45309", border: "1px solid rgba(245,158,11,0.30)" },
    completed: { background: "rgba(99,102,241,0.10)",  color: "#4f46e5", border: "1px solid rgba(99,102,241,0.25)" },
    withdrawn: { background: "rgba(100,116,139,0.10)", color: "#475569", border: "1px solid rgba(100,116,139,0.25)" },
  };
  return (
    <span style={{
      ...styles[status], fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap",
    }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  const styles: Record<Risk, React.CSSProperties> = {
    low:     { background: "rgba(16,185,129,0.08)",  color: "#059669" },
    medium:  { background: "rgba(245,158,11,0.10)",  color: "#b45309" },
    high:    { background: "rgba(239,68,68,0.10)",   color: "#dc2626" },
    no_data: { background: "rgba(100,116,139,0.08)", color: "#64748b" },
  };
  const dot: Record<Risk, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444", no_data: "#94a3b8" };
  return (
    <span style={{
      ...styles[risk], display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot[risk] }} />
      {RISK_LABEL[risk]}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.split(" ").filter(Boolean);
  const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "??";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: "50%",
      background: "rgba(var(--agent-coral-rgb), 0.12)",
      color: "var(--agent-coral-deep)",
      fontSize: 9, fontWeight: 700, letterSpacing: "0.02em",
      flexShrink: 0,
    }}>
      {initials.toUpperCase()}
    </span>
  );
}

type SortDir = "asc" | "desc";
type SortState<K extends string> = { key: K; dir: SortDir };

function SortHeader<K extends string>({
  label, sortKey, sort, setSort, align = "left",
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  setSort: (s: SortState<K>) => void;
  align?: "left" | "right";
}) {
  const isActive = sort.key === sortKey;
  const arrow = !isActive ? "" : sort.dir === "asc" ? " ▴" : " ▾";
  return (
    <button
      onClick={() => setSort({ key: sortKey, dir: isActive && sort.dir === "asc" ? "desc" : "asc" })}
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        padding: "10px 8px",
        textAlign: align, width: "100%",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
        transition: "color 120ms",
        whiteSpace: "nowrap",
      }}
    >
      {label}{arrow}
    </button>
  );
}

/* Filter chip with dropdown — uses canonical .agent-segment-pill + .agent-dropdown-in */
function FilterChip({
  label, isActive, onClear, children,
}: {
  label: string;
  isActive: boolean;
  onClear?: () => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen((wasOpen) => {
      if (wasOpen) setClosing(true);
      return false;
    });
  }
  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      close();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function openDropdown() {
    if (open) { close(); return; }
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setClosing(false);
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative" style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={openDropdown}
        className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {label}
        {isActive && onClear && (
          <span
            role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); close(); }}
            className="agent-icon-btn agent-icon-btn-sm"
            aria-label={`Clear ${label}`}
            style={{ width: 14, height: 14, fontSize: 10, marginLeft: 2 }}
          >×</span>
        )}
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            minWidth: 180,
          }}
        >
          {children(close)}
        </div>,
        document.body
      )}
    </div>
  );
}

/* Status tabs above each variant. Single-select; counts by status. */
function StatusTabs({
  rows, current, onChange,
}: {
  rows: Row[];
  current: Status | "all";
  onChange: (v: Status | "all") => void;
}) {
  const counts = useMemo(() => {
    const c: Record<Status | "all", number> = { all: rows.length, active: 0, on_hold: 0, completed: 0, withdrawn: 0 };
    rows.forEach((r) => { c[r.status]++; });
    return c;
  }, [rows]);
  const tabs: { value: Status | "all"; label: string }[] = [
    { value: "all",        label: "All" },
    { value: "active",     label: "Active" },
    { value: "on_hold",    label: "On hold" },
    { value: "completed",  label: "Completed" },
    { value: "withdrawn",  label: "Withdrawn" },
  ];
  return (
    <div className="agent-tab-bar agent-tab-bar-static" style={{ display: "flex", flexWrap: "wrap", overflow: "visible" }}>
      {tabs.map((t) => {
        const isActive = current === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className="agent-tab"
            aria-selected={isActive || undefined}
          >
            {t.label}
            <span style={{
              fontSize: 10, fontWeight: 500,
              padding: "1px 7px", borderRadius: 99,
              background: isActive ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
              color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
            }}>{counts[t.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
      <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--agent-text-muted)" }}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by address…"
        className="agent-input agent-input-sm"
        style={{ width: "100%", paddingLeft: 30, fontSize: 13 }}
      />
    </div>
  );
}

function DropdownItem({ checked, label, onClick }: { checked?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="agent-dropdown-item"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: checked ? 600 : undefined }}
    >
      {label}
      {checked && <span style={{ color: "var(--agent-coral-deep)" }}>✓</span>}
    </button>
  );
}

function CheckboxItem({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="agent-dropdown-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        background: checked ? "var(--agent-coral-deep)" : "transparent",
        border: `1px solid ${checked ? "var(--agent-coral-deep)" : "rgba(0,0,0,0.20)"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{checked && <span style={{ color: "white", fontSize: 9 }}>✓</span>}</span>
      <span style={{ color: "var(--agent-text-secondary)" }}>{label}</span>
    </button>
  );
}

/* Row link handler (mocked navigation) */
function rowHref(r: Row): void {
  // eslint-disable-next-line no-console
  console.log(`[mock-nav] would navigate to /agent/transactions/${r.id} (${r.addressLine})`);
}

/* Common property cell — address as link, location + parties + chase as sub-lines */
function PropertyCell({ r, mobile = false }: { r: Row; mobile?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); rowHref(r); }}
        style={{
          fontSize: mobile ? 14 : 13, fontWeight: 600,
          color: "var(--agent-text-primary)",
          textDecoration: "none", display: "inline-block", maxWidth: "100%",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        className="ia-address-link"
      >
        {r.addressLine}
      </a>
      <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2 }}>{r.location}</div>
      <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        Vendor: {r.vendor} · Buyer: {r.buyer}
      </div>
      {r.activeChase && (
        <div style={{ marginTop: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#b45309",
            background: "rgba(245,158,11,0.12)", padding: "1px 6px", borderRadius: 4,
          }}>
            ⚠ {r.activeChase}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Variant A — Director Scan ───────────────────────────────────────────── */

function VariantA({ rows, role }: { rows: Row[]; role: "director" | "negotiator" }) {
  type SortKey = "property" | "assignedTo" | "owner" | "exchange" | "status" | "risk" | "activity";
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "exchange", dir: "asc" });
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<Set<Risk>>(new Set());
  const [managedFilter, setManagedFilter] = useState<Managed | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string | null>(null);

  const owners = useMemo(() => Array.from(new Set(rows.map((r) => r.owner))).sort(), [rows]);
  const assignees = useMemo(() => Array.from(new Set(rows.map((r) => r.assignedTo))).sort(), [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (search) result = result.filter((r) => r.addressLine.toLowerCase().includes(search.toLowerCase()));
    if (ownerFilter) result = result.filter((r) => r.owner === ownerFilter);
    if (riskFilter.size > 0) result = result.filter((r) => riskFilter.has(r.risk));
    if (managedFilter !== "all") result = result.filter((r) => r.managedBy === managedFilter);
    if (assignedFilter) result = result.filter((r) => r.assignedTo === assignedFilter);

    const sorted = [...result].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "property":    return a.addressLine.localeCompare(b.addressLine) * dir;
        case "assignedTo":  return a.assignedTo.localeCompare(b.assignedTo) * dir;
        case "owner":       return a.owner.localeCompare(b.owner) * dir;
        case "exchange": {
          const av = a.exchangeTarget?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bv = b.exchangeTarget?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return (av - bv) * dir;
        }
        case "status":      return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        case "risk":        return (RISK_ORDER[a.risk] - RISK_ORDER[b.risk]) * dir;
        case "activity":    return (a.lastActivityAt.getTime() - b.lastActivityAt.getTime()) * dir;
        default: return 0;
      }
    });
    return sorted;
  }, [rows, statusFilter, search, ownerFilter, riskFilter, managedFilter, assignedFilter, sort]);

  const anyChip = ownerFilter || riskFilter.size > 0 || managedFilter !== "all" || assignedFilter;

  function clearAll() {
    setOwnerFilter(null); setRiskFilter(new Set()); setManagedFilter("all"); setAssignedFilter(null);
    setSearch(""); setStatusFilter("all");
  }

  return (
    <section className="ia-variant">
      <div className="ia-variant-hdr">
        <h2>Variant A — Director Scan</h2>
        <p>Workload distribution + roll-call. Owner column is the differentiator: directors see who owns each file across the agency. Default sort is Exchange target ascending — closest exchange surfaces at the top.</p>
      </div>

      <StatusTabs rows={rows} current={statusFilter} onChange={setStatusFilter} />

      <div className="ia-bar">
        <SearchBox value={search} onChange={setSearch} />
        {role === "director" && (
          <FilterChip label={ownerFilter ? `Owner: ${ownerFilter.split(" ")[0]}` : "Owner"} isActive={!!ownerFilter} onClear={() => setOwnerFilter(null)}>
            {(close) => (
              <>
                <DropdownItem label="All owners" onClick={() => { setOwnerFilter(null); close(); }} />
                {owners.map((o) => <DropdownItem key={o} checked={ownerFilter === o} label={o} onClick={() => { setOwnerFilter(o); close(); }} />)}
              </>
            )}
          </FilterChip>
        )}
        <FilterChip label={riskFilter.size > 0 ? `Risk · ${riskFilter.size}` : "Risk"} isActive={riskFilter.size > 0} onClear={() => setRiskFilter(new Set())}>
          {() => (
            <>
              {(["low", "medium", "high", "no_data"] as Risk[]).map((r) => (
                <CheckboxItem key={r} checked={riskFilter.has(r)} label={RISK_LABEL[r]} onClick={() => {
                  setRiskFilter((prev) => { const next = new Set(prev); if (next.has(r)) next.delete(r); else next.add(r); return next; });
                }} />
              ))}
            </>
          )}
        </FilterChip>
        <FilterChip label={managedFilter === "all" ? "Managed by" : managedFilter === "self_managed" ? "Managed: You" : "Managed: Team"} isActive={managedFilter !== "all"} onClear={() => setManagedFilter("all")}>
          {(close) => (
            <>
              <DropdownItem checked={managedFilter === "all"} label="All" onClick={() => { setManagedFilter("all"); close(); }} />
              <DropdownItem checked={managedFilter === "self_managed"} label="You" onClick={() => { setManagedFilter("self_managed"); close(); }} />
              <DropdownItem checked={managedFilter === "outsourced"} label="Our team" onClick={() => { setManagedFilter("outsourced"); close(); }} />
            </>
          )}
        </FilterChip>
        <FilterChip label={assignedFilter ? `Assigned: ${assignedFilter.split(" ")[0]}` : "Assigned to"} isActive={!!assignedFilter} onClear={() => setAssignedFilter(null)}>
          {(close) => (
            <>
              <DropdownItem label="Anyone" onClick={() => { setAssignedFilter(null); close(); }} />
              {assignees.map((a) => <DropdownItem key={a} checked={assignedFilter === a} label={a} onClick={() => { setAssignedFilter(a); close(); }} />)}
            </>
          )}
        </FilterChip>
        {anyChip && <button onClick={clearAll} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear filters</button>}
        <span className="ia-bar-count">{filtered.length} {filtered.length === 1 ? "file" : "files"}</span>
      </div>

      <div className="ia-table-wrap">
        <table className="ia-table">
          <thead>
            <tr>
              <th style={{ width: "30%" }}><SortHeader label="Property" sortKey="property" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Assigned to" sortKey="assignedTo" sort={sort} setSort={setSort} /></th>
              {role === "director" && <th><SortHeader label="Owner" sortKey="owner" sort={sort} setSort={setSort} /></th>}
              <th><SortHeader label="Exchange target" sortKey="exchange" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Status" sortKey="status" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Risk" sortKey="risk" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Last activity" sortKey="activity" sort={sort} setSort={setSort} /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="agent-hover-row ia-row">
                <td><PropertyCell r={r} /></td>
                <td><span className="ia-name-cell"><Initials name={r.assignedTo} />{r.assignedTo.split(" ")[0]}</span></td>
                {role === "director" && <td><span className="ia-name-cell"><Initials name={r.owner} />{r.owner.split(" ")[0]}</span></td>}
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{fmtExchange(r.exchangeTarget)}</div>
                  <div style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{daysAwayLabel(daysAway(r.exchangeTarget))}</div>
                </td>
                <td><StatusBadge status={r.status} /></td>
                <td><RiskBadge risk={r.risk} /></td>
                <td><span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>{relTime(r.lastActivityAt)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileFrame title="Mobile (375px)">
        {filtered.map((r) => (
          <div key={r.id} className="ia-mobile-card">
            <PropertyCell r={r} mobile />
            <div className="ia-mobile-row"><span className="ia-mobile-k">Assigned</span><span className="ia-mobile-v"><Initials name={r.assignedTo} />{r.assignedTo.split(" ")[0]}</span></div>
            {role === "director" && <div className="ia-mobile-row"><span className="ia-mobile-k">Owner</span><span className="ia-mobile-v"><Initials name={r.owner} />{r.owner.split(" ")[0]}</span></div>}
            <div className="ia-mobile-row"><span className="ia-mobile-k">Exchange</span><span className="ia-mobile-v">{fmtExchange(r.exchangeTarget)} <span style={{ color: "var(--agent-text-muted)", fontSize: 10, marginLeft: 4 }}>{daysAwayLabel(daysAway(r.exchangeTarget))}</span></span></div>
            <div className="ia-mobile-row"><span className="ia-mobile-k">Last active</span><span className="ia-mobile-v">{relTime(r.lastActivityAt)}</span></div>
            <div className="ia-mobile-badges"><StatusBadge status={r.status} /><RiskBadge risk={r.risk} /></div>
          </div>
        ))}
      </MobileFrame>
    </section>
  );
}

/* ─── Variant B — Activity Forward ────────────────────────────────────────── */

function ActivityChip({ r }: { r: Row }) {
  const state = activityState(r.lastActivityAt);
  const styles: Record<"moving" | "stalled" | "stale", { bg: string; fg: string; dot: string }> = {
    moving:  { bg: "rgba(16,185,129,0.10)",  fg: "#059669", dot: "#10b981" },
    stalled: { bg: "rgba(245,158,11,0.10)",  fg: "#b45309", dot: "#f59e0b" },
    stale:   { bg: "rgba(239,68,68,0.10)",   fg: "#dc2626", dot: "#ef4444" },
  };
  const s = styles[state];
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  function show() {
    if (ref.current) {
      const r0 = ref.current.getBoundingClientRect();
      setPos({ top: r0.bottom + 4, left: r0.left });
    }
    setClosing(false);
    setOpen(true);
  }
  function hide() {
    setOpen((wasOpen) => { if (wasOpen) setClosing(true); return false; });
  }

  return (
    <>
      <button
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{
          background: s.bg, color: s.fg, border: "none",
          fontSize: 11, fontWeight: 600,
          padding: "3px 9px", borderRadius: 99,
          display: "inline-flex", alignItems: "center", gap: 6, cursor: "default",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
        {r.lastActivityVerb} · {relTime(r.lastActivityAt)}
      </button>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            padding: "10px 14px", minWidth: 240, maxWidth: 320,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)" }}>Recent activity</p>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            <li style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>{r.lastActivityVerb} <span style={{ color: "var(--agent-text-muted)" }}>· {relTime(r.lastActivityAt)}</span></li>
            <li style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>Mortgage offer received <span style={{ color: "var(--agent-text-muted)" }}>· 2 weeks ago</span></li>
            <li style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>Searches ordered <span style={{ color: "var(--agent-text-muted)" }}>· 3 weeks ago</span></li>
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}

function VariantB({ rows, role }: { rows: Row[]; role: "director" | "negotiator" }) {
  type SortKey = "property" | "assignedTo" | "owner" | "activity" | "exchange" | "status" | "risk";
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "activity", dir: "desc" });
  const [stalledFirst, setStalledFirst] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<Set<Risk>>(new Set());
  const [activityFilter, setActivityFilter] = useState<Set<"moving" | "stalled" | "stale">>(new Set());
  const owners = useMemo(() => Array.from(new Set(rows.map((r) => r.owner))).sort(), [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (search) result = result.filter((r) => r.addressLine.toLowerCase().includes(search.toLowerCase()));
    if (ownerFilter) result = result.filter((r) => r.owner === ownerFilter);
    if (riskFilter.size > 0) result = result.filter((r) => riskFilter.has(r.risk));
    if (activityFilter.size > 0) result = result.filter((r) => activityFilter.has(activityState(r.lastActivityAt)));

    let sorted: Row[];
    if (stalledFirst) {
      sorted = [...result].sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());
    } else {
      sorted = [...result].sort((a, b) => {
        const dir = sort.dir === "asc" ? 1 : -1;
        switch (sort.key) {
          case "property":   return a.addressLine.localeCompare(b.addressLine) * dir;
          case "assignedTo": return a.assignedTo.localeCompare(b.assignedTo) * dir;
          case "owner":      return a.owner.localeCompare(b.owner) * dir;
          case "activity":   return (a.lastActivityAt.getTime() - b.lastActivityAt.getTime()) * dir;
          case "exchange": {
            const av = a.exchangeTarget?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const bv = b.exchangeTarget?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return (av - bv) * dir;
          }
          case "status": return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
          case "risk":   return (RISK_ORDER[a.risk] - RISK_ORDER[b.risk]) * dir;
          default: return 0;
        }
      });
    }
    return sorted;
  }, [rows, statusFilter, search, ownerFilter, riskFilter, activityFilter, sort, stalledFirst]);

  const anyChip = ownerFilter || riskFilter.size > 0 || activityFilter.size > 0;
  function clearAll() {
    setOwnerFilter(null); setRiskFilter(new Set()); setActivityFilter(new Set());
    setSearch(""); setStatusFilter("all"); setStalledFirst(false);
  }

  return (
    <section className="ia-variant">
      <div className="ia-variant-hdr">
        <h2>Variant B — Activity Forward</h2>
        <p>What&apos;s moving vs what&apos;s stalled. Activity is the headline column: each row shows the latest verb + when. Hover the activity chip for a 3-entry log preview. Toggle &ldquo;Stalled first&rdquo; to surface files that need attention.</p>
      </div>

      <StatusTabs rows={rows} current={statusFilter} onChange={setStatusFilter} />

      <div className="ia-bar">
        <SearchBox value={search} onChange={setSearch} />
        <button
          onClick={() => setStalledFirst((v) => !v)}
          className={`agent-segment-pill agent-segment-pill-sm${stalledFirst ? " on" : ""}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Stalled first
        </button>
        {role === "director" && (
          <FilterChip label={ownerFilter ? `Owner: ${ownerFilter.split(" ")[0]}` : "Owner"} isActive={!!ownerFilter} onClear={() => setOwnerFilter(null)}>
            {(close) => (
              <>
                <DropdownItem label="All owners" onClick={() => { setOwnerFilter(null); close(); }} />
                {owners.map((o) => <DropdownItem key={o} checked={ownerFilter === o} label={o} onClick={() => { setOwnerFilter(o); close(); }} />)}
              </>
            )}
          </FilterChip>
        )}
        <FilterChip label={riskFilter.size > 0 ? `Risk · ${riskFilter.size}` : "Risk"} isActive={riskFilter.size > 0} onClear={() => setRiskFilter(new Set())}>
          {() => (
            <>
              {(["low", "medium", "high", "no_data"] as Risk[]).map((r) => (
                <CheckboxItem key={r} checked={riskFilter.has(r)} label={RISK_LABEL[r]} onClick={() => {
                  setRiskFilter((prev) => { const next = new Set(prev); if (next.has(r)) next.delete(r); else next.add(r); return next; });
                }} />
              ))}
            </>
          )}
        </FilterChip>
        <FilterChip label={activityFilter.size > 0 ? `Activity · ${activityFilter.size}` : "Activity"} isActive={activityFilter.size > 0} onClear={() => setActivityFilter(new Set())}>
          {() => (
            <>
              {(["moving", "stalled", "stale"] as const).map((a) => (
                <CheckboxItem key={a} checked={activityFilter.has(a)} label={a[0].toUpperCase() + a.slice(1)} onClick={() => {
                  setActivityFilter((prev) => { const next = new Set(prev); if (next.has(a)) next.delete(a); else next.add(a); return next; });
                }} />
              ))}
            </>
          )}
        </FilterChip>
        {anyChip && <button onClick={clearAll} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear filters</button>}
        <span className="ia-bar-count">{filtered.length} {filtered.length === 1 ? "file" : "files"}</span>
      </div>

      <div className="ia-table-wrap">
        <table className="ia-table">
          <thead>
            <tr>
              <th style={{ width: "26%" }}><SortHeader label="Property" sortKey="property" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Assigned to" sortKey="assignedTo" sort={sort} setSort={setSort} /></th>
              {role === "director" && <th><SortHeader label="Owner" sortKey="owner" sort={sort} setSort={setSort} /></th>}
              <th style={{ width: "22%" }}><SortHeader label="Last activity" sortKey="activity" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Exchange target" sortKey="exchange" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Status" sortKey="status" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Risk" sortKey="risk" sort={sort} setSort={setSort} /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="agent-hover-row ia-row">
                <td><PropertyCell r={r} /></td>
                <td><span className="ia-name-cell"><Initials name={r.assignedTo} />{r.assignedTo.split(" ")[0]}</span></td>
                {role === "director" && <td><span className="ia-name-cell"><Initials name={r.owner} />{r.owner.split(" ")[0]}</span></td>}
                <td><ActivityChip r={r} /></td>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{fmtExchange(r.exchangeTarget)}</div>
                  <div style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{daysAwayLabel(daysAway(r.exchangeTarget))}</div>
                </td>
                <td><StatusBadge status={r.status} /></td>
                <td><RiskBadge risk={r.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileFrame title="Mobile (375px)">
        {filtered.map((r) => (
          <div key={r.id} className="ia-mobile-card">
            <PropertyCell r={r} mobile />
            <div style={{ marginTop: 8 }}><ActivityChip r={r} /></div>
            <div className="ia-mobile-row"><span className="ia-mobile-k">Assigned</span><span className="ia-mobile-v"><Initials name={r.assignedTo} />{r.assignedTo.split(" ")[0]}</span></div>
            {role === "director" && <div className="ia-mobile-row"><span className="ia-mobile-k">Owner</span><span className="ia-mobile-v"><Initials name={r.owner} />{r.owner.split(" ")[0]}</span></div>}
            <div className="ia-mobile-row"><span className="ia-mobile-k">Exchange</span><span className="ia-mobile-v">{fmtExchange(r.exchangeTarget)} <span style={{ color: "var(--agent-text-muted)", fontSize: 10, marginLeft: 4 }}>{daysAwayLabel(daysAway(r.exchangeTarget))}</span></span></div>
            <div className="ia-mobile-badges"><StatusBadge status={r.status} /><RiskBadge risk={r.risk} /></div>
          </div>
        ))}
      </MobileFrame>
    </section>
  );
}

/* ─── Variant C — Exchange Roadmap ────────────────────────────────────────── */

function TimeToExchangeChip({ r }: { r: Row }) {
  const days = daysAway(r.exchangeTarget);
  if (days === null) {
    return <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>—</span>;
  }
  let bg = "rgba(99,102,241,0.10)", fg = "#4f46e5";  // far out (blue)
  if (days < 0)        { bg = "rgba(239,68,68,0.14)";  fg = "#dc2626"; }
  else if (days <= 7)  { bg = "rgba(239,68,68,0.10)";  fg = "#dc2626"; }
  else if (days <= 28) { bg = "rgba(245,158,11,0.12)"; fg = "#b45309"; }
  else if (days <= 56) { bg = "rgba(16,185,129,0.10)"; fg = "#059669"; }
  const label = days < 0 ? `${Math.abs(days)}d overdue` : daysAwayLabel(days);
  return (
    <span style={{
      background: bg, color: fg,
      fontSize: 14, fontWeight: 700,
      padding: "5px 12px", borderRadius: 8,
      display: "inline-block", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const styles: Record<Stage, React.CSSProperties> = {
    pre_contract:      { background: "rgba(100,116,139,0.10)", color: "#475569" },
    searches:          { background: "rgba(59,130,246,0.10)",  color: "#1d4ed8" },
    enquiries:         { background: "rgba(168,85,247,0.10)",  color: "#7e22ce" },
    awaiting_exchange: { background: "rgba(245,158,11,0.14)",  color: "#b45309" },
    completed:         { background: "rgba(16,185,129,0.10)",  color: "#059669" },
  };
  return (
    <span style={{
      ...styles[stage], fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap",
    }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function VariantC({ rows, role }: { rows: Row[]; role: "director" | "negotiator" }) {
  type SortKey = "property" | "assignedTo" | "owner" | "exchange" | "tte" | "stage" | "risk" | "status";
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "tte", dir: "asc" });
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<Set<Risk>>(new Set());
  const [stageFilter, setStageFilter] = useState<Set<Stage>>(new Set());
  const owners = useMemo(() => Array.from(new Set(rows.map((r) => r.owner))).sort(), [rows]);

  const STAGE_ORDER: Record<Stage, number> = {
    pre_contract: 0, searches: 1, enquiries: 2, awaiting_exchange: 3, completed: 4,
  };

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (search) result = result.filter((r) => r.addressLine.toLowerCase().includes(search.toLowerCase()));
    if (ownerFilter) result = result.filter((r) => r.owner === ownerFilter);
    if (riskFilter.size > 0) result = result.filter((r) => riskFilter.has(r.risk));
    if (stageFilter.size > 0) result = result.filter((r) => stageFilter.has(r.stage));

    const sorted = [...result].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "property":   return a.addressLine.localeCompare(b.addressLine) * dir;
        case "assignedTo": return a.assignedTo.localeCompare(b.assignedTo) * dir;
        case "owner":      return a.owner.localeCompare(b.owner) * dir;
        case "exchange":
        case "tte": {
          const av = a.exchangeTarget?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bv = b.exchangeTarget?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return (av - bv) * dir;
        }
        case "stage":  return (STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]) * dir;
        case "risk":   return (RISK_ORDER[a.risk] - RISK_ORDER[b.risk]) * dir;
        case "status": return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        default: return 0;
      }
    });
    return sorted;
  }, [rows, statusFilter, search, ownerFilter, riskFilter, stageFilter, sort]);

  const anyChip = ownerFilter || riskFilter.size > 0 || stageFilter.size > 0;
  function clearAll() {
    setOwnerFilter(null); setRiskFilter(new Set()); setStageFilter(new Set());
    setSearch(""); setStatusFilter("all");
  }

  return (
    <section className="ia-variant">
      <div className="ia-variant-hdr">
        <h2>Variant C — Exchange Roadmap</h2>
        <p>Forward-looking time-to-exchange roadmap. The big &ldquo;Time to exchange&rdquo; chip dominates the row (color-coded by urgency), and a Stage column tells the agent which conveyancing phase each file sits in. Status moves to a small badge — Risk is the dominant alert signal.</p>
      </div>

      <StatusTabs rows={rows} current={statusFilter} onChange={setStatusFilter} />

      <div className="ia-bar">
        <SearchBox value={search} onChange={setSearch} />
        {role === "director" && (
          <FilterChip label={ownerFilter ? `Owner: ${ownerFilter.split(" ")[0]}` : "Owner"} isActive={!!ownerFilter} onClear={() => setOwnerFilter(null)}>
            {(close) => (
              <>
                <DropdownItem label="All owners" onClick={() => { setOwnerFilter(null); close(); }} />
                {owners.map((o) => <DropdownItem key={o} checked={ownerFilter === o} label={o} onClick={() => { setOwnerFilter(o); close(); }} />)}
              </>
            )}
          </FilterChip>
        )}
        <FilterChip label={stageFilter.size > 0 ? `Stage · ${stageFilter.size}` : "Stage"} isActive={stageFilter.size > 0} onClear={() => setStageFilter(new Set())}>
          {() => (
            <>
              {(["pre_contract", "searches", "enquiries", "awaiting_exchange", "completed"] as Stage[]).map((s) => (
                <CheckboxItem key={s} checked={stageFilter.has(s)} label={STAGE_LABEL[s]} onClick={() => {
                  setStageFilter((prev) => { const next = new Set(prev); if (next.has(s)) next.delete(s); else next.add(s); return next; });
                }} />
              ))}
            </>
          )}
        </FilterChip>
        <FilterChip label={riskFilter.size > 0 ? `Risk · ${riskFilter.size}` : "Risk"} isActive={riskFilter.size > 0} onClear={() => setRiskFilter(new Set())}>
          {() => (
            <>
              {(["low", "medium", "high", "no_data"] as Risk[]).map((r) => (
                <CheckboxItem key={r} checked={riskFilter.has(r)} label={RISK_LABEL[r]} onClick={() => {
                  setRiskFilter((prev) => { const next = new Set(prev); if (next.has(r)) next.delete(r); else next.add(r); return next; });
                }} />
              ))}
            </>
          )}
        </FilterChip>
        {anyChip && <button onClick={clearAll} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear filters</button>}
        <span className="ia-bar-count">{filtered.length} {filtered.length === 1 ? "file" : "files"}</span>
      </div>

      <div className="ia-table-wrap">
        <table className="ia-table">
          <thead>
            <tr>
              <th style={{ width: "26%" }}><SortHeader label="Property" sortKey="property" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Assigned to" sortKey="assignedTo" sort={sort} setSort={setSort} /></th>
              {role === "director" && <th><SortHeader label="Owner" sortKey="owner" sort={sort} setSort={setSort} /></th>}
              <th><SortHeader label="Exchange target" sortKey="exchange" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Time to exchange" sortKey="tte" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Stage" sortKey="stage" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Risk" sortKey="risk" sort={sort} setSort={setSort} /></th>
              <th><SortHeader label="Status" sortKey="status" sort={sort} setSort={setSort} /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="agent-hover-row ia-row">
                <td><PropertyCell r={r} /></td>
                <td><span className="ia-name-cell"><Initials name={r.assignedTo} />{r.assignedTo.split(" ")[0]}</span></td>
                {role === "director" && <td><span className="ia-name-cell"><Initials name={r.owner} />{r.owner.split(" ")[0]}</span></td>}
                <td><span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>{fmtExchange(r.exchangeTarget)}</span></td>
                <td><TimeToExchangeChip r={r} /></td>
                <td><StageBadge stage={r.stage} /></td>
                <td><RiskBadge risk={r.risk} /></td>
                <td><span style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileFrame title="Mobile (375px)">
        {filtered.map((r) => (
          <div key={r.id} className="ia-mobile-card">
            <PropertyCell r={r} mobile />
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <TimeToExchangeChip r={r} />
              <StageBadge stage={r.stage} />
            </div>
            <div className="ia-mobile-row"><span className="ia-mobile-k">Assigned</span><span className="ia-mobile-v"><Initials name={r.assignedTo} />{r.assignedTo.split(" ")[0]}</span></div>
            {role === "director" && <div className="ia-mobile-row"><span className="ia-mobile-k">Owner</span><span className="ia-mobile-v"><Initials name={r.owner} />{r.owner.split(" ")[0]}</span></div>}
            <div className="ia-mobile-row"><span className="ia-mobile-k">Target</span><span className="ia-mobile-v">{fmtExchange(r.exchangeTarget)}</span></div>
            <div className="ia-mobile-badges"><RiskBadge risk={r.risk} /><StatusBadge status={r.status} /></div>
          </div>
        ))}
      </MobileFrame>
    </section>
  );
}

/* ─── Mobile frame wrapper ─────────────────────────────────────────────────── */

function MobileFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ia-mobile-frame-wrap">
      <p className="ia-mobile-frame-label">{title}</p>
      <div className="ia-mobile-frame">
        <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Scoped CSS ────────────────────────────────────────────────────────────── */

const STYLES = `
[data-rm="1"] *,
[data-rm="1"] *::before,
[data-rm="1"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}

.ia-page {
  padding: 28px 28px 80px;
  min-height: 100vh;
  font-family: inherit;
}

/* Sticky chrome */
.ia-chrome {
  position: sticky; top: 0; z-index: 20;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(14px);
  border-bottom: 0.5px solid var(--agent-border-default);
  margin: -28px -28px 24px;
  padding: 12px 28px;
}
.ia-h1 { font-size: 18px; font-weight: 700; color: var(--agent-text-primary); margin: 0 0 10px; }
.ia-controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 11px; color: var(--agent-text-muted); }
.ia-controls-group { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ia-controls-label { font-family: monospace; margin-right: 4px; }
.ia-chip {
  padding: 3px 10px; border-radius: 99px;
  border: 1px solid rgba(30,45,74,0.18);
  background: rgba(255,255,255,0.55);
  color: var(--agent-text-secondary);
  font-size: 11px; font-weight: 500; cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.ia-chip:hover { border-color: rgba(30,45,74,0.32); }
.ia-chip.on { background: var(--agent-coral-deep); color: white; border-color: var(--agent-coral-deep); }

/* Variant section */
.ia-variant { margin-bottom: 64px; }
.ia-variant-hdr { margin-bottom: 14px; max-width: 880px; }
.ia-variant-hdr h2 { font-size: 18px; font-weight: 700; color: var(--agent-text-primary); margin: 0 0 4px; }
.ia-variant-hdr p { font-size: 13px; color: var(--agent-text-secondary); margin: 0; line-height: 1.5; }

/* Bar (search + chips above table) */
.ia-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 12px 0;
  padding: 10px 12px;
  background: rgba(255,255,255,0.55);
  border: 0.5px solid var(--agent-border-default);
  border-radius: 12px;
}
.ia-bar-count {
  margin-left: auto; font-size: 11px;
  color: var(--agent-text-muted);
  font-variant-numeric: tabular-nums;
}

/* Table */
.ia-table-wrap {
  border: 0.5px solid var(--agent-border-default);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,0.62);
}
.ia-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}
.ia-table thead th {
  background: rgba(0,0,0,0.025);
  border-bottom: 0.5px solid var(--agent-border-default);
  padding: 0;
}
.ia-table thead th button { color: inherit; }
.ia-table tbody td {
  padding: 12px 10px;
  border-bottom: 0.5px solid rgba(0,0,0,0.04);
  vertical-align: top;
  font-size: 12px;
  color: var(--agent-text-secondary);
}
.ia-table tbody tr:last-child td { border-bottom: none; }
.ia-row { transition: background 120ms; }
.ia-address-link:hover { color: var(--agent-coral-deep); text-decoration: underline; text-underline-offset: 2px; }

.ia-name-cell {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--agent-text-primary); font-weight: 500;
  white-space: nowrap;
}

/* Mobile frame */
.ia-mobile-frame-wrap { margin-top: 18px; }
.ia-mobile-frame-label {
  font-size: 10px; font-weight: 700; color: var(--agent-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin: 0 0 8px;
}
.ia-mobile-frame {
  width: 375px;
  max-width: 100%;
  border: 0.5px solid var(--agent-border-default);
  border-radius: 18px;
  background: rgba(255,255,255,0.62);
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
}
.ia-mobile-card {
  border: 0.5px solid var(--agent-border-default);
  border-radius: 10px;
  background: rgba(255,255,255,0.85);
  padding: 12px;
}
.ia-mobile-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px;
  margin-top: 6px;
}
.ia-mobile-k { color: var(--agent-text-muted); font-size: 11px; }
.ia-mobile-v { color: var(--agent-text-primary); display: inline-flex; align-items: center; gap: 6px; }
.ia-mobile-badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
`;

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function TableIaPolishPage() {
  const [theme, setTheme] = useState<AgentTheme>("sunset");
  const [role, setRole] = useState<"director" | "negotiator">("director");
  const [rm, setRm] = useState(false);

  return (
    <div data-theme={theme} data-rm={rm ? "1" : undefined} className="agent-bg ia-page">
      <style>{STYLES}</style>

      <div className="ia-chrome">
        <h1 className="ia-h1">Transaction-list IA exploration — /agent/polish/transaction-table-ia</h1>
        <div className="ia-controls">
          <div className="ia-controls-group">
            <span className="ia-controls-label">Theme:</span>
            {AGENT_THEMES.map((t) => (
              <button key={t} className={`ia-chip${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>{t}</button>
            ))}
          </div>
          <div className="ia-controls-group">
            <span className="ia-controls-label">Role:</span>
            <button className={`ia-chip${role === "director" ? " on" : ""}`} onClick={() => setRole("director")}>Director</button>
            <button className={`ia-chip${role === "negotiator" ? " on" : ""}`} onClick={() => setRole("negotiator")}>Negotiator</button>
          </div>
          <div className="ia-controls-group">
            <span className="ia-controls-label">Motion:</span>
            <button className={`ia-chip${rm ? " on" : ""}`} onClick={() => setRm((v) => !v)}>{rm ? "Reduced" : "Normal"}</button>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--agent-text-muted)", maxWidth: 820, lineHeight: 1.5 }}>
          Three functional variants — sort headers, filter chips, search, and status tabs all wired. Toggle the role to see the
          Owner column appear / disappear. Mobile preview at 375px under each variant. All animations use canonical primitives
          from <code>agent-system.css</code>.
        </p>
      </div>

      <VariantA rows={MOCK_ROWS} role={role} />
      <VariantB rows={MOCK_ROWS} role={role} />
      <VariantC rows={MOCK_ROWS} role={role} />
    </div>
  );
}
