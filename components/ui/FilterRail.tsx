"use client";

// Canonical filter rail — the compact sidebar of collapsible facet sections
// (Type / Who / Side / Stage …), each a header with an optional count badge over
// a list of FilterCheckboxes, plus a mobile fallback that collapses the same
// sections into dropdown buttons. Extracted from the Updates feed (the old
// bespoke cf-* markup), so it's one shared part. Group-header hover uses the
// quieter --agent-hover-shade (a section opening shouldn't flash like a row), and
// the controls use the real caret icon (not a typed ▼).
//
// Self-contained open state; the first group opens by default. Pass `groups` with
// each facet's options + its selected Set + toggle. The optional glass tag lets a
// consumer bake a Design-Lab material onto the rail surface.

import { useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { FilterCheckbox } from "@/components/ui/FilterCheckbox";
import { CountBadge } from "@/components/ui/CountBadge";
import { AnchoredPanel } from "@/components/ui/Popover";

export type FilterRailGroup = {
  key: string;
  heading: string;
  options: { key: string; label: string }[];
  selected: Set<string>;
  onToggle: (k: string) => void;
};

const CSS = `
  .filter-rail { background:var(--agent-surface-glass); border:1px solid var(--agent-border-subtle); border-radius:14px; padding:5px; }
  .filter-rail-sec { border-bottom:1px solid var(--agent-border-subtle); }
  .filter-rail-sec:last-child { border-bottom:none; }
  .filter-rail-hdr { display:flex; align-items:center; justify-content:space-between; padding:11px 10px; cursor:pointer; font-size:12px; font-weight:700; color:var(--agent-text-primary); border-radius:8px; transition:background-color .14s ease; user-select:none; }
  .filter-rail-hdr:hover { background-color:var(--agent-hover-shade); }
  .filter-rail-caret { color:var(--agent-text-muted); transition:transform .22s cubic-bezier(.4,0,.2,1); }
  .filter-rail-sec.open .filter-rail-caret { transform:rotate(180deg); }
  .filter-rail-drops { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .filter-rail-dd { position:relative; }
  .filter-rail-dd-btn { display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-size:13px; font-weight:600; color:var(--agent-text-primary); background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:10px; padding:8px 12px; cursor:pointer; transition:border-color .14s ease; }
  .filter-rail-dd-btn:hover { border-color:var(--agent-coral); }
  .filter-rail-dd-btn[data-open="true"] { border-color:var(--agent-coral-deep); }
  .filter-rail-dd-btn[data-open="true"] .filter-rail-caret { transform:rotate(180deg); }
`;

function CheckRows({ group }: { group: FilterRailGroup }) {
  return (
    <>
      {group.options.map((o) => (
        <FilterCheckbox key={o.key} checked={group.selected.has(o.key)} label={o.label} onChange={() => group.onToggle(o.key)} />
      ))}
    </>
  );
}

function RailSection({ group, open, onToggleOpen }: { group: FilterRailGroup; open: boolean; onToggleOpen: () => void }) {
  return (
    <div className={`filter-rail-sec${open ? " open" : ""}`}>
      <div className="filter-rail-hdr" role="button" tabIndex={0} aria-expanded={open} onClick={onToggleOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleOpen(); } }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{group.heading}{group.selected.size > 0 && <CountBadge count={group.selected.size} solid />}</span>
        <CaretDown className="filter-rail-caret" weight="bold" style={{ width: 13, height: 13 }} />
      </div>
      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div style={{ padding: "2px 4px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            <CheckRows group={group} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({ group, open, onOpenChange }: { group: FilterRailGroup; open: boolean; onOpenChange: (next: boolean) => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="filter-rail-dd">
      <button ref={btnRef} type="button" className="filter-rail-dd-btn" data-open={open} aria-haspopup="menu" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        {group.heading}{group.selected.size > 0 && <CountBadge count={group.selected.size} solid />}<CaretDown className="filter-rail-caret" size={11} weight="bold" />
      </button>
      <AnchoredPanel anchorRef={btnRef} open={open} onClose={() => onOpenChange(false)} placement="bottom-start" width={200} bare>
        <div style={{ padding: 7 }} role="menu">
          <CheckRows group={group} />
        </div>
      </AnchoredPanel>
    </div>
  );
}

// Desktop sidebar rail (sticky column). Wrap/visibility is the page's layout job.
export function FilterRail({ groups, railClassName = "", railProps }: { groups: FilterRailGroup[]; railClassName?: string; railProps?: Record<string, unknown> }) {
  const [openSec, setOpenSec] = useState<Record<string, boolean>>(() => (groups[0] ? { [groups[0].key]: true } : {}));
  return (
    <>
      <style>{CSS}</style>
      <div className={`filter-rail ${railClassName}`.trim()} {...railProps}>
        {groups.map((g) => (
          <RailSection key={g.key} group={g} open={!!openSec[g.key]} onToggleOpen={() => setOpenSec((p) => ({ ...p, [g.key]: !p[g.key] }))} />
        ))}
      </div>
    </>
  );
}

// Mobile fallback — the same facets as dropdown buttons.
export function FilterDropdowns({ groups }: { groups: FilterRailGroup[] }) {
  const [openDd, setOpenDd] = useState<string | null>(null);
  return (
    <>
      <style>{CSS}</style>
      <div className="filter-rail-drops">
        {groups.map((g) => (
          <FilterDropdown key={g.key} group={g} open={openDd === g.key} onOpenChange={(next) => setOpenDd(next ? g.key : null)} />
        ))}
      </div>
    </>
  );
}
