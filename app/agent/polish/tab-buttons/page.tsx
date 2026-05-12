"use client";

/* Tab-button design exploration page.
 *
 * Temporary preview at /agent/polish/tab-buttons. Six distinct visual approaches
 * for tab/pill buttons across the app, rendered against both the cream
 * page-gradient background and a glass-strong card surface. Ellis walks the
 * page, picks a winner, then the winner becomes the new canonical
 * .agent-segment-pill (replacing the bb72c88 bump + retiring the band-aid
 * overrides on MilestonePanel and ActivityTimeline).
 *
 * After selection: delete this file. It is not a permanent dev surface. */

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

/* ── Variant section layout ─────────────────────────────────────────── */
.tb-variant { margin-bottom: 56px; }
.tb-variant-hdr { margin-bottom: 14px; }
.tb-variant-num { font-size: 11px; font-weight: 700; color: var(--agent-coral-deep); text-transform: uppercase; letter-spacing: 0.08em; }
.tb-variant-name { font-size: 17px; font-weight: 700; color: var(--agent-text-primary); margin: 2px 0 4px; }
.tb-variant-desc { font-size: 13px; color: var(--agent-text-secondary); line-height: 1.45; max-width: 720px; }

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
.tb-panel-label {
  font-size: 10px; font-weight: 600; color: var(--agent-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px;
}
.tb-demo-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.tb-demo-row:last-child { margin-bottom: 0; }
.tb-row-label {
  font-size: 10px; color: var(--agent-text-muted);
  font-family: monospace; width: 64px; flex-shrink: 0;
}
.tb-mini-section { margin-top: 18px; padding-top: 16px; border-top: 0.5px dashed var(--agent-border-default); }
.tb-mini-label { font-size: 10px; font-weight: 600; color: var(--agent-text-muted); margin-bottom: 8px; }
.tb-mini-block { margin-bottom: 12px; }
.tb-mini-block:last-child { margin-bottom: 0; }
.tb-mini-caption { font-size: 10px; color: var(--agent-text-muted); font-style: italic; margin-bottom: 4px; }

/* ── VARIANT 1 — current canonical (reference) ───────────────────────────
 * Uses the actual .agent-segment-pill / .agent-segment-pill-sm classes
 * shipped at bb72c88. No override here — this is the baseline. */
.tbv1-count {
  font-size: 10px; font-weight: 500;
  padding: 1px 7px; border-radius: 99px;
  background: rgba(0,0,0,0.06); color: var(--agent-text-muted);
}
.tbv1-pill.on .tbv1-count {
  background: rgba(var(--agent-coral-rgb), 0.12);
  color: var(--agent-coral-deep);
}

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

/* ── VARIANT 3 — strong outline, transparent fill ─────────────────────── */
.tbv3-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 6px;
  background: transparent;
  border: 1.5px solid rgba(var(--agent-text-primary-rgb, 30, 45, 74), 0.28);
  color: var(--agent-text-secondary);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms;
}
.tbv3-pill:hover:not(.tbv3-disabled):not(.on) {
  background: rgba(255,255,255,0.22);
  border-color: rgba(var(--agent-text-primary-rgb, 30, 45, 74), 0.42);
  color: var(--agent-text-primary);
}
.tbv3-pill.on {
  border-color: var(--agent-coral-deep);
  background: rgba(var(--agent-coral-rgb), 0.10);
  color: var(--agent-coral-deep);
}
.tbv3-disabled { opacity: 0.40; cursor: default; pointer-events: none; }
.tbv3-count {
  font-size: 10px; font-weight: 600;
  padding: 0 6px; border-radius: 99px;
  background: rgba(0,0,0,0.05);
  color: inherit;
}
.tbv3-pill.on .tbv3-count { background: rgba(var(--agent-coral-rgb), 0.18); }

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

/* ── VARIANT 5 — soft card chip with shadow lift ──────────────────────── */
.tbv5-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 13px; border-radius: 9px;
  background: rgba(255,255,255,0.38);
  border: 0.5px solid rgba(255,255,255,0.65);
  color: var(--agent-text-secondary);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: all 130ms cubic-bezier(0.16, 1, 0.3, 1);
}
.tbv5-pill:hover:not(.tbv5-disabled):not(.on) {
  background: rgba(255,255,255,0.62);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0,0,0,0.08);
  color: var(--agent-text-primary);
}
.tbv5-pill.on {
  background: var(--agent-coral-bg-tint);
  border-color: rgba(var(--agent-coral-rgb), 0.40);
  color: var(--agent-coral-deep);
  box-shadow: 0 2px 6px rgba(var(--agent-coral-rgb), 0.20);
  font-weight: 600;
}
.tbv5-disabled { opacity: 0.40; cursor: default; pointer-events: none; box-shadow: none; }
.tbv5-count {
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 99px;
  background: rgba(0,0,0,0.06); color: inherit;
}
.tbv5-pill.on .tbv5-count { background: rgba(var(--agent-coral-rgb), 0.16); color: var(--agent-coral-deep); }

/* ── VARIANT 6 — segmented control (iOS-style) ────────────────────────── */
.tbv6-track {
  display: inline-flex;
  background: rgba(0,0,0,0.05);
  border-radius: 9px;
  padding: 3px;
  gap: 2px;
}
.tbv6-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 7px;
  background: transparent; border: none;
  color: var(--agent-text-secondary);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background 130ms, color 130ms;
}
.tbv6-pill:hover:not(.tbv6-disabled):not(.on) {
  background: rgba(255,255,255,0.40);
  color: var(--agent-text-primary);
}
.tbv6-pill.on {
  background: white;
  color: var(--agent-text-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04);
}
.tbv6-disabled { opacity: 0.38; cursor: default; pointer-events: none; }
.tbv6-count {
  font-size: 10px; font-weight: 500;
  color: var(--agent-text-muted);
}
.tbv6-pill.on .tbv6-count { color: var(--agent-coral-deep); font-weight: 600; }

/* ── Mock "card" panel for the mini-mockup forecast/filter context ────── */
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

type DemoVariant = {
  num: string;
  name: string;
  desc: string;
  prefix: string;          // CSS class prefix, e.g. "tbv2"
  pill: (p: typeof PILLS[number] & { forceHover?: boolean; forceDisabled?: boolean }) => React.ReactNode;
  // Layout wrapper for the 5-pill row (e.g. variant 6 wraps in a track)
  group?: (children: React.ReactNode) => React.ReactNode;
  // Whether to render the .on state with an underline (v4) — for the active count
};

function makeBase(prefix: string): DemoVariant["pill"] {
  return (p) => {
    const cls = `${prefix}-pill${p.active ? " on" : ""}${p.forceDisabled ? ` ${prefix}-disabled` : ""}`;
    return (
      <button key={p.key} className={cls} aria-disabled={p.forceDisabled || undefined}>
        {p.label}
        {p.count === 0 && p.forceDisabled
          ? <span className={`${prefix}-count`} aria-hidden>—</span>
          : <span className={`${prefix}-count`}>{p.count}</span>}
      </button>
    );
  };
}

function makeV4(): DemoVariant["pill"] {
  return (p) => {
    const cls = `tbv4-tab${p.active ? " on" : ""}${p.forceDisabled ? " tbv4-disabled" : ""}`;
    return (
      <button key={p.key} className={cls} aria-disabled={p.forceDisabled || undefined}>
        {p.label}
        {p.count === 0 && p.forceDisabled
          ? <span className="tbv4-count" aria-hidden>—</span>
          : <span className="tbv4-count">{p.count}</span>}
      </button>
    );
  };
}

function PillRow({ variant, hover, disabledLast }: { variant: DemoVariant; hover?: boolean; disabledLast?: boolean }) {
  const items = PILLS.map((p, i) => ({
    ...p,
    forceHover: hover && i === 2,
    forceDisabled: disabledLast && i === 4,
  }));
  const inner = items.map(variant.pill);
  return <>{variant.group ? variant.group(inner) : inner}</>;
}

function VariantBlock({ variant }: { variant: DemoVariant }) {
  return (
    <div className="tb-variant">
      <div className="tb-variant-hdr">
        <div className="tb-variant-num">Variant {variant.num}</div>
        <div className="tb-variant-name">{variant.name}</div>
        <div className="tb-variant-desc">{variant.desc}</div>
      </div>

      <div className="tb-split">
        {/* Left — cream gradient */}
        <div className="tb-panel tb-panel-cream">
          <div className="tb-panel-label">On cream gradient (page background)</div>

          <div className="tb-demo-row">
            <span className="tb-row-label">rest</span>
            <PillRow variant={variant} />
          </div>
          <div className="tb-demo-row">
            <span className="tb-row-label">hover</span>
            <PillRow variant={variant} hover />
          </div>
          <div className="tb-demo-row">
            <span className="tb-row-label">disabled</span>
            <PillRow variant={variant} disabledLast />
          </div>

          <ConsumerMiniMockup variant={variant} />
        </div>

        {/* Right — glass-strong card */}
        <div className="tb-panel tb-panel-glass">
          <div className="tb-panel-label">On glass-strong card (contained context)</div>

          <div className="tb-demo-row">
            <span className="tb-row-label">rest</span>
            <PillRow variant={variant} />
          </div>
          <div className="tb-demo-row">
            <span className="tb-row-label">hover</span>
            <PillRow variant={variant} hover />
          </div>
          <div className="tb-demo-row">
            <span className="tb-row-label">disabled</span>
            <PillRow variant={variant} disabledLast />
          </div>

          <ConsumerMiniMockup variant={variant} />
        </div>
      </div>
    </div>
  );
}

function ConsumerMiniMockup({ variant }: { variant: DemoVariant }) {
  return (
    <div className="tb-mini-section">
      <div className="tb-mini-label">Applied to consumer surfaces</div>

      <div className="tb-mini-block">
        <div className="tb-mini-caption">Filter chips (3, multi-select)</div>
        <div className="tb-row">
          {FILTER_CHIPS.map((c) => {
            const fake = { key: c.label, label: c.label, count: 0, active: c.active };
            // Reuse the pill renderer but suppress the count (chip has no count)
            const cls = `${variant.prefix}-pill${c.active ? " on" : ""}`;
            if (variant.prefix === "tbv4") {
              return (
                <button key={c.label} className={`tbv4-tab${c.active ? " on" : ""}`}>
                  {c.label}
                </button>
              );
            }
            return (
              <button key={c.label} className={cls}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tb-mini-block">
        <div className="tb-mini-caption">Detail tabs (5, single-select — Activity active)</div>
        <div className="tb-row">
          {(() => {
            const tabs = DETAIL_TABS.map((label, i) => ({
              key: label, label, count: 0, active: i === DETAIL_TABS.length - 1,
            }));
            const inner = tabs.map((t) => {
              if (variant.prefix === "tbv4") {
                return (
                  <button key={t.label} className={`tbv4-tab${t.active ? " on" : ""}`}>
                    {t.label}
                  </button>
                );
              }
              const cls = `${variant.prefix}-pill${t.active ? " on" : ""}`;
              return <button key={t.label} className={cls}>{t.label}</button>;
            });
            return variant.group ? variant.group(inner) : inner;
          })()}
        </div>
      </div>

      <div className="tb-mini-block">
        <div className="tb-mini-caption">Forecast strip (12, populated + disabled mix)</div>
        <div className="tb-card">
          <div className="tb-row">
            <span className="tb-card-label">Exchanging soon →</span>
            {(() => {
              const months = FORECAST_MONTHS.map((m, i) => ({
                key: m.label, label: m.label, count: m.count, active: i === 2, // Jul "on"
                forceDisabled: !m.populated,
              }));
              const inner = months.map((m) => {
                if (variant.prefix === "tbv4") {
                  return (
                    <button
                      key={m.label}
                      className={`tbv4-tab${m.active ? " on" : ""}${m.forceDisabled ? " tbv4-disabled" : ""}`}
                      aria-disabled={m.forceDisabled || undefined}
                    >
                      {m.label}
                      {m.forceDisabled
                        ? <span className="tbv4-count" aria-hidden>—</span>
                        : <span className="tbv4-count">{m.count}</span>}
                    </button>
                  );
                }
                const cls = `${variant.prefix}-pill${m.active ? " on" : ""}${m.forceDisabled ? ` ${variant.prefix}-disabled` : ""}`;
                return (
                  <button key={m.label} className={cls} aria-disabled={m.forceDisabled || undefined}>
                    {m.label}
                    {m.forceDisabled
                      ? <span className={`${variant.prefix}-count`} aria-hidden>—</span>
                      : <span className={`${variant.prefix}-count`}>{m.count}</span>}
                  </button>
                );
              });
              return variant.group ? variant.group(inner) : inner;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Variant 1 uses the actual canonical class, not a tbv1- prefix ──── */
function Variant1Pill(p: typeof PILLS[number] & { forceHover?: boolean; forceDisabled?: boolean }) {
  const cls = `agent-segment-pill agent-segment-pill-sm${p.active ? " on" : ""}`;
  // No forced-hover for the canonical — hover state is :hover only. We do
  // demonstrate it but acknowledge it can only be seen by hovering the row.
  return (
    <button key={p.key} className={cls} disabled={p.forceDisabled} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <span>{p.label}</span>
      {p.count === 0 && p.forceDisabled
        ? <span className="tbv1-count" aria-hidden>—</span>
        : <span className="tbv1-count">{p.count}</span>}
    </button>
  );
}

const VARIANTS: DemoVariant[] = [
  {
    num: "1",
    name: "Current canonical (baseline reference)",
    desc: "What .agent-segment-pill renders today post-bb72c88: white-alpha 0.14 bg, theme-dark 0.18 border, coral-tinted hover. Reference only — not tuned. Hover state on this row only fires when you actually hover (the .forceHover marker doesn't apply).",
    prefix: "tbv1",
    pill: Variant1Pill,
  },
  {
    num: "2",
    name: "Solid filled, borderless",
    desc: "Emphasises clickability via fill density. White-alpha 0.50 at rest reads as a definite chip; hover brightens; .on is solid coral with white text. Best for surfaces where you want the tab group to feel button-like.",
    prefix: "tbv2",
    pill: makeBase("tbv2"),
  },
  {
    num: "3",
    name: "Strong outline, transparent fill",
    desc: "Emphasises discreteness via crisp edge. 1.5px theme-dark border at 0.28 alpha; transparent fill; hover fills lightly. .on is full coral border + coral text + faint coral bg. Best when you want tabs to read as buttons but not compete visually with content.",
    prefix: "tbv3",
    pill: makeBase("tbv3"),
  },
  {
    num: "4",
    name: "Underline tab (no pill)",
    desc: "Pure typographic. No bg, no border — just label, count, and a 2px coral underline on the active tab. Hover shows a thin partial underline. Matches transaction-detail's existing .agent-tab pattern. Best when the surrounding surface already provides visual structure.",
    prefix: "tbv4",
    pill: makeV4(),
  },
  {
    num: "5",
    name: "Soft card chip (shadow lift)",
    desc: "Each pill is its own mini-card: rounded, subtle 0.5px hairline, faint shadow at rest. Hover lifts (translateY -1px + stronger shadow). .on uses coral-tint bg + coral border + heavier shadow. Tactile, slightly more present than canonical.",
    prefix: "tbv5",
    pill: makeBase("tbv5"),
  },
  {
    num: "6",
    name: "Segmented control (iOS-style)",
    desc: "The whole tab group sits in a unified track (black 0.05 bg, rounded corners, 3px inner padding). Active tab is a raised white card with shadow, sits inside the track. Inactive tabs are just text on the track. Makes group identity obvious — best for closed sets of mutually-exclusive options.",
    prefix: "tbv6",
    pill: makeBase("tbv6"),
    group: (children) => <div className="tbv6-track">{children}</div>,
  },
];

export default function TabButtonsPolishPage() {
  const [theme, setTheme] = useState<AgentTheme>("sunset");

  return (
    <div data-theme={theme} className="agent-bg tb-page">
      <style>{STYLES}</style>

      <div className="tb-chrome">
        <h1 className="tb-h1">Tab-button design exploration — /agent/polish/tab-buttons</h1>
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
          Six visual approaches for tab/pill buttons across the app. Each variant rendered against
          both the cream page-gradient background (left) and a glass-strong card surface (right),
          with three states demonstrated (rest, hover-on-third-pill, disabled-on-last). Below each
          state row, a mini-mockup shows the variant applied to three consumer surfaces — filter
          chips, detail tabs, and the forecast strip — so the variant&rsquo;s behaviour at scale
          is visible alongside the canonical 5-pill demo.
        </p>
      </div>

      {VARIANTS.map((v) => <VariantBlock key={v.num} variant={v} />)}

      <div style={{
        marginTop: 24, padding: 16,
        borderRadius: 10,
        background: "rgba(0,0,0,0.04)",
        fontSize: 12, color: "var(--agent-text-muted)",
        maxWidth: 760, lineHeight: 1.55,
      }}>
        <strong style={{ color: "var(--agent-text-primary)" }}>After selection:</strong> the winning
        variant becomes the new canonical <code>.agent-segment-pill</code>. The MilestonePanel
        and ActivityTimeline band-aid overrides get removed in the same commit (retroactive
        theme fix). All other consumer surfaces inherit the new canonical with no per-surface
        edits. This preview page is then deleted — it is a one-time exploration, not a permanent
        dev surface.
      </div>
    </div>
  );
}
