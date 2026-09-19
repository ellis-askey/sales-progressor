"use client";

// All Files → Filter menu. One button on the right of the workspace bar that
// opens a multi-select popover of the smart filters, grouped into labelled
// sections (Yours / Needs attention / Service). Each row is a checkbox with a
// drawn-in tick. Same anchored-popover mechanics as the Completions card menus
// (portal to <body>, .comp-pop chrome, outside-click / scroll close); rows use
// the standard .agent-hover-row lift, not a coral wash. Selection state lives
// in FilesWorkspace — this is presentation + interaction only.

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Funnel, CaretDown } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { FilterKey } from "./segments";

export type FilterItem = { key: FilterKey; label: string; dot?: string };
export type FilterSection = { title: string; items: FilterItem[] };

function useAnchoredPopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const openPop = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); };
  }, [open, close]);

  return { open, pos, triggerRef, popRef, openPop, close };
}

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
  const { theme } = usePortalTheme();
  const { open, pos, triggerRef, popRef, openPop, close } = useAnchoredPopover();
  const n = selected.size;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`fm-btn${n > 0 ? " active" : ""}${open ? " open" : ""}`}
        aria-expanded={open}
        onClick={() => (open ? close() : openPop())}
      >
        <Funnel size={15} weight={n > 0 ? "fill" : "regular"} />
        Filter
        {n > 0 && <span className="fm-badge tabnum">{n}</span>}
        <CaretDown size={12} weight="bold" className="fm-caret" />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div data-theme={theme} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}>
          <div ref={popRef} className="comp-pop fm-pop agent-dropdown-in">
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
        </div>,
        document.body,
      )}
    </>
  );
}
