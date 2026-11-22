"use client";

// AUTOMATED EMAILS (/agent/automated-emails) — canonical-alignment comparison.
//
// The founder's "worst page": old-style pills, ALL-CAPS eyebrows, feed rows with
// no property photo. BEFORE = real shipped markup/classes/inline-styles, copied
// verbatim from the source so the current side renders faithfully. AFTER = real
// canonicals (Pill, StatBlock/StatNumber, Donut, PropertyThumb, CountBadge, arc
// EmptyState) or clearly-labelled PROPOSED NEW CANONICAL mock-ups.
//
// Read-only. Drawers/modals (EmailDetailDrawer) excluded — own pass later.
// Light maps to the app default theme "sunset" so every --agent-* token resolves.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { StatNumber } from "@/components/ui/StatNumber";
import { StatBlock } from "@/components/ui/StatBlock";
import { Donut } from "@/components/ui/Donut";
import { CountBadge } from "@/components/ui/CountBadge";
import { ContactAvatar } from "@/components/ui/Avatar";
import { EmptyState as GenericEmptyState } from "@/components/ui/EmptyState";
import { EmptyState as ArcEmptyState } from "@/components/arc/empty-state/empty-state";
import { CaretRight, Tray } from "@phosphor-icons/react";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

type Cls = "A" | "B" | "C" | "D";
const CLS: Record<Cls, { label: string; fg: string }> = {
  A: { label: "COMPLIANT — already canonical", fg: "#15803d" },
  B: { label: "ALIGN — swap to canonical", fg: "#b45309" },
  C: { label: "REGISTER — new canonical", fg: "#b91c1c" },
  D: { label: "KEEP — intentional", fg: "#6d28d9" },
};
function Tag({ k }: { k: Cls }) {
  const t = CLS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: `${t.fg}1e`, border: `1px solid ${t.fg}55`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Stage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div style={{ background: "var(--stage-bg)", borderRadius: 14, border: "1px solid var(--stage-line)", padding: 20, minHeight: 60, display: "flex", alignItems: "center", justifyContent: wide ? "flex-start" : "center", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", overflowX: "auto" }}><div style={{ width: wide ? "100%" : "auto", maxWidth: "100%" }}>{children}</div></div>;
}
function Lbl({ kind }: { kind: "before" | "after" | "both" }) {
  const m = { before: { t: "Before — shipped now", c: "var(--compare-muted)" }, after: { t: "After — canonical / proposed", c: CORAL }, both: { t: "Current = canonical — compliant", c: "#15803d" } }[kind];
  return <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: m.c, marginBottom: 7 }}>{m.t}</span>;
}
function Spec({ n, title, cls, verdict, before, after, both, wide }: { n: string; title: string; cls: Cls; verdict: ReactNode; before?: ReactNode; after?: ReactNode; both?: ReactNode; wide?: boolean }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag k={cls} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 940 }}>{verdict}</p>
      {both !== undefined ? <div><Lbl kind="both" /><Stage wide={wide}>{both}</Stage></div> : (
        <div style={{ display: wide ? "block" : "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0, marginBottom: wide ? 14 : 0 }}><Lbl kind="before" /><Stage wide={wide}>{before}</Stage></div>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}><Lbl kind="after" /><Stage wide={wide}>{after}</Stage></div>
        </div>
      )}
    </section>
  );
}
function NotApproved() {
  return <span style={{ display: "inline-block", marginTop: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#b91c1c" }}>Proposed new canonical — not approved</span>;
}

/* ─────────────────────── CURRENT reproductions (verbatim) ─────────────────── */

// Category chip: canonical Pill forced ALL-CAPS 9.5px tinted glass (EmailFeedRow:48).
function CatChipNow({ chase }: { chase?: boolean }) {
  return <Pill glass tone={chase ? "warning" : "info"} size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.03em", fontSize: 9.5, flexShrink: 0 }}>{chase ? "Chase" : "Notification"}</Pill>;
}
// Delivery status pill: canonical Pill glass tinted (EmailFeedRow:103).
function DeliveryNow({ tone, label }: { tone: "success" | "info" | "muted" | "warning" | "danger"; label: string }) {
  return <Pill glass tone={tone} size="sm">{label}</Pill>;
}
// The pre-migration eyebrow prod still shows: uppercase + tracking.
function EyebrowNow({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: "var(--agent-text-eyebrow, 11px)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", lineHeight: 1.2 }}>{children}</p>;
}

// Proposed de-tinted "dot + sentence-case label" status language.
function StatusDot({ color, label, strong }: { color: string; label: string; strong?: boolean }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: strong ? "var(--agent-text-primary)" : "var(--agent-text-secondary)", whiteSpace: "nowrap" }}><span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }} />{label}</span>;
}

const ROW_BORDER = "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))";

// CompactRow (EmailFeedRow:59) — NO property photo.
function FeedRowNow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: "var(--agent-radius-md, 8px)", border: ROW_BORDER, background: "var(--agent-surface-glass, transparent)", width: "100%" }}>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", width: 42, flexShrink: 0 }}>10:00</span>
      <CatChipNow chase />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>22 Dewsleys Lane, Newhall, Harlow, CM17 9TL</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>On your purchase at 22 Dewsleys Lane</div>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--agent-text-muted)", maxWidth: 170, whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: "#0369a1", flexShrink: 0 }} />Mr Jawad Ali · Purchaser</span>
      <DeliveryNow tone="success" label="Delivered" />
    </div>
  );
}
// Proposed feed row — leading PropertyThumb + dot-chip category + dot status.
function FeedRowNext() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: "var(--agent-radius-md, 8px)", border: ROW_BORDER, background: "var(--agent-surface-glass, transparent)", width: "100%" }}>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", width: 42, flexShrink: 0 }}>10:00</span>
      <PropertyThumb photoUrl={null} size={38} />
      <Pill tone="warning" size="sm" dot outline style={{ flexShrink: 0 }}>Chase</Pill>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>22 Dewsleys Lane, Newhall, Harlow, CM17 9TL</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>On your purchase at 22 Dewsleys Lane</div>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--agent-text-muted)", maxWidth: 170, whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: "#0369a1", flexShrink: 0 }} />Mr Jawad Ali · Purchaser</span>
      <StatusDot color="var(--agent-success)" label="Delivered" />
    </div>
  );
}

// FilesView FileRow (FilesView:77) — NO photo, Covered glass pill + Pause button.
function FilesRowNow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--agent-radius-md, 8px)", border: ROW_BORDER, background: "var(--agent-surface-glass, transparent)", width: "100%" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>16 Deans Furlong, Tring, HP23 4AR</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>3 queued · Next 27 Nov</div>
      </div>
      <Pill glass tone="success" size="sm">Covered</Pill>
      <button type="button" className="agent-btn agent-btn-xs agent-btn-ghost-bordered">Pause</button>
    </div>
  );
}
function FilesRowNext() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--agent-radius-md, 8px)", border: ROW_BORDER, background: "var(--agent-surface-glass, transparent)", width: "100%" }}>
      <PropertyThumb photoUrl={null} size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>16 Deans Furlong, Tring, HP23 4AR</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>3 queued · Next 27 Nov</div>
      </div>
      <StatusDot color="var(--agent-success)" label="Covered" />
      <button type="button" className="agent-btn agent-btn-xs agent-btn-ghost-bordered">Pause</button>
    </div>
  );
}

// Banner stat strip (AutomationBanner:91) — 21px/700, borderLeft dividers.
const BANNER_STATS = [
  { v: "0", l: "Sent today", s: "Nothing else due today" },
  { v: "8", l: "Queued ahead", s: "Next Fri 27 Nov" },
  { v: "0", l: "Need attention", s: "All clear" },
  { v: "38", l: "Files monitored", s: "Automated" },
];
function BannerStatsNow() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 12 }}>
      {BANNER_STATS.map((s, i) => (
        <div key={s.l} style={{ padding: "0 20px", borderLeft: i === 0 ? "none" : "1px solid var(--agent-border-subtle, rgba(15,23,42,0.08))", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", color: "var(--agent-text-primary)" }}>{s.v}</span>
          <span style={{ fontSize: 11.5, color: "var(--agent-text-secondary)" }}>{s.l}</span>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{s.s}</span>
        </div>
      ))}
    </div>
  );
}
function BannerStatsNext() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 12 }}>
      {BANNER_STATS.map((s, i) => (
        <div key={s.l} style={{ padding: "0 20px", borderLeft: i === 0 ? "none" : "1px solid var(--agent-border-subtle, rgba(15,23,42,0.08))" }}>
          <StatBlock eyebrow={s.l} value={<StatNumber size="sm">{s.v}</StatNumber>} sub={s.s} />
        </div>
      ))}
    </div>
  );
}

// Activity stat tile (AutomationActivityPanel:94) — eyebrow + 24px/700 + sub.
function ActivityTileNow() {
  return (
    <div>
      <p className="agent-eyebrow" style={{ margin: 0, marginBottom: 2 }}>Emails sent</p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>338</p>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>312 chase · 26 notification</p>
    </div>
  );
}

// Coverage donut (AutomationCoveragePanel:40) — conic-gradient + radial mask.
function CoverageNow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div role="img" aria-label="coverage" style={{ position: "relative", width: 148, height: 148 }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(var(--agent-success) 0 350deg, #6366f1 350deg 360deg)", WebkitMaskImage: "radial-gradient(circle, transparent 53%, #000 54%)", maskImage: "radial-gradient(circle, transparent 53%, #000 54%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <span style={{ display: "block", fontSize: 30, fontWeight: 720, letterSpacing: "-0.02em", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>38</span>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Files</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function CoverageNext() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: 148, height: 148, display: "grid", placeItems: "center" }}>
        <Donut size={148} thickness={14} segments={[{ value: 37, color: "var(--agent-success)" }, { value: 1, color: "#6366f1" }]} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <StatNumber>38</StatNumber>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Files</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// GroupHeader (BySaleView:32) — h2 13/700 + bare-number tinted Pill count.
function GroupHeaderNow({ tone }: { tone: "success" | "danger" | "muted" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px" }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>Chasing now</h2>
      <Pill glass tone={tone} size="sm">18</Pill>
      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--agent-text-muted)" }}>on their own · next run <b style={{ color: "var(--agent-text-secondary)" }}>Tomorrow</b></span>
    </div>
  );
}
function GroupHeaderNext() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px" }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>Chasing now</h2>
      <CountBadge count={18} tone="accent" />
      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--agent-text-muted)" }}>on their own · next run <b style={{ color: "var(--agent-text-secondary)" }}>Tomorrow</b></span>
    </div>
  );
}

// Chase progress dots (BySaleView:92) — 6px coral/border dots.
function ChaseDots({ n, max, step }: { n: number; max: number; step?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {Array.from({ length: Math.max(max, n) }).map((_, i) => (
        <span key={i} aria-hidden style={{ width: step && i === n - 1 ? 14 : 6, height: 6, borderRadius: 999, background: i < n ? "var(--agent-coral)" : "var(--agent-border-default)", transition: "width .2s" }} />
      ))}
    </span>
  );
}

// Stacked proportion bar (ChasePerformanceView:34) — 12px flex bar + legend.
const BAR_SEGS = [
  { pct: 46, color: "var(--agent-success)", label: "Replied", n: 156 },
  { pct: 34, color: "var(--agent-info)", label: "Opened", n: 115 },
  { pct: 20, color: "var(--agent-text-muted)", label: "No reply", n: 67 },
];
function StackedBar() {
  return (
    <div style={{ width: 300 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--agent-surface-nested, rgba(15,23,42,0.05))" }}>
        {BAR_SEGS.map((s) => <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        {BAR_SEGS.map((s) => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--agent-text-secondary)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} /><b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.n}</b> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Tab row (ListView:155) — segment-pill chips + inline-text count.
const TABS = [{ l: "By sale" }, { l: "Schedule", n: 65 }, { l: "History (30d)", n: 338 }, { l: "Problems", n: 0 }, { l: "Insights" }];
function TabRowNow() {
  const [on, setOn] = useState(1);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }} role="tablist">
      {TABS.map((t, i) => (
        <button key={t.l} type="button" role="tab" onClick={() => setOn(i)} className={`agent-segment-pill agent-segment-pill-sm${i === on ? " on" : ""}`}>{t.l}{t.n != null ? ` · ${t.n}` : ""}</button>
      ))}
    </div>
  );
}
function TabRowNext() {
  const [on, setOn] = useState(1);
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 4, borderRadius: 12, background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-subtle)", flexWrap: "wrap" }} role="tablist">
      {TABS.map((t, i) => {
        const sel = i === on;
        return (
          <button key={t.l} type="button" role="tab" aria-selected={sel} onClick={() => setOn(i)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: sel ? "var(--agent-text-primary)" : "var(--agent-text-secondary)", background: sel ? "var(--agent-surface-elevated)" : "transparent", boxShadow: sel ? "0 1px 2px rgba(15,23,42,0.08)" : "none" }}>
            {t.l}{t.n != null && <CountBadge count={t.n} tone={sel ? "accent" : "muted"} soft={!sel} hideZero={false} />}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Inventory ──────────────────────────────────── */

const INVENTORY: { item: string; cls: Cls; verdict: string }[] = [
  // Top chrome
  { item: "PageHeader", cls: "A", verdict: "Shared page-header primitive" },
  { item: "GlassCard container (×6 panels)", cls: "A", verdict: "Baked glass, per-panel glassId — compliant" },
  { item: "Banner health lead + state icon", cls: "D", verdict: "Bespoke hero strip; no-backer icons are deliberate" },
  { item: "Banner stats (Sent today / Queued / …)", cls: "B", verdict: "Hand-rolled 21px/700 → StatBlock + StatNumber (sm)" },
  { item: "Needs-attention / Sending-today count pill", cls: "B", verdict: "Pill glass tinted fill → de-tint (dot + label)" },
  { item: "IssueCard / SendingRow", cls: "D", verdict: "Bespoke typed rows; controls are canonical agent-btn" },
  { item: "ContactAvatar (needs / cockpit)", cls: "A", verdict: "Canonical Avatar (side-tinted)" },
  // Coverage + activity
  { item: "Coverage donut", cls: "B", verdict: "Hand-rolled conic-gradient ring → canonical Donut" },
  { item: "Coverage legend row", cls: "C", verdict: "Bespoke swatch+value+title+sub → register LegendItem" },
  { item: "Activity stat tile", cls: "B", verdict: "24px/700 → StatBlock (eyebrow already canonical)" },
  { item: "Activity delta ↑/↓ %", cls: "C", verdict: "Bespoke delta line → register DeltaIndicator" },
  { item: "Period toggle (7d/30d/90d)", cls: "A", verdict: "Canonical agent-segment-pill" },
  { item: "Stacked bar chart + legend", cls: "C", verdict: "First stacked bar — register StackedBar + LegendItem" },
  { item: "Chart tooltip (.ui-chart-tip)", cls: "B", verdict: "Inline tip → canonical portalled ChartTipPortal" },
  // List shell
  { item: "Tab row (Schedule · 65 …)", cls: "B", verdict: "Segment pills + inline count → TodoTabs-style + CountBadge" },
  { item: "Search field", cls: "A", verdict: "Canonical agent-input" },
  { item: "Type / Recipient / Status selects", cls: "B", verdict: "Native <select> skinned — no canonical Select yet" },
  { item: "From-date field", cls: "B", verdict: "Native type=date → canonical DateField" },
  { item: "Clear-filters link", cls: "A", verdict: "Canonical agent-link-muted" },
  { item: "Export button", cls: "A", verdict: "Canonical agent-btn-ghost-bordered" },
  { item: "Director scope toggle", cls: "B", verdict: "Two pills → arc SegmentedControl" },
  { item: "File-filter pill (Filtered to:)", cls: "B", verdict: "Pill glass muted tinted → outline / de-tint" },
  { item: "Day-group / section eyebrows", cls: "B", verdict: "ALL-CAPS in prod → sentence-case agent-eyebrow (already in repo)" },
  // Feed rows
  { item: "CompactRow (feed row)", cls: "B", verdict: "No property photo → add PropertyThumb; register row" },
  { item: "CHASE / NOTIFICATION category chip", cls: "B", verdict: "ALL-CAPS tinted Pill → sentence-case, de-tinted" },
  { item: "Delivery-status pill (Delivered …)", cls: "B", verdict: "Pill glass tinted → dot + label (de-tint)" },
  { item: "Predicted pill + dashed row", cls: "D", verdict: "Outline pill + dashed border — forecast signal, keep" },
  { item: "Recipient · role line (RoleIcon)", cls: "A", verdict: "Canonical RoleIcon + label" },
  { item: "Load more / Show all", cls: "B", verdict: "Tab-pill used as a button → ghost/secondary button" },
  { item: "Missing-email setup row", cls: "C", verdict: "Bespoke row (warning outline Pill + link) → register" },
  // Insights / cockpit
  { item: "GroupHeader count pill", cls: "B", verdict: "Bare number in tinted Pill → CountBadge" },
  { item: "BySale PhotoIdentity (thumb + addr)", cls: "A", verdict: "Canonical PropertyThumb + agent-link — the good pattern" },
  { item: "'Sends …' / 'Needs you' StatusPill", cls: "A", verdict: "Canonical StatusPill composition" },
  { item: "Chase progress dots", cls: "C", verdict: "Bespoke 6px dots → register StepDots" },
  { item: "View file / Pause / action buttons", cls: "A", verdict: "Canonical agent-btn (sm / xs, ghost-bordered)" },
  { item: "All set / Paused disclosure", cls: "D", verdict: "Compact disclosure — intentionally not SectionDisclosure" },
  { item: "Email preview iframe", cls: "D", verdict: "True-to-send white frame — intentional" },
  { item: "FilesView FileRow", cls: "B", verdict: "No photo (asymmetric with BySale) → add PropertyThumb" },
  { item: "Covered / Paused / problems pill", cls: "B", verdict: "Pill glass tinted → dot + label (de-tint)" },
  // States
  { item: "Empty states (list / files / analytics)", cls: "B", verdict: "Generic blue ui/EmptyState → arc EmptyState" },
  { item: "Analytics Tile (Chase / Email health)", cls: "B", verdict: "24px/700 → StatBlock / StatNumber (sm)" },
];

export default function AutoEmailsComparePage() {
  const restore = useRef<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const themeAttr = theme === "light" ? "sunset" : "dark";
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", themeAttr); }, [themeAttr]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars: CSSProperties = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
    ["--stage-bg" as string]: theme === "dark" ? "#201b14" : "#ffffff",
    ["--stage-line" as string]: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,23,30,0.07)",
  };
  const tog = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });
  const counts = INVENTORY.reduce((a, r) => { a[r.cls] = (a[r.cls] ?? 0) + 1; return a; }, {} as Record<Cls, number>);

  return (
    <div className="agent-shell-root nv2-night" data-theme={themeAttr} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Compare · Automated emails (/agent/automated-emails)</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>Automated emails — canonical alignment</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 860 }}>
          The three things the founder flagged are up top: <b style={{ color: CLS.B.fg }}>old-style pills</b>, <b style={{ color: CLS.B.fg }}>capital eyebrows</b>, and <b style={{ color: CLS.B.fg }}>feed rows with no property photo</b>. <b style={{ color: CLS.B.fg }}>Before</b> = real shipped markup. <b style={{ color: CLS.B.fg }}>After</b> = real canonical (or a labelled proposal). Nothing is applied — this is for your review.
        </p>

        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "11px 16px", background: "var(--stage-bg)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>{INVENTORY.length} components / patterns</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}><b style={{ color: CLS.A.fg }}>{counts.A ?? 0} compliant</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} register</b> · <b style={{ color: CLS.D.fg }}>{counts.D ?? 0} keep</b></span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {INVENTORY.map((r) => (
                  <tr key={r.item} style={{ borderTop: "1px solid var(--compare-line)" }}>
                    <td style={{ padding: "7px 16px", color: "var(--compare-ink)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.item}</td>
                    <td style={{ padding: "7px 16px" }}><span style={{ color: CLS[r.cls].fg, fontWeight: 700 }}>{r.cls}</span></td>
                    <td style={{ padding: "7px 16px", color: "var(--compare-body)" }}>{r.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h2 style={{ margin: "26px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CORAL }}>The three flagged problems</h2>

        <Spec n="1" title="Old pills — CHASE / NOTIFICATION category chip" cls="B"
          verdict={<>The worst offender. It IS the canonical <code>Pill</code>, but forced back to the retired shouty style with three inline overrides: <code>textTransform:uppercase</code>, <code>letterSpacing:0.03em</code>, <code>fontSize:9.5</code> — on top of a soft <b>tinted glass fill</b>. Proposed: sentence-case label and <b>de-tinted</b> — a tone dot + outline (no wash), per the &ldquo;no faded fills&rdquo; rule.</>}
          before={<div style={{ display: "flex", gap: 10 }}><CatChipNow chase /><CatChipNow /></div>}
          after={<div style={{ display: "flex", gap: 10 }}><Pill tone="warning" size="sm" dot outline>Chase</Pill><Pill tone="info" size="sm" dot outline>Notification</Pill></div>} />

        <Spec n="2" title="Capital eyebrows — day-group & section labels" cls="B"
          verdict={<>In prod you see <b>TOMORROW · 28 EMALS</b>, <b>FRI 20 NOV · 18 EMALS</b>, <b>FILES</b> — all-caps + wide tracking. Good news: the labels already use <code>.agent-eyebrow</code>, which was switched to <b>sentence-case</b> in the repo on 2026-11-20. So this is <b>already fixed</b> — it just hasn&rsquo;t deployed. Before = what prod shows; after = the current repo (sentence case).</>}
          before={<div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}><EyebrowNow>Tomorrow · 28 emails</EyebrowNow><EyebrowNow>Fri 20 Nov · 18 emails</EyebrowNow><EyebrowNow>Files</EyebrowNow></div>}
          after={<div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}><p className="agent-eyebrow" style={{ margin: 0 }}>Tomorrow · 28 emails</p><p className="agent-eyebrow" style={{ margin: 0 }}>Fri 20 Nov · 18 emails</p><p className="agent-eyebrow" style={{ margin: 0 }}>Files</p></div>} />

        <Spec n="3" title="Missing property photos — the Schedule / History feed row" cls="B" wide
          verdict={<>The <code>CompactRow</code> shows the address as plain text with <b>no photo</b> — the page feels flat next to the hub and the &ldquo;By sale&rdquo; cockpit (which both lead with a 40px <code>PropertyThumb</code>). Proposed: add the canonical <code>PropertyThumb</code> as the leading column, and apply the de-tinted category + status language from #1 / #5.</>}
          before={<FeedRowNow />} after={<FeedRowNext />} />

        <Spec n="4" title="Missing property photos — the Insights 'Files' row" cls="B" wide
          verdict={<>Same gap on the Insights file list — address text only, a &ldquo;Covered&rdquo; glass pill and a Pause button. The &ldquo;By sale&rdquo; cockpit rows carry photos; these don&rsquo;t. Proposed: add <code>PropertyThumb</code> so every file row across the page reads the same, plus the de-tinted status.</>}
          before={<FilesRowNow />} after={<FilesRowNext />} />

        <Spec n="5" title="Delivery / coverage status pills" cls="B"
          verdict={<>Delivered / Sent / Bounced / Covered / Paused are the canonical <code>Pill</code> in <code>glass</code> — a <b>soft tone-tinted fill</b> (~14% alpha). Sentence-case already (good). Proposed: carry the colour in a <b>dot</b>, not a fill — a dot + sentence-case label. Cleaner, consistent with the category chip, and no wash.</>}
          before={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><DeliveryNow tone="success" label="Delivered" /><DeliveryNow tone="info" label="Sent" /><DeliveryNow tone="danger" label="Bounced" /><DeliveryNow tone="muted" label="Pending" /></div>}
          after={<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}><StatusDot color="var(--agent-success)" label="Delivered" /><StatusDot color="var(--agent-info)" label="Sent" /><StatusDot color="var(--agent-danger)" label="Bounced" /><StatusDot color="var(--agent-text-muted)" label="Pending" /></div>} />

        <h2 style={{ margin: "34px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CORAL }}>Numbers &amp; stats</h2>

        <Spec n="6" title="Banner health stats" cls="B" wide
          verdict={<>Four figures at <b>21px/700</b> with <code>borderLeft</code> dividers — a bespoke numeral, one of two sizes on the page. Proposed: the canonical <code>StatBlock</code> (eyebrow + <code>StatNumber</code> sm = 24/750 tabular + sub), so every figure on the page is one family.</>}
          before={<BannerStatsNow />} after={<BannerStatsNext />} />

        <Spec n="7" title="Activity stat tile" cls="B"
          verdict={<>The trend panel&rsquo;s tiles are <b>24px/700</b> — eyebrow is already the canonical sentence-case <code>agent-eyebrow</code>, only the numeral differs. Proposed: <code>StatBlock</code> / <code>StatNumber</code> (750 weight).</>}
          before={<div style={{ width: 200 }}><ActivityTileNow /></div>}
          after={<div style={{ width: 200 }}><StatBlock eyebrow="Emails sent" value={<StatNumber size="sm">338</StatNumber>} sub="312 chase · 26 notification" /></div>} />

        <Spec n="8" title="Section count pill (By sale headers)" cls="B"
          verdict={<>&ldquo;Chasing now&rdquo;, &ldquo;All set&rdquo;, &ldquo;Needs you&rdquo; headers carry a bare number inside a <b>tinted glass Pill</b>. The library already says section/group counts are <code>CountBadge</code>, &ldquo;deliberately NOT the tinted Pill&rdquo;. Proposed: <code>CountBadge</code> (outline).</>}
          before={<div style={{ width: 380 }}><GroupHeaderNow tone="success" /></div>}
          after={<div style={{ width: 380 }}><GroupHeaderNext /></div>} />

        <h2 style={{ margin: "34px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CORAL }}>Data visualisation</h2>

        <Spec n="9" title="Automation coverage donut" cls="B"
          verdict={<>A hand-rolled <code>conic-gradient</code> ring with a radial mask + a centre total. We now have a canonical <code>Donut</code> (recharts, extracted 2026-11-21). Proposed: the canonical <code>Donut</code> with the total overlaid — same read, one component.</>}
          before={<CoverageNow />} after={<CoverageNext />} />

        <Spec n="10" title="Chase progress dots" cls="C"
          verdict={<>&ldquo;chase 2 of 2&rdquo; renders as filled coral / hollow dots (6px). No dot-progress canonical exists (ProgressRing / ProgressBar are different shapes). Proposed: register a <code>StepDots</code> primitive — the after widens the active step into a coral pill (matches the welcome-modal step dots).</>}
          before={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><ChaseDots n={2} max={2} /><span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>chase 2 of 2</span></div>}
          after={<div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><ChaseDots n={2} max={2} step /><span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>chase 2 of 2</span></div><NotApproved /></div>} />

        <Spec n="11" title="Stacked proportion bar + legend" cls="C" wide
          verdict={<>Chase-performance and email-health both draw a 12px flex stacked bar + a swatch legend. No stacked-bar canonical exists (<code>HeatBand</code> encodes one value per cell). Proposed: register a <code>StackedBar</code> + a shared <code>LegendItem</code> (the coverage legend and chart legend are the same family).</>}
          both={<div><StackedBar /><NotApproved /></div>} />

        <h2 style={{ margin: "34px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CORAL }}>Controls &amp; states</h2>

        <Spec n="12" title="Tab row" cls="B" wide
          verdict={<>Bespoke <code>agent-segment-pill</code> chips where the count is plain inline text (<code> · 65</code>) and the selected tab is a solid coral pill. Proposed: a glass segmented track (like the canonical <code>TodoTabs</code>) with the count as a <code>CountBadge</code> — a quieter, more scannable tab row. Click to switch.</>}
          before={<TabRowNow />} after={<div><TabRowNext /><NotApproved /></div>} />

        <Spec n="13" title="Filter bar — selects & date" cls="B" wide
          verdict={<>Search is the canonical <code>agent-input</code> (good). But Type / Recipient / Status are <b>native <code>&lt;select&gt;</code></b> wearing the input skin (OS-native dropdown + chevron, inconsistent in dark), and the date is a <b>native <code>type=date</code></b>, not the canonical <code>DateField</code>. Proposed: a canonical Select primitive (new) + <code>DateField</code>.</>}
          before={<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><select className="agent-input agent-input-sm" style={{ width: "auto" }} defaultValue=""><option value="">All types</option><option>Chase</option><option>Notification</option></select><input type="date" className="agent-input agent-input-sm" style={{ width: 150 }} /></div>}
          after={<div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><button type="button" className="agent-input agent-input-sm" style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>All types <CaretRight size={12} weight="bold" style={{ transform: "rotate(90deg)", opacity: 0.6 }} /></button><button type="button" className="agent-input agent-input-sm" style={{ width: 150, display: "inline-flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", color: "var(--agent-text-muted)" }}>dd / mm / yyyy</button></div><NotApproved /></div>} />

        <Spec n="14" title="Empty states" cls="B"
          verdict={<>Every empty here is the generic <code>components/ui/EmptyState</code> — a <b>blue-gradient, slate-on-white</b> chip that is off-token and explicitly deferred. Proposed: the canonical arc <code>EmptyState</code> (icon badge, title, description, optional action) — the one we just rolled onto Updates.</>}
          before={<div style={{ width: 320 }}><GenericEmptyState title="No automated email activity in this period" description="Try a different period or clear your filters." compact /></div>}
          after={<div style={{ width: 320 }}><ArcEmptyState icon={<Tray size={24} weight="regular" />} title="No activity in this period" description="Try a different period or clear your filters." /></div>} />

        <h2 style={{ margin: "34px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#15803d" }}>Already compliant (no change)</h2>

        <Spec n="15" title="'By sale' photo identity — the pattern to copy" cls="A" wide
          verdict={<>This is the row the feed rows (#3 / #4) should match: canonical <code>PropertyThumb</code> + address <code>agent-link</code> + a <code>ContactAvatar</code> for the person. Already right.</>}
          both={<div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", maxWidth: 520 }}><PropertyThumb photoUrl={null} size={40} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>1 The Kiplings</div><div style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Gooseberry Hill, Luton, LU3 2LA</div></div><ContactAvatar contact={{ name: "Waseem Ismail", roleType: "purchaser" }} size={30} /><button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered">View file</button></div>} />

        <Spec n="16" title="Export button & status pills (StatusPill)" cls="A"
          verdict={<>The Export button is the canonical <code>agent-btn-ghost-bordered</code>; the &ldquo;Sends Tue 24 Nov&rdquo; / &ldquo;Needs you&rdquo; rows are the canonical <code>StatusPill</code> composition. Shown for reference — no change.</>}
          both={<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ gap: 6 }}>Export</button><Pill glass tone="warning" size="sm"><CaretRight size={11} weight="bold" /> Sends Tue 24 Nov</Pill></div>} />
      </div>
    </div>
  );
}
