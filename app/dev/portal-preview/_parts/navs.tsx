"use client";

// The two chosen navs, portal-tuned:
//   TOP  — T8 "Expandable corner": the time-of-day greeting + a menu that fans
//          the real drawer sections (Documents / Information / Settings /
//          Customisation) down. Tapping a section opens the real menu drawer.
//   BOTTOM — B5 "Magnify dock" + the label fix: the SELECTED tab magnifies and
//          reveals its label; the others stay icon-only. So the dock stays
//          compact yet always names where you are.

import { useState } from "react";
import { House, ClockCounterClockwise, ChatCircle, List, X } from "@phosphor-icons/react";
import { NavGlass, usePreview, useSpringValue, type ActiveStyle } from "./glass";

// The selectable "you're on this page" indicators for the dock.
export const ACTIVE_STYLES: { id: ActiveStyle; label: string }[] = [
  { id: "underline", label: "Underline" },
  { id: "dot", label: "Dot" },
  { id: "topbar", label: "Top bar" },
  { id: "lift", label: "Lifted glow" },
  { id: "glass", label: "Raised glass" },
  { id: "outline", label: "Outline" },
  { id: "solid", label: "Solid pill" },
  { id: "plain", label: "Colour only" },
];

export type ScreenKey = "overview" | "progress" | "updates";
type Tab = { key: ScreenKey; label: string; Icon: typeof House; badge?: number };
const TABS: Tab[] = [
  { key: "overview", label: "Overview", Icon: House },
  { key: "progress", label: "Progress", Icon: ClockCounterClockwise },
  { key: "updates", label: "Updates", Icon: ChatCircle, badge: 2 },
];

const SECTIONS = ["Documents", "Information", "Settings", "Customisation"];

// ── Top: expandable corner ───────────────────────────────────────────────────
export function TopCornerNav({ onOpenMenu }: { onOpenMenu?: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  const t = useSpringValue(open ? 1 : 0, 0.5, 0.4);
  return (
    <div className="ppv-top">
      <NavGlass radius={999} className="ppv-greet"><span>Good evening, Priya</span></NavGlass>
      <div className="ppv-corner">
        <NavGlass radius={999} className="ppv-menu">
          <button type="button" className="ppv-menu-btn" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X size={18} weight="bold" /> : <List size={18} weight="regular" />}
          </button>
        </NavGlass>
        <div className="ppv-fan" style={{ pointerEvents: open ? "auto" : "none" }}>
          {SECTIONS.map((sec, i) => (
            <div key={sec} className="ppv-fan-item" style={{ opacity: t, transform: `translateY(${(1 - t) * (-6 - i * 6)}px) scale(${0.94 + t * 0.06})` }}>
              <NavGlass radius={999} className="ppv-fan-pill">
                <button type="button" className="ppv-fan-pill-btn" onClick={() => { onOpenMenu?.(sec); setOpen(false); }}>{sec}</button>
              </NavGlass>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bottom: magnify dock with the selected-tab label ─────────────────────────
// The selected tab magnifies into a horizontal accent pill (icon + label side by
// side); the others stay as plain icons. Everything sits on ONE row at a uniform
// height, so there is no dead space above the unselected icons — the active tab
// grows sideways, not downward.
function MagnifyTab({ tab, active, onSelect }: { tab: Tab; active: boolean; onSelect: (k: ScreenKey) => void }) {
  const { Icon } = tab;
  // Colour + the chosen indicator are driven entirely by CSS (data-on + the
  // dock's ppv-act-* class) so switching indicators needs no JS.
  return (
    <button type="button" className="ppv-mt" data-on={active ? "1" : undefined} onClick={() => onSelect(tab.key)} aria-label={tab.label} aria-current={active ? "page" : undefined}>
      <span className="ppv-mt-ico">
        <Icon size={23} weight={active ? "fill" : "regular"} />
        {tab.badge && !active ? <span className="ppv-badge">{tab.badge}</span> : null}
      </span>
      <span className="ppv-mt-lbl" data-on={active ? "1" : undefined}>{tab.label}</span>
    </button>
  );
}

export function MagnifyDock({ active, setActive }: { active: ScreenKey; setActive: (k: ScreenKey) => void }) {
  const s = usePreview();
  return (
    <NavGlass radius={28} className={`ppv-dock ppv-act-${s.active}`}>
      {TABS.map((t) => <MagnifyTab key={t.key} tab={t} active={t.key === active} onSelect={setActive} />)}
    </NavGlass>
  );
}
