"use client";

// All Files → Filter menu. One button on the right of the workspace bar that
// opens a multi-select popover of the smart filters, grouped into labelled
// sections (Yours / Needs attention / Service). Each row is a checkbox with a
// drawn-in tick. Rides the canonical Popover primitive (portal to <body>,
// flip/shift, edge gutter, locked glass surface) in `bare` mode so the inner
// .fm-pop layer keeps its own padding + scroll. Rows use the standard
// .agent-hover-row lift, not a coral wash. Selection state lives in
// FilesWorkspace — this is presentation + interaction only.

import { Funnel, CaretDown } from "@phosphor-icons/react";
import type { FilterKey } from "./segments";
import { Popover } from "@/components/ui/Popover";

export type FilterItem = { key: FilterKey; label: string; dot?: string };
export type FilterSection = { title: string; items: FilterItem[] };

export function FilterMenu({
  sections,
  counts,
  selected,
  onToggle,
  onClear,
}: {
  sections: FilterSection[];
  counts: Record<string, number>;
  selected: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  onClear: () => void;
}) {
  const n = selected.size;

  return (
    <Popover
      preset="popover"
      bare
      placement="bottom-end"
      trigger={
        <button type="button" className={`fm-btn${n > 0 ? " active" : ""}`}>
          <Funnel size={15} weight={n > 0 ? "fill" : "regular"} />
          Filter
          {n > 0 && <span className="fm-badge tabnum">{n}</span>}
          <CaretDown size={12} weight="bold" className="fm-caret" />
        </button>
      }
    >
      <div className="fm-pop">
        <div className="fm-head">
          <span className="comp-pop-label" style={{ margin: 0 }}>Filter files</span>
          <button type="button" className="fm-clear" disabled={n === 0} onClick={onClear}>Clear</button>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="fm-section">
            <p className="fm-section-title">{section.title}</p>
            {section.items.map((f) => {
              const on = selected.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`agent-dropdown-item fm-row${on ? " on" : ""}`}
                  onClick={() => onToggle(f.key)}
                >
                  <span className="fm-cbx" aria-hidden>
                    <svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7" /></svg>
                  </span>
                  {f.dot && <span className={`fm-dot fm-dot--${f.dot}`} />}
                  <span className="fm-lbl">{f.label}</span>
                  <span className="fm-cnt tabnum">{counts[f.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        ))}

        <p className="fm-foot">
          {n === 0
            ? "Nothing ticked shows every active file."
            : "Rows in a section widen the match; sections narrow it."}
        </p>
      </div>
    </Popover>
  );
}
