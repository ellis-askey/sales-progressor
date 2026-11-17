"use client";

// Disposable /dev prototype for the mobile top-bar search (Ellis's brief):
// on a phone the search is just an icon; tapping it grows the icon into a
// full-bar field, fades the other bar controls out, and drops a panel of
// results below the bar. Typing filters; an X in a grey circle (or selecting
// a result, or Esc) collapses it back to the icon. The expansion borrows the
// ported Bencho "Seek" idea — ONE object whose WIDTH is the state, with the
// lens pinned at a fixed left inset so it reads as the box growing around a
// mark that stayed put — scaled up to the whole nav bar.
//
// Data: the real NAV_ITEMS (empty query → "Go to") plus a small mock result
// set so the "typing filters the results" behaviour reads true. In production
// this list comes from /api/agent/search (debounced, 2-char min) exactly as
// AgentGlobalSearch does today.

import { useEffect, useMemo, useRef, useState } from "react";
import "./mobile-search.css";

type Item = { id: string; label: string; sub: string; kind: "go" | "file" | "client" | "sol" };

// The real top-bar destinations (AgentGlobalSearch NAV_ITEMS), shown on an
// empty query under "Go to".
const NAV_ITEMS: Item[] = [
  { id: "hub", label: "Hub", sub: "Your pipeline overview", kind: "go" },
  { id: "reminders", label: "Reminders", sub: "Due and overdue chasers", kind: "go" },
  { id: "completions", label: "Completions", sub: "Files ready to complete", kind: "go" },
  { id: "files", label: "My Files", sub: "All your property files", kind: "go" },
  { id: "updates", label: "Updates", sub: "Portal activity", kind: "go" },
  { id: "analytics", label: "Analytics", sub: "Pipeline and fee data", kind: "go" },
  { id: "newsale", label: "New sale", sub: "Register a new property", kind: "go" },
];

// Mock "remote" results so the filter reads like the real search (which hits
// /api/agent/search over properties / clients / solicitors).
const MOCK: Item[] = [
  { id: "f1", label: "14 Oakfield Road", sub: "Jordan Blake · Exchange", kind: "file" },
  { id: "f2", label: "3 Mornington Crescent", sub: "Priya Shah · Enquiries", kind: "file" },
  { id: "f3", label: "28 Harbour View", sub: "The Achilleas · Completed", kind: "file" },
  { id: "c1", label: "Jordan Blake", sub: "Buyer · 14 Oakfield Road", kind: "client" },
  { id: "c2", label: "Priya Shah", sub: "Seller · 3 Mornington Crescent", kind: "client" },
  { id: "s1", label: "Gough Thorne", sub: "Solicitor · buyer side", kind: "sol" },
];

const KIND_LABEL: Record<Item["kind"], string> = {
  go: "Go to",
  file: "Files",
  client: "People",
  sol: "Solicitors",
};
const GROUP_ORDER: Item["kind"][] = ["go", "file", "client", "sol"];

export function MobileNavSearch() {
  const root = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const beat = useRef<number>(0);
  const burst = useRef<number>(0);

  const [open, setOpen] = useState(false);
  const [press, setPress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [openW, setOpenW] = useState(300);
  const [sel, setSel] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  // The open width is the bar's inner width (its content box). Measured, not
  // assumed, so it's right on every phone and after a rotation — same reason
  // Seek measures rather than hard-coding.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      setOpenW(Math.max(120, el.clientWidth - padL - padR));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { window.clearTimeout(beat.current); window.clearTimeout(burst.current); }, []);

  // The filtered, grouped result list. Empty query → the "Go to" destinations;
  // otherwise a substring match over label + sub across nav items and the mock
  // remote set (stand-in for /api/agent/search).
  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pool = query ? [...NAV_ITEMS, ...MOCK] : NAV_ITEMS;
    const hits = query
      ? pool.filter((i) => i.label.toLowerCase().includes(query) || i.sub.toLowerCase().includes(query))
      : pool;
    const flat = hits;
    const byKind = GROUP_ORDER
      .map((k) => ({ kind: k, items: flat.filter((i) => i.kind === k) }))
      .filter((g) => g.items.length > 0);
    return { byKind, flat };
  }, [q]);

  // Keep the keyboard selection in range as the list shrinks/grows.
  useEffect(() => { setSel((s) => Math.min(s, Math.max(0, groups.flat.length - 1))); }, [groups.flat.length]);

  function expand() {
    if (open) return;
    setPress(true);
    window.clearTimeout(beat.current);
    // Yield, then expand, then focus — the caret is already placed as the
    // field arrives (Seek's 90ms press beat).
    beat.current = window.setTimeout(() => {
      setPress(false);
      setOpen(true);
      requestAnimationFrame(() => field.current?.focus());
    }, 90);
  }

  function collapse() {
    setOpen(false);
    setQ("");
    setSel(0);
    field.current?.blur();
  }

  function choose(item: Item) {
    // A selection flashes the row, then the bar goes back to an icon — the
    // real version would router.push(href) here.
    setPicked(item.id);
    window.setTimeout(() => { setPicked(null); collapse(); }, 180);
  }

  // One short lens beat per burst of typing, not one per key (Seek's rule).
  function tapped() {
    setBusy(true);
    window.clearTimeout(burst.current);
    burst.current = window.setTimeout(() => setBusy(false), 340);
  }

  return (
    <div
      ref={root}
      className="mns-root"
      data-open={open || undefined}
      data-press={press || undefined}
      data-busy={busy || undefined}
      style={{ "--open-w": `${openW}px` } as React.CSSProperties}
    >
      {/* the scrim dims the page behind the drop-down; a tap on it collapses */}
      <button className="mns-scrim" aria-hidden={!open} tabIndex={-1} onClick={collapse} />

      <div className="mns-bar" ref={bar}>
        {/* the bar's resident controls — faded + inert while the field is open */}
        <div className="mns-chrome">
          <span className="mns-icon-btn" aria-hidden>
            <svg viewBox="0 0 22 22" width="20" height="20"><path d="M4 6.5h14M4 11h14M4 15.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </span>
          <span className="mns-brand">Hub</span>
        </div>
        <div className="mns-chrome mns-chrome-right">
          <span className="mns-icon-btn" aria-hidden>
            <svg viewBox="0 0 22 22" width="19" height="19"><path d="M18 11a7 7 0 1 1-2.05-4.95M18 4v3.2h-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </span>
          <span className="mns-icon-btn" aria-hidden>
            <svg viewBox="0 0 22 22" width="19" height="19"><path d="M11 3.5a5 5 0 0 0-5 5v3l-1.5 2.5h13L16 11.5v-3a5 5 0 0 0-5-5ZM9 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </span>
        </div>
        {/* reserves the far-right 40px for the (absolutely-positioned) search
            icon, so the resting icon never sits on top of the bell */}
        <span className="mns-search-slot" aria-hidden />

        {/* the one object: icon at rest, field when open. Right-anchored, so it
            grows leftward out of the icon — the lens slides left across the bar
            and the clear button lands where the icon was. */}
        <div className="mns-search" data-open={open || undefined}>
          <svg className="mns-lens" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="7.6" cy="7.6" r="5.4" />
            <path d="M11.6 11.6 L15.4 15.4" />
          </svg>

          <input
            ref={field}
            className="mns-field"
            type="text"
            value={q}
            placeholder="Search addresses, clients, solicitors…"
            aria-label="Search"
            tabIndex={open ? 0 : -1}
            onChange={(e) => { setQ(e.target.value); setSel(0); tapped(); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); collapse(); return; }
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, groups.flat.length - 1)); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); return; }
              if (e.key === "Enter") { e.preventDefault(); const it = groups.flat[sel]; if (it) choose(it); return; }
            }}
          />

          {/* clear — a neat X in a light grey circle. Collapses back to the icon. */}
          {open && (
            <button className="mns-clear" aria-label="Close search" onClick={collapse}>
              <svg viewBox="0 0 16 16" width="13" height="13"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </button>
          )}

          {/* the way in, only while shut */}
          {!open && <button className="mns-hit" aria-label="Open search" onClick={expand} />}
        </div>
      </div>

      {/* the drop-down: the bar's own results surface, sliding down beneath it */}
      <div className="mns-drop" role="listbox" aria-label="Search results">
        {groups.flat.length === 0 ? (
          <div className="mns-empty">No matches for “{q.trim()}”</div>
        ) : (
          groups.byKind.map((g) => (
            <div className="mns-group" key={g.kind}>
              <div className="mns-group-h">{KIND_LABEL[g.kind]}</div>
              {g.items.map((it) => {
                const idx = groups.flat.indexOf(it);
                return (
                  <button
                    key={it.id}
                    role="option"
                    aria-selected={idx === sel}
                    className="mns-row"
                    data-sel={idx === sel || undefined}
                    data-picked={picked === it.id || undefined}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => choose(it)}
                  >
                    <span className="mns-row-dot" data-kind={it.kind} aria-hidden />
                    <span className="mns-row-text">
                      <span className="mns-row-label">{it.label}</span>
                      <span className="mns-row-sub">{it.sub}</span>
                    </span>
                    <svg className="mns-row-go" viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                  </button>
                );
              })}
            </div>
          ))
        )}
        <div className="mns-foot">↑↓ navigate · ↵ go · Esc close · type to search</div>
      </div>
    </div>
  );
}
