"use client";

// REMINDERS (/agent/work-queue) — canonical-alignment comparison workspace.
//
// Left = CURRENT, reproduced byte-for-byte from the real source (components/
// reminders/*.tsx + app/agent/work-queue/page.tsx) using the SAME agent-system
// classes the production page uses, so it renders authentically under the agent
// shell. Right = PROPOSED canonical alignment (real approved canonicals where
// one fits, or an isolated "PROPOSED NEW CANONICAL — NOT APPROVED" proposal).
//
// Shim-coupled components (ChaseSplitButton, status-pills, AutoChaseCountdown
// import the untracked @/components/icons shim) are REPRODUCED here, not
// imported, so this committed dev file never pulls the shim into the build.
// Safe real canonicals ARE imported live: arc SegmentedControl, Pill,
// PropertyThumb, arc Button/buttonClasses.
//
// Dev-only, read-only. No production file or canonical is modified. Every
// control is inert or local-state only — nothing triggers a real action.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CaretDown, CheckCircle, CalendarBlank, Bell, Clock, Warning,
  House, User, MagnifyingGlass, ArrowClockwise,
} from "@phosphor-icons/react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { buttonClasses } from "@/components/arc/button/button";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { AnimatedClock } from "@/components/ui/AnimatedClock";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
const LBLSTYLE: CSSProperties = { display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--compare-muted)", fontWeight: 600, marginBottom: 6 };
type Theme = "light" | "dark";
type Width = "desktop" | "tablet" | "mobile";
const WIDTHS: Record<Width, number> = { desktop: 1180, tablet: 768, mobile: 375 };

type Cls = "A" | "B" | "C" | "D";
const CLS: Record<Cls, { label: string; fg: string; bg: string; bd: string }> = {
  A: { label: "A · Compliant canonical", fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" },
  B: { label: "B · Alignment candidate", fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  C: { label: "C · Proposed NEW — not approved", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
  D: { label: "D · Intentional exception", fg: "#6d28d9", bg: "rgba(109,40,217,0.11)", bd: "rgba(109,40,217,0.28)" },
};
function Tag({ k }: { k: Cls }) {
  const t = CLS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}

function Pane({ kind, children }: { kind: "current" | "proposed" | "new" | "exception"; children: ReactNode }) {
  const map = {
    current: { label: "Current — shipped (byte-for-byte)", bd: "var(--compare-line)", col: "var(--compare-muted)" },
    proposed: { label: "Proposed — canonical", bd: CORAL, col: CORAL },
    new: { label: "Proposed NEW canonical — NOT approved", bd: "#b91c1c", col: "#b91c1c" },
    exception: { label: "Intentional exception — keep", bd: "#6d28d9", col: "#6d28d9" },
  }[kind];
  return (
    <div style={{ flex: "1 1 340px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: map.col, marginBottom: 8 }}>{map.label}</span>
      <div style={{ borderRadius: 16, padding: 18, background: "var(--compare-pane)", border: `1.5px solid ${map.bd}`, minHeight: 56 }}>{children}</div>
    </div>
  );
}

function Block({ n, title, cls, note, left, right, leftKind = "current", rightKind = "proposed" }: {
  n: string; title: string; cls: Cls; note: ReactNode; left: ReactNode; right?: ReactNode;
  leftKind?: "current" | "exception"; rightKind?: "proposed" | "new";
}) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag k={cls} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 900 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane kind={leftKind}>{left}</Pane>
        {right !== undefined && <Pane kind={rightKind}>{right}</Pane>}
      </div>
    </section>
  );
}

/* ======================================================================== */
/* Faithful reproductions of the CURRENT reminders pieces (real classes).   */
/* ======================================================================== */

// Reminder status pill — the REAL canonical: composes components/ui/Pill, exactly
// as StatusPill.tsx does. (Imported Pill; RoleIcon swapped for a phosphor glyph
// as RoleIcon is shim-coupled.)
function DemoUrgencyPill({ bucket, label }: { bucket: "escalated" | "overdue" | "due_today" | "upcoming"; label: string }) {
  const tone = bucket === "escalated" || bucket === "overdue" ? "danger" : bucket === "due_today" ? "warning" : "muted";
  const icon = bucket === "escalated" ? <Warning size={11} weight="fill" /> : bucket === "upcoming" ? <CalendarBlank size={11} weight="bold" /> : <Clock size={11} weight="bold" />;
  return <Pill tone={tone as "danger"} size="sm" glass><span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span><span>{label}</span></Pill>;
}
function DemoSidePill({ isBuyer }: { isBuyer: boolean }) {
  return <Pill tone={isBuyer ? "info" : "warning"} size="sm" glass><span style={{ display: "inline-flex", flexShrink: 0 }}>{isBuyer ? <User size={11} weight="fill" /> : <House size={11} weight="fill" />}</span><span>{isBuyer ? "Buyer" : "Seller"}</span></Pill>;
}

// CURRENT side filter — agent-segment-pill group (the real classes).
function CurrentSideFilter() {
  const [v, setV] = useState("all");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {["all", "seller", "buyer"].map((k) => (
        <button key={k} className={`agent-segment-pill agent-segment-pill-sm${v === k ? " on" : ""}`} onClick={() => setV(k)}>
          {k === "all" ? "All" : k === "seller" ? "Seller" : "Buyer"}
        </button>
      ))}
    </div>
  );
}
// PROPOSED side filter — the real arc SegmentedControl (as ViewModeToggle already uses).
function ProposedSideFilter() {
  const [v, setV] = useState("all");
  const tokens: CSSProperties = {
    ["--surface-muted" as string]: "rgba(15,23,42,0.05)", ["--border" as string]: "var(--agent-border-default)",
    ["--text-muted" as string]: "var(--agent-text-secondary)", ["--foreground" as string]: "var(--agent-text-primary)",
    ["--radius-control" as string]: "11px", ["--control-height-sm" as string]: "28px", ["--text-sm" as string]: "13px",
    ["--sc-selection-bg" as string]: "var(--agent-coral-deep)", ["--sc-selection-fg" as string]: "var(--agent-text-on-coral)",
    ["--sc-selection-border" as string]: "transparent", ["--shadow-resting" as string]: "0 2px 6px rgba(255,107,74,0.30)",
  };
  return (
    <div className="arc-scope" style={{ ...tokens, display: "inline-block" }}>
      <SegmentedControl label="Side" value={v} onValueChange={setV} options={[{ value: "all", label: "All" }, { value: "seller", label: "Seller" }, { value: "buyer", label: "Buyer" }]} />
    </div>
  );
}

// CURRENT Chase split-button — reproduced rem-chase markup (real classes).
function CurrentChaseSplit() {
  return (
    <span className="rem-chase">
      <button type="button" className="rem-chase-go">Chase</button>
      <button type="button" className="rem-chase-caret" aria-label="More chase actions"><CaretDown size={12} weight="bold" /></button>
    </span>
  );
}
// PROPOSED Chase split-button — the canonical split-button family (hub-split-button):
// buttonClasses outline, joined radii, caret opens the canonical RowActionMenu/Popover.
function ProposedChaseSplit() {
  return (
    <div style={{ display: "inline-flex" }}>
      <button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: CORAL, ["--background" as string]: "#fff", borderTopRightRadius: 0, borderBottomRightRadius: 0 } as CSSProperties}>Chase</button>
      <button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: CORAL, ["--background" as string]: "#fff", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: "0 7px" } as CSSProperties} aria-label="More"><CaretDown size={12} weight="bold" /></button>
    </div>
  );
}

// The needs-you reminder row — faithful reproduction (one real row of markup).
function CurrentReminderRow({ chaseSlot }: { chaseSlot: ReactNode }) {
  return (
    <div className="rem-row-needs" style={{ padding: "10px 12px", display: "flex", alignItems: "stretch", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 660, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>Searches ordered by Bude Nathan Iwanier LLP</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>Chasing <b style={{ fontWeight: 600, color: "var(--agent-text-secondary)" }}>Bude Nathan Iwanier LLP</b></p>
        <p style={{ margin: "7px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)", borderRadius: 8, padding: "6px 10px", boxShadow: "0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.05)" }}>
          Bude Nathan Iwanier LLP need to order the property searches so this part of the legal work can move forward without delay.
        </p>
        <p style={{ margin: "7px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted)" }}>↻ Chased 6 times · No reply yet</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-danger)" }}>⚑ Auto-escalated, no response after repeated chases</p>
      </div>
      <div className="rem-row-side" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 10, borderLeft: "0.5px solid var(--agent-border-subtle)", paddingLeft: 14, marginLeft: 4 }}>
        <div className="rem-row-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CurrentSnoozeTrigger />
          {chaseSlot}
        </div>
        <div className="rem-row-date" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Was due</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            <CalendarBlank size={13} weight="regular" aria-hidden /> 19 Nov 2026
          </span>
        </div>
      </div>
    </div>
  );
}

// Snooze trigger — reproduced rem-clock-btn (the real clock button).
function CurrentSnoozeTrigger() {
  return (
    <button type="button" className="rem-clock-btn" title="Snooze" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" /><line x1="12" y1="12" x2="15" y2="12" /><g className="rem-clock-hand"><line x1="12" y1="12" x2="12" y2="6.5" /></g>
      </svg>
    </button>
  );
}

// The green auto-chase countdown strip (faithful reproduction).
function CurrentCountdown() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 9, background: "var(--agent-success-bg)", border: "0.5px solid var(--agent-success-border-strong)", fontSize: 11.5, color: "var(--agent-text-secondary)" }}>
      <Clock size={12} weight="bold" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
      <span style={{ fontVariantNumeric: "tabular-nums" }}><span style={{ fontWeight: 500 }}>Auto-chase</span> tomorrow at 9:30am · 32h 08m 39s</span>
      <button type="button" style={{ marginLeft: "auto", flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 11.5, fontWeight: 700, color: "var(--agent-success)" }}>View</button>
    </div>
  );
}

// Section bar — reproduced agent-wq-secbar + agent-stat-glass count pill.
function CurrentSectionBar({ tone, count, label, sub }: { tone: "danger" | "warning" | "muted"; count: number; label: string; sub: string }) {
  return (
    <div className={`agent-wq-secbar ${tone === "muted" ? "agent-wq-secbar--auto" : "agent-wq-secbar--you"} flex items-center justify-between px-3 py-2 rounded-xl`} style={{ cursor: "pointer" }}>
      <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
        <span className={`agent-stat-glass agent-stat-glass--${tone}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          <span className="agent-stat-dot" aria-hidden />{count} {label.toLowerCase()}
        </span>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</span>
      </div>
      <CaretDown size={12} weight="bold" aria-hidden style={{ flexShrink: 0, color: "var(--agent-text-muted)", transform: "rotate(180deg)" }} />
    </div>
  );
}

// A full file card (header + one needs-you row) — faithful.
function CurrentFileCard({ children }: { children: ReactNode }) {
  return (
    <div className="agent-glass-strong" style={{ borderRadius: 20, overflow: "hidden" }}>
      <div className="agent-card-hdr" style={{ background: "var(--agent-card-header-veil)", padding: "10px 16px", borderRadius: "16px 20px 0 0", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(45,24,16,0.05)", color: "var(--agent-text-muted)" }}><House size={20} weight="fill" /></span>
        <div style={{ minWidth: 0 }}>
          <span className="rem-addr" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--agent-text-primary)" }}>132 St. Julians Farm Road</span>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>London, SE27 0RR</p>
        </div>
        <span aria-hidden style={{ marginLeft: "auto", color: "var(--agent-text-muted)", display: "flex", transform: "rotate(180deg)" }}><CaretDown size={15} weight="bold" /></span>
      </div>
      <div style={{ padding: "6px 0" }}>{children}</div>
    </div>
  );
}

/* ======================================================================== */

const INVENTORY: { item: string; src: string; cls: Cls; verdict: string }[] = [
  { item: "PageHeader (title + subtitle)", src: "layout/PageHeader", cls: "A", verdict: "Shared page-header primitive — compliant" },
  { item: "Sticky filter bar shell", src: "AgentRemindersList · GlassCard reminders-filter-bar", cls: "A", verdict: "Canonical GlassCard (baked v06)" },
  { item: "Search input", src: "agent-input agent-input-sm", cls: "A", verdict: "Canonical agent-input field" },
  { item: "Side filter (All/Seller/Buyer)", src: "agent-segment-pill", cls: "B", verdict: "APPROVED → arc SegmentedControl (hub ViewModeToggle already did)" },
  { item: "‘Snoozed (3)’ forward toggle", src: "agent-link agent-link-muted", cls: "B", verdict: "Compliant, but make the forward toggle coral .agent-link (keep back-links muted)" },
  { item: "‘← Active’ / ‘← Back’ back-links", src: "agent-link agent-link-muted", cls: "A", verdict: "Muted is the canonical back-link convention — keep" },
  { item: "Section group bar", src: "agent-wq-secbar", cls: "A", verdict: "Bespoke section chrome — compliant, shared across groups" },
  { item: "Section count pill (live dot)", src: "agent-stat-glass + agent-stat-dot", cls: "C", verdict: "REGISTER CURRENT as canonical CountPill — a live count badge, keep as-is" },
  { item: "File card shell", src: "GlassCard reminders-file-card + agent-card-hdr", cls: "B", verdict: "Align to the hub collapsible card-shell family (HubCard)" },
  { item: "PropertyThumb", src: "ui/PropertyThumb", cls: "A", verdict: "Canonical" },
  { item: "Address link + LinkArrow (rem-addr)", src: "AgentRemindersList", cls: "A", verdict: "Canonical agent-link + LinkArrow" },
  { item: "Needs-you reminder row", src: "AgentRemindersList (inline)", cls: "C", verdict: "Register the row composition as a canonical ReminderRow" },
  { item: "Explanation box", src: "surface-glass rounded + shadow", cls: "A", verdict: "Reused shared treatment — compliant" },
  { item: "Chase split-button", src: "ChaseSplitButton (rem-chase)", cls: "B", verdict: "APPROVED → canonical split-button (hub-split-button family)" },
  { item: "Snooze menu (popover)", src: "SnoozeMenu", cls: "A", verdict: "Composes canonical Popover + arc Button + DateField + segment pills" },
  { item: "Snooze trigger (clock)", src: "SnoozeMenu → arc Button + rem-clock-btn", cls: "A", verdict: "ALREADY the arc secondary Button; rem-clock-btn only adds the icon animation — compliant" },
  { item: "Snooze quick-gap pills", src: "agent-segment-pill-sm", cls: "B", verdict: "Same family as the side filter → arc SegmentedControl is not a fit (free-wrap pills); keep or register as PillGroup" },
  { item: "Auto-chase countdown strip", src: "AutoChaseCountdown", cls: "C", verdict: "APPROVED → register as a canonical CountdownStrip" },
  { item: "Wake all / Chased buttons", src: "agent-btn-ghost-bordered", cls: "B", verdict: "APPROVED → arc Button outline" },
  { item: "Wake now / Done buttons", src: "arc Button", cls: "A", verdict: "Canonical arc Button" },
  { item: "FallbackPill (no-contact edge case)", src: "status-pills → StatusPill → Pill", cls: "A", verdict: "The ONLY pill rendered on this page — already composes canonical Pill" },
  { item: "Escalation line (⚑)", src: "AgentRemindersList", cls: "A", verdict: "Canonical semantic token (--agent-danger) — register as canonical semantic usage, keep colour" },
  { item: "Urgency semantic colours", src: "GROUP_CONFIG / stat-glass tones", cls: "A", verdict: "Canonical semantic tokens (danger/warning/muted) — keep; do not flatten to coral" },
  { item: "File-level footer (auto-chase off)", src: "AgentRemindersList", cls: "A", verdict: "Plain coral info line — compliant" },
  { item: "Inline empty (Bell + ghost skeleton)", src: "work-queue/page.tsx + Skeleton", cls: "A", verdict: "Canonical Skeleton (shimmer off) + empty-card" },
  { item: "‘All caught up’ empty", src: "AgentRemindersList", cls: "A", verdict: "Canonical success empty-card" },
  { item: "Filtered empty text cards", src: "AgentRemindersList", cls: "A", verdict: "Canonical empty-card" },
  { item: "RemindersEmptyState hero", src: "agent/RemindersEmptyState", cls: "A", verdict: "Canonical empty-hero composition" },
  { item: "loading.tsx skeleton", src: "work-queue/loading.tsx", cls: "A", verdict: "Canonical Skeleton" },
];

export default function RemindersComparePage() {
  const restore = useRef<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [width, setWidth] = useState<Width>("desktop");
  // Light maps to the app's real default light theme "sunset" (there is no
  // [data-theme="light"]) so the full --agent-* token set is defined.
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme === "light" ? "sunset" : "dark"); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars: CSSProperties = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  };
  const tog = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });

  const counts = INVENTORY.reduce((a, r) => { a[r.cls] = (a[r.cls] ?? 0) + 1; return a; }, {} as Record<Cls, number>);

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme === "light" ? "sunset" : "dark"} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["desktop", "tablet", "mobile"] as Width[]).map((w) => (
            <button key={w} type="button" style={tog(width === w)} onClick={() => setWidth(w)}>{w[0].toUpperCase() + w.slice(1)}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Compare · Reminders (/agent/work-queue)</span>
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>Reminders — canonical alignment</h1>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 920 }}>
          Every in-scope component of the Reminders page (drawers/modals excluded, per their own later pass). Left is the real shipped implementation; right is the proposed canonical alignment. Nothing here is applied — this is for your visual review.
        </p>

        {/* Inventory */}
        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "12px 16px", background: "var(--compare-pane)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>Inventory — {INVENTORY.length} components reviewed</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}>
              <b style={{ color: CLS.A.fg }}>{counts.A ?? 0} compliant</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} new (unapproved)</b> · <b style={{ color: CLS.D.fg }}>{counts.D ?? 0} exceptions</b>
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--compare-muted)" }}>
                  <th style={{ padding: "8px 16px", fontWeight: 600 }}>Component</th>
                  <th style={{ padding: "8px 16px", fontWeight: 600 }}>Source</th>
                  <th style={{ padding: "8px 16px", fontWeight: 600 }}>Class</th>
                  <th style={{ padding: "8px 16px", fontWeight: 600 }}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {INVENTORY.map((r) => (
                  <tr key={r.item} style={{ borderTop: "1px solid var(--compare-line)" }}>
                    <td style={{ padding: "8px 16px", color: "var(--compare-ink)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.item}</td>
                    <td style={{ padding: "8px 16px", color: "var(--compare-muted)", fontFamily: "monospace", fontSize: 11.5 }}>{r.src}</td>
                    <td style={{ padding: "8px 16px" }}><span style={{ color: CLS[r.cls].fg, fontWeight: 700 }}>{r.cls}</span></td>
                    <td style={{ padding: "8px 16px", color: "var(--compare-body)" }}>{r.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== B · Alignment candidates ===== */}
        <h2 style={{ margin: "34px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: CLS.B.fg }}>B · Alignment candidates</h2>

        <Block n="B1" title="Side filter — All / Seller / Buyer" cls="B"
          note={<>Current is the legacy <code>agent-segment-pill</code> group (coral-fill active pill). The hub&apos;s All/Mine toggle already standardised on the arc <code>SegmentedControl</code> (morph-spring selection). Aligning makes the two segmented controls one part. Same options, same behaviour, same coral selection.</>}
          left={<CurrentSideFilter />} right={<ProposedSideFilter />} />

        <Block n="B2" title="Section count pill (live count badge)" cls="C" rightKind="new"
          note={<>Your call (B2 not approved as an &ldquo;align to plain Pill&rdquo;). Keep the current <code>agent-stat-glass</code> count badge — the tinted pill with the live pulsing dot — and REGISTER IT as a canonical <code>CountPill</code>. It is a distinct, better thing than the plain Pill: the dot signals a count that updates live. Current == proposed; this is naming/extraction only, nothing visual changes.</>}
          left={<div style={{ display: "flex", gap: 8 }}><span className="agent-stat-glass agent-stat-glass--danger" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}><span className="agent-stat-dot" aria-hidden />5 needs you</span><span className="agent-stat-glass agent-stat-glass--muted" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}><span className="agent-stat-dot" aria-hidden />49 on autopilot</span></div>}
          right={<div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", gap: 8 }}><span className="agent-stat-glass agent-stat-glass--danger" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}><span className="agent-stat-dot" aria-hidden />5 needs you</span><span className="agent-stat-glass agent-stat-glass--muted" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}><span className="agent-stat-dot" aria-hidden />49 on autopilot</span></div><span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>→ registered as canonical CountPill (identical pixels)</span></div>} />

        <Block n="B3" title="Chase split-button" cls="B"
          note={<>Current is the bespoke <code>rem-chase</code> split-button. Proposed uses the canonical split-button family (as <code>hub-split-button</code> in the gallery): a coral primary joined to a caret that opens the canonical RowActionMenu/Popover. The menu items (Mark chased / Mark done) are unchanged.</>}
          left={<CurrentChaseSplit />} right={<ProposedChaseSplit />} />

        <Block n="B4" title="Wake all / Chased buttons" cls="B"
          note={<>Current uses the legacy <code>agent-btn agent-btn-ghost-bordered</code>. Proposed uses the arc <code>Button</code> outline variant — the same quiet bordered control, with hover/focus/active states built in.</>}
          left={<div style={{ display: "flex", gap: 8 }}><button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">↻ Wake all (2)</button><button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">↻ Chased</button></div>}
          right={<div style={{ display: "flex", gap: 8 }}><button className={buttonClasses({ variant: "outline", size: "sm" })} style={{ gap: 5 }}><ArrowClockwise size={13} weight="bold" /> Wake all (2)</button><button className={buttonClasses({ variant: "outline", size: "sm" })} style={{ gap: 5 }}><ArrowClockwise size={13} weight="bold" /> Chased</button></div>} />

        {/* B5 — the animation belongs to the icon, not the button. */}
        <Block n="B5" title="Snooze trigger — canonical AnimatedClock in a plain button" cls="B"
          note={<><strong>The animation belongs to the icon, not the button.</strong> Current = a hand-rolled inline clock SVG + a bespoke <code>rem-clock-btn</code> class that drives the hover tick (and the hub&apos;s reschedule button hand-rolls the same thing). Proposed = a canonical <code>&lt;AnimatedClock/&gt;</code> icon dropped into the plain canonical secondary button. The icon owns its tick via one shared rule (&ldquo;an AnimatedClock inside a hovered/focused button ticks&rdquo;) — no per-button class. Flat canonical button, animation stays, zero hand-rolling. <strong>Hover both</strong> — identical tick. Future hover animations become new canonical <em>icons</em>, never new buttons. Both the reminders snooze and the hub reschedule button point at this one icon.</>}
          left={<div style={{ display: "flex", gap: 10, alignItems: "center" }}><CurrentSnoozeTrigger /><span style={{ fontSize: 12, color: "var(--compare-muted)" }}>hand-rolled SVG + <code>rem-clock-btn</code></span></div>}
          right={<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className={buttonClasses({ variant: "secondary", size: "sm" })} style={{ padding: "0 9px" }} aria-label="Snooze"><AnimatedClock size={14} /></button>
            <span style={{ fontSize: 12, color: "var(--compare-muted)" }}>plain secondary + <code>&lt;AnimatedClock/&gt;</code></span>
          </div>} />

        {/* ===== C · Proposed NEW canonicals ===== */}
        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: CLS.C.fg }}>C · Proposed new canonicals (not approved)</h2>

        <Block n="C1" title="Reminder row (needs-you)" cls="C" rightKind="new"
          note={<>The needs-you row — title, &ldquo;Chasing {`{who}`}&rdquo; line, explanation box, chase-count status, escalation flag, and a right-hand action+date column — is well-composed but defined inline in AgentRemindersList. Proposed: register it as a canonical <code>ReminderRow</code> so the file-page Reminders tab and this page share one part. Pixels unchanged; it&apos;s an extraction, not a restyle.</>}
          left={<CurrentReminderRow chaseSlot={<CurrentChaseSplit />} />}
          right={<CurrentReminderRow chaseSlot={<ProposedChaseSplit />} />} />

        <Block n="C2" title="Auto-chase countdown strip" cls="C" rightKind="new"
          note={<>The green &ldquo;Auto-chase tomorrow at 9:30am · 32h&rdquo; live strip is a success-toned status row unique to autopilot reminders. Proposed: register it as a canonical <code>CountdownStrip</code> (success tint + leading clock + live time + trailing action). Visual unchanged — this is a naming/extraction so other live-status rows can reuse it.</>}
          left={<CurrentCountdown />} right={<CurrentCountdown />} />

        {/* ===== A · Compliant ===== */}
        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: CLS.A.fg }}>A · Already compliant (no change)</h2>

        {/* A1 CORRECTED per your feedback: the urgency/side/manual pills do NOT render on this page. */}
        <Block n="A1" title="Pills on this page — correction" cls="A"
          note={<><strong>Correction (you were right):</strong> the urgency / side / Manual pills were removed from the work-queue page (critique #285) — they live on the property-file Reminders tab, not here. The ONLY pill that renders on this page is <code>FallbackPill</code>, and only in one edge case (no client on a side). It already composes the canonical <code>Pill</code>. The greyed row below shows the pills that are NOT on this page, for reference only.</>}
          left={<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><span style={{ ...LBLSTYLE }}>Actually on this page (edge case)</span><Pill tone="warning" size="sm" glass><span style={{ display: "inline-flex" }}><Warning size={11} weight="bold" /></span><span>Add client to start chasing</span></Pill></div>
            <div style={{ opacity: 0.4 }}><span style={{ ...LBLSTYLE }}>NOT on this page (file Reminders tab)</span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><DemoUrgencyPill bucket="overdue" label="10d overdue" /><DemoSidePill isBuyer={false} /><DemoSidePill isBuyer /><Pill tone="brand" size="sm" glass>Manual</Pill></div></div>
          </div>} />

        {/* A2 is split: the search field is compliant; the "Snoozed (3)" forward toggle is a B choice. */}
        <Block n="A2a" title="Search field" cls="A"
          note={<>The <code>agent-input agent-input-sm</code> search is canonical. No change.</>}
          left={<input className="agent-input agent-input-sm" placeholder="Search address or reminder…" style={{ width: "100%", fontSize: 13 }} />} />

        <Block n="A2b" title="‘Snoozed (3)’ forward toggle — muted vs coral" cls="B"
          note={<>It <em>is</em> canonical today (<code>agent-link-muted</code> — muted text, hover darkens muted→secondary, keeps the shared underline). But it&apos;s a forward toggle sitting opposite the coral Chase actions, and muted text can read as inert. Proposed: make this one the coral <code>.agent-link</code> (coral, darkens to coral-darker on hover — the link you already have). Keep the <code>← Active</code> / <code>← Back</code> back-links muted (muted is the canonical back-link convention). Hover both to compare.</>}
          left={<button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>Snoozed (3)</button>}
          right={<button className="agent-link" style={{ fontSize: 12, fontWeight: 600 }}>Snoozed (3)</button>} />

        <Block n="A3" title="Empty states (inline · all-caught-up)" cls="A"
          note={<>Both use the canonical <code>agent-empty-card</code> + <code>Skeleton</code> (shimmer off for the settled ghost). No change.</>}
          left={<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="agent-glass-strong agent-empty-card" style={{ padding: "28px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl, 20px)" }}>
              <Bell weight="regular" style={{ width: 30, height: 30, color: "var(--agent-text-muted)", margin: "0 auto 12px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>Your reminders will appear here</p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 320, lineHeight: 1.5 }}>Chases and follow-ups appear here as your files move forward.</p>
            </div>
            <div className="agent-glass-strong agent-empty-card" style={{ padding: "24px 20px", textAlign: "center", borderRadius: "var(--agent-radius-xl, 20px)" }}>
              <CheckCircle weight="fill" style={{ width: 30, height: 30, color: "var(--agent-success)", margin: "0 auto 10px", display: "block" }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>All caught up</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>No reminders due right now.</p>
            </div>
          </div>} />

        {/* ===== Canonical semantic tokens (reframed from "exceptions" per your feedback) ===== */}
        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: CLS.A.fg }}>Canonical semantic tokens — keep the colour</h2>

        <Block n="S1" title="Urgency colours + escalation flag" cls="A"
          note={<>Reframed (you were right to push): these aren&apos;t &ldquo;exceptions that escape the system&rdquo; — the urgency red / amber / slate and the escalation flag are built on the canonical semantic <em>tokens</em> (<code>--agent-danger</code>, <code>--agent-warning</code>, <code>--agent-text-muted</code>). So they ARE canonical and get registered as semantic-token usage. &ldquo;Keep&rdquo; only means: don&apos;t flatten the semantic red into coral — the colour carries the urgency meaning.</>}
          left={<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <CurrentSectionBar tone="danger" count={5} label="Needs you" sub="Due today or overdue" />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "var(--agent-danger)" }}>⚑ Auto-escalated, no response after repeated chases</p>
          </div>} />

        {/* ===== Full page composite ===== */}
        <h2 style={{ margin: "44px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Whole page — current vs proposed ({width}, {WIDTHS[width]}px)</h2>
        <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5 }}>The two columns are the same page; the right one swaps in the B-aligned side filter, section pills, Chase split-button and Wake/Chased buttons. Use the width toggle above to check tablet / mobile reflow.</p>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          {([["current", "Current"], ["proposed", "Proposed"]] as const).map(([kind, lbl]) => (
            <div key={kind} style={{ flex: "1 1 360px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: kind === "proposed" ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{lbl}</span>
              <div style={{ borderRadius: 16, padding: 16, background: "var(--compare-pane)", border: `1.5px solid ${kind === "proposed" ? CORAL : "var(--compare-line)"}`, overflowX: "auto" }}>
                <div style={{ width: Math.min(WIDTHS[width], 560), maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Page header */}
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)" }}>Reminders</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>What needs chasing, today and ahead.</p>
                  </div>
                  {/* Filter bar */}
                  <div className="agent-glass-strong" style={{ borderRadius: 16, padding: "10px 14px" }}>
                    <input className="agent-input agent-input-sm" placeholder="Search address or reminder…" style={{ width: "100%", marginBottom: 10, fontSize: 13 }} />
                    {kind === "current" ? <CurrentSideFilter /> : <ProposedSideFilter />}
                  </div>
                  {/* Needs you section */}
                  {kind === "current"
                    ? <CurrentSectionBar tone="danger" count={5} label="Needs you" sub="Due today or overdue" />
                    : <div className="agent-wq-secbar agent-wq-secbar--you flex items-center justify-between px-3 py-2 rounded-xl"><div className="flex items-center gap-2.5"><Pill tone="danger" size="sm" glass>5 needs you</Pill><span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Due today or overdue</span></div><CaretDown size={12} weight="bold" style={{ color: "var(--agent-text-muted)", transform: "rotate(180deg)" }} /></div>}
                  <CurrentFileCard><CurrentReminderRow chaseSlot={kind === "current" ? <CurrentChaseSplit /> : <ProposedChaseSplit />} /></CurrentFileCard>
                  {/* Autopilot section */}
                  {kind === "current"
                    ? <CurrentSectionBar tone="muted" count={49} label="On autopilot" sub="The system's got these" />
                    : <div className="agent-wq-secbar agent-wq-secbar--auto flex items-center justify-between px-3 py-2 rounded-xl"><div className="flex items-center gap-2.5"><Pill tone="muted" size="sm" glass>49 on autopilot</Pill><span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>The system&apos;s got these</span></div><CaretDown size={12} weight="bold" style={{ color: "var(--agent-text-muted)", transform: "rotate(180deg)" }} /></div>}
                  <CurrentFileCard>
                    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 660, color: "var(--agent-text-primary)" }}>All enquiries confirmed satisfied by Cook Taylor Woodhouse Solicitors Ltd</p>
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)", borderRadius: 8, padding: "6px 10px", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>Cook Taylor Woodhouse Solicitors Ltd need to confirm that all enquiries have been satisfactorily resolved so the matter can move into the final pre-exchange stage.</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted)" }}>↻ Not chased yet · First nudge due</p>
                      <CurrentCountdown />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <CurrentSnoozeTrigger />
                        {kind === "current" ? <CurrentChaseSplit /> : <ProposedChaseSplit />}
                      </div>
                    </div>
                  </CurrentFileCard>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
