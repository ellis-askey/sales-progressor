"use client";

/* Tab-button design exploration page — narrowed to Variant 2 vs Variant 4.
 *
 * Temporary preview at /agent/polish/tab-buttons. Two visual approaches
 * rendered side by side across three contexts:
 *   1. Cream gradient (page background)
 *   2. Glass-strong card (contained context)
 *   3. Applied to consumer surfaces (filter chips, detail tabs, forecast strip)
 *
 * After Ellis picks the winner: delete this file. */

import { useState } from "react";
import { AGENT_THEMES, type AgentTheme } from "@/lib/agent/themes";

const STYLES = `
/* ── Page chrome ─────────────────────────────────────────────────────── */
.tb-page {
  padding: 28px 36px 80px;
  min-height: 100vh;
  font-family: inherit;
}
.tb-chrome {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 0.5px solid var(--agent-border-default);
  margin: -28px -36px 28px;
  padding: 14px 36px;
}
.tb-h1 { font-size: 18px; font-weight: 700; color: var(--agent-text-primary); margin: 0 0 10px; }
.tb-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tb-bar-label { font-size: 11px; color: var(--agent-text-muted); font-family: monospace; margin-right: 4px; }
.tb-chip {
  padding: 4px 11px; border-radius: 99px; border: 1px solid rgba(30,45,74,0.18);
  font-size: 11px; font-weight: 500; cursor: pointer; background: rgba(255,255,255,0.55);
  color: var(--agent-text-secondary);
}
.tb-chip.on { background: var(--agent-coral-deep); color: white; border-color: var(--agent-coral-deep); }

/* ── Comparison section layout ──────────────────────────────────────── */
.tb-section { margin-bottom: 40px; }
.tb-section-hdr {
  font-size: 11px; font-weight: 700; color: var(--agent-text-muted);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 0 0 12px;
}
.tb-section-sub {
  font-size: 13px; color: var(--agent-text-secondary);
  margin: -8px 0 14px;
  line-height: 1.45;
}

.tb-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.tb-panel { border-radius: 14px; padding: 22px 22px 26px; }
.tb-panel-cream {
  background: linear-gradient(135deg, #fcf8f3 0%, #fef4ec 100%);
  border: 0.5px solid var(--agent-border-default);
}
.tb-panel-glass {
  background: rgba(255,255,255,0.62);
  backdrop-filter: blur(18px);
  border: 0.5px solid var(--agent-border-default);
}
.tb-panel-plain {
  background: transparent;
  padding: 0;
}
.tb-variant-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  color: var(--agent-coral-deep);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 14px;
}
.tb-variant-tag-name {
  color: var(--agent-text-primary);
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  font-size: 13px;
}
.tb-demo-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.tb-demo-row:last-child { margin-bottom: 0; }
.tb-row-label {
  font-size: 10px; color: var(--agent-text-muted);
  font-family: monospace; width: 64px; flex-shrink: 0;
}
.tb-mini-block { margin-bottom: 18px; }
.tb-mini-block:last-child { margin-bottom: 0; }
.tb-mini-caption { font-size: 11px; color: var(--agent-text-muted); margin-bottom: 6px; font-weight: 500; }

/* ── VARIANT 2 — solid filled, borderless ─────────────────────────────── */
.tbv2-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 13px; border-radius: 8px;
  background: rgba(255,255,255,0.50);
  border: 1px solid rgba(255,255,255,0.55);
  color: var(--agent-text-secondary);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms, color 120ms, transform 120ms, box-shadow 120ms;
}
.tbv2-pill:hover:not(.tbv2-disabled):not(.on) {
  background: rgba(255,255,255,0.78);
  color: var(--agent-text-primary);
}
.tbv2-pill.on {
  background: var(--agent-coral-deep);
  color: white;
  border-color: var(--agent-coral-deep);
  box-shadow: 0 1px 3px rgba(var(--agent-coral-rgb), 0.35);
}
.tbv2-disabled { opacity: 0.42; cursor: default; pointer-events: none; }
.tbv2-count {
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 99px;
  background: rgba(0,0,0,0.06); color: inherit;
}
.tbv2-pill.on .tbv2-count { background: rgba(255,255,255,0.22); color: white; }

/* ── VARIANT 4 — underline tab (no pill) ──────────────────────────────── */
.tbv4-tabrow {
  display: inline-flex; gap: 4px;
  border-bottom: 0.5px solid var(--agent-border-default);
  padding: 0;
}
.tbv4-tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px 11px;
  background: transparent; border: none;
  color: var(--agent-text-muted);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 120ms;
}
.tbv4-tab::after {
  content: ""; position: absolute;
  left: 14px; right: 14px; bottom: -1px;
  height: 2px; background: var(--agent-coral-deep);
  transform: scaleX(0); transform-origin: center;
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.tbv4-tab:hover:not(.tbv4-disabled):not(.on) { color: var(--agent-text-primary); }
.tbv4-tab:hover:not(.tbv4-disabled):not(.on)::after { transform: scaleX(0.4); opacity: 0.3; }
.tbv4-tab.on { color: var(--agent-text-primary); font-weight: 600; }
.tbv4-tab.on::after { transform: scaleX(1); }
.tbv4-disabled { opacity: 0.35; cursor: default; pointer-events: none; }
.tbv4-count { font-size: 10px; font-weight: 500; color: var(--agent-text-muted); }
.tbv4-tab.on .tbv4-count { color: var(--agent-coral-deep); font-weight: 600; }

/* ── Mock "card" panel for the mini-mockup forecast context ────────── */
.tb-card {
  background: rgba(255,255,255,0.72);
  border: 0.5px solid var(--agent-border-default);
  border-radius: 12px;
  padding: 10px 14px;
}
.tb-card-label { font-size: 11px; font-weight: 600; color: var(--agent-text-secondary); margin-right: 8px; }
.tb-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
`;

const PILLS = [
  { key: "all", label: "All", count: 17, active: false },
  { key: "active", label: "Active", count: 15, active: true },
  { key: "on_hold", label: "On hold", count: 1, active: false },
  { key: "completed", label: "Completed", count: 1, active: false },
  { key: "withdrawn", label: "Withdrawn", count: 0, active: false },
];

const FORECAST_MONTHS = [
  { label: "May", count: 2, populated: true },
  { label: "Jun", count: 3, populated: true },
  { label: "Jul", count: 6, populated: true },
  { label: "Aug", count: 3, populated: true },
  { label: "Sep", count: 0, populated: false },
  { label: "Oct", count: 1, populated: true },
  { label: "Nov", count: 0, populated: false },
  { label: "Dec", count: 0, populated: false },
  { label: "Jan 27", count: 2, populated: true },
  { label: "Feb 27", count: 0, populated: false },
  { label: "Mar 27", count: 0, populated: false },
  { label: "Apr 27", count: 1, populated: true },
];

const FILTER_CHIPS = [
  { label: "Owner: Sarah", active: true },
  { label: "Risk", active: false },
  { label: "Managed by", active: false },
];

const DETAIL_TABS = ["Overview", "Steps", "Reminders", "To-Do", "Activity"];

/* ─── Variant renderers ───────────────────────────────────────────────── */

type PillItem = {
  key: string;
  label: string;
  count: number;
  active: boolean;
  forceDisabled?: boolean;
};

function V2Pill({ p, showCount = true }: { p: PillItem; showCount?: boolean }) {
  const cls = `tbv2-pill${p.active ? " on" : ""}${p.forceDisabled ? " tbv2-disabled" : ""}`;
  return (
    <button key={p.key} className={cls} aria-disabled={p.forceDisabled || undefined}>
      {p.label}
      {showCount && (
        p.count === 0 && p.forceDisabled
          ? <span className="tbv2-count" aria-hidden>—</span>
          : <span className="tbv2-count">{p.count}</span>
      )}
    </button>
  );
}

function V4Tab({ p, showCount = true }: { p: PillItem; showCount?: boolean }) {
  const cls = `tbv4-tab${p.active ? " on" : ""}${p.forceDisabled ? " tbv4-disabled" : ""}`;
  return (
    <button key={p.key} className={cls} aria-disabled={p.forceDisabled || undefined}>
      {p.label}
      {showCount && (
        p.count === 0 && p.forceDisabled
          ? <span className="tbv4-count" aria-hidden>—</span>
          : <span className="tbv4-count">{p.count}</span>
      )}
    </button>
  );
}

function StateRows({ Comp }: { Comp: (props: { p: PillItem; showCount?: boolean }) => React.ReactElement }) {
  return (
    <>
      <div className="tb-demo-row">
        <span className="tb-row-label">rest</span>
        {PILLS.map((p) => <Comp key={p.key} p={p} />)}
      </div>
      <div className="tb-demo-row">
        <span className="tb-row-label">hover</span>
        {/* Forced hover demonstration only works on .agent-segment-pill via real :hover.
            For V2/V4, we approximate by toggling the "On hold" pill to active to make
            its hover-target visually visible to the eye. The real test is to hover
            the rest row in the browser. */}
        {PILLS.map((p) => <Comp key={p.key} p={p} />)}
        <span style={{ fontSize: 10, color: "var(--agent-text-muted)", marginLeft: 4 }}>
          (hover any pill above to see the live state)
        </span>
      </div>
      <div className="tb-demo-row">
        <span className="tb-row-label">disabled</span>
        {PILLS.map((p, i) => <Comp key={p.key} p={{ ...p, forceDisabled: i === 4 }} />)}
      </div>
    </>
  );
}

function ConsumerSurfaces({ Comp, isTabStyle }: {
  Comp: (props: { p: PillItem; showCount?: boolean }) => React.ReactElement;
  isTabStyle: boolean;
}) {
  const filterItems: PillItem[] = FILTER_CHIPS.map((c) => ({
    key: c.label, label: c.label, count: 0, active: c.active,
  }));
  const detailItems: PillItem[] = DETAIL_TABS.map((label, i) => ({
    key: label, label, count: 0, active: i === DETAIL_TABS.length - 1,
  }));
  const monthItems: PillItem[] = FORECAST_MONTHS.map((m, i) => ({
    key: m.label, label: m.label, count: m.count, active: i === 2,
    forceDisabled: !m.populated,
  }));

  return (
    <>
      <div className="tb-mini-block">
        <div className="tb-mini-caption">Filter chips (multi-select)</div>
        <div className="tb-row">
          {filterItems.map((p) => <Comp key={p.key} p={p} showCount={false} />)}
        </div>
      </div>

      <div className="tb-mini-block">
        <div className="tb-mini-caption">Detail tabs (single-select — Activity active)</div>
        <div className="tb-row">
          {detailItems.map((p) => <Comp key={p.key} p={p} showCount={false} />)}
        </div>
        {isTabStyle && (
          <div style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 4 }}>
            V4 mirrors the existing transaction-detail .agent-tab pattern.
          </div>
        )}
      </div>

      <div className="tb-mini-block">
        <div className="tb-mini-caption">Forecast strip (12 months, populated + disabled mix)</div>
        <div className="tb-card">
          <div className="tb-row">
            <span className="tb-card-label">Exchanging soon →</span>
            {monthItems.map((p) => <Comp key={p.key} p={p} />)}
          </div>
        </div>
      </div>
    </>
  );
}

function VariantTag({ name, desc }: { name: string; desc: string }) {
  return (
    <div>
      <div className="tb-variant-tag">
        <span className="tb-variant-tag-name">{name}</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {desc}
      </p>
    </div>
  );
}

export default function TabButtonsPolishPage() {
  const [theme, setTheme] = useState<AgentTheme>("sunset");

  return (
    <div data-theme={theme} className="agent-bg tb-page">
      <style>{STYLES}</style>

      <div className="tb-chrome">
        <h1 className="tb-h1">Tab-button design — V2 vs V4 side by side</h1>
        <div className="tb-bar">
          <span className="tb-bar-label">Theme:</span>
          {AGENT_THEMES.map((t) => (
            <button
              key={t}
              className={`tb-chip${theme === t ? " on" : ""}`}
              onClick={() => setTheme(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <p style={{
          margin: "10px 0 0",
          fontSize: 12,
          color: "var(--agent-text-muted)",
          lineHeight: 1.5,
          maxWidth: 760,
        }}>
          Three sections, each with V2 on the left and V4 on the right. Section 1 renders on
          the cream page background, section 2 on a glass-strong card, section 3 applies each
          variant to the three consumer surfaces (filter chips, detail tabs, forecast strip).
          Switch themes from the bar above to verify behaviour on every theme.
        </p>
      </div>

      {/* SECTION 1 — Cream gradient (page background) */}
      <div className="tb-section">
        <h2 className="tb-section-hdr">1 · On cream gradient (page background)</h2>
        <p className="tb-section-sub">How the variant reads when the tab strip sits directly on the page surface.</p>
        <div className="tb-split">
          <div className="tb-panel tb-panel-cream">
            <VariantTag
              name="Variant 2 — Solid filled, borderless"
              desc="White-alpha 0.50 fill at rest. Hover brightens to 0.78. .on is solid coral with white text + faint coral glow shadow. Emphasises clickability via fill density."
            />
            <StateRows Comp={V2Pill} />
          </div>
          <div className="tb-panel tb-panel-cream">
            <VariantTag
              name="Variant 4 — Underline tab"
              desc="No fill, no border, no chip. Just label + count + a 2px coral underline that scales in on .on. Hover shows a partial underline preview. Pure typographic."
            />
            <StateRows Comp={V4Tab} />
          </div>
        </div>
      </div>

      {/* SECTION 2 — Glass-strong card (contained context) */}
      <div className="tb-section">
        <h2 className="tb-section-hdr">2 · On glass-strong card (contained context)</h2>
        <p className="tb-section-sub">How the variant reads when the tab strip sits inside a card surface — e.g. milestone side tabs, activity filters.</p>
        <div className="tb-split">
          <div className="tb-panel tb-panel-glass">
            <VariantTag
              name="Variant 2 — Solid filled, borderless"
              desc="Same fill values as section 1. Watch how the white-alpha reads against an already-white surface."
            />
            <StateRows Comp={V2Pill} />
          </div>
          <div className="tb-panel tb-panel-glass">
            <VariantTag
              name="Variant 4 — Underline tab"
              desc="No fill — text and underline only. The card's own background provides the surrounding visual structure."
            />
            <StateRows Comp={V4Tab} />
          </div>
        </div>
      </div>

      {/* SECTION 3 — Applied to consumer surfaces */}
      <div className="tb-section">
        <h2 className="tb-section-hdr">3 · Applied to consumer surfaces</h2>
        <p className="tb-section-sub">How the variant scales across the three production surfaces it would actually be used on.</p>
        <div className="tb-split">
          <div className="tb-panel tb-panel-cream">
            <VariantTag
              name="Variant 2 — Solid filled, borderless"
              desc="3 filter chips, 5 detail tabs, 12 forecast pills."
            />
            <ConsumerSurfaces Comp={V2Pill} isTabStyle={false} />
          </div>
          <div className="tb-panel tb-panel-cream">
            <VariantTag
              name="Variant 4 — Underline tab"
              desc="Same three surfaces. Note how 12 underline tabs read vs 12 chips."
            />
            <ConsumerSurfaces Comp={V4Tab} isTabStyle={true} />
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 24, padding: 16,
        borderRadius: 10,
        background: "rgba(0,0,0,0.04)",
        fontSize: 12, color: "var(--agent-text-muted)",
        maxWidth: 760, lineHeight: 1.55,
      }}>
        <strong style={{ color: "var(--agent-text-primary)" }}>After selection:</strong> the winning
        variant becomes the new canonical <code>.agent-segment-pill</code>. MilestonePanel and
        ActivityTimeline band-aids are removed in the same commit (retroactive theme fix on 5
        themes). This preview page is then deleted.
      </div>
    </div>
  );
}
