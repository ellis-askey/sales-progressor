"use client";
// TSP library · Navigation. Interactive, TSP-styled, sourced where possible.
// Uses the lens for the floating dock (a floating control, per the material
// doctrine); token fills for in-flow chrome. Registry in NAV_REG below.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  House, Bell, ChatCircle, Gear, MagnifyingGlass, Users, CaretRight, CaretLeft,
  List, X, ArrowRight, CalendarBlank, Path, FolderOpen,
} from "@phosphor-icons/react";
import { cn, useSpringTo, useEnv, Lens, Frost, Portal } from "./lib";
import { TravellingSelection } from "./foundation";
import type { RegEntry } from "./registry";

/* ── Tabs — the TravellingSelection primitive (shared with Segmented, so the
      moving-glass selection language is coherent across the library). ───────── */
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string }[] }) {
  return <TravellingSelection variant="tabs" ariaLabel="Views" value={value} onChange={onChange} items={tabs.map((t) => ({ value: t.value, label: t.label }))} />;
}

/* ── NavRail — vertical icon+label rail ──────────────────────────────────────── */
const RAIL = [{ k: "hub", icon: House, label: "Hub" }, { k: "updates", icon: ChatCircle, label: "Updates" }, { k: "people", icon: Users, label: "People" }, { k: "settings", icon: Gear, label: "Settings" }];
export function NavRail() {
  const [active, setActive] = useState("hub");
  return (
    <nav className="tl-rail" aria-label="Primary">
      {RAIL.map((i) => { const Icon = i.icon; return (
        <button key={i.k} className="tl-rail-item" data-on={active === i.k || undefined} aria-current={active === i.k ? "page" : undefined} onClick={() => setActive(i.k)}>
          <Icon weight={active === i.k ? "fill" : "regular"} /><span>{i.label}</span>
        </button>
      ); })}
    </nav>
  );
}

/* ── Sidebar — collapsible sections + collapse toggle ────────────────────────── */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("hub");
  const items = [{ k: "hub", icon: House, label: "Hub" }, { k: "files", icon: FolderOpen, label: "Files" }, { k: "updates", icon: ChatCircle, label: "Updates" }, { k: "people", icon: Users, label: "People" }, { k: "settings", icon: Gear, label: "Settings" }];
  return (
    <aside className={cn("tl-sidebar", collapsed && "tl-sidebar--collapsed")} aria-label="Sidebar">
      <div className="tl-sidebar-head">{!collapsed && <strong>Harpers Estates</strong>}<button className="tl-sidebar-toggle" aria-label={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed((c) => !c)}><List weight="bold" /></button></div>
      <div className="tl-sidebar-sec">{!collapsed && <span className="tl-sidebar-lab">Workspace</span>}
        {items.map((i) => { const Icon = i.icon; return (
          <button key={i.k} className="tl-sidebar-item" data-on={active === i.k || undefined} onClick={() => setActive(i.k)} title={collapsed ? i.label : undefined}>
            <Icon weight={active === i.k ? "fill" : "regular"} />{!collapsed && <span>{i.label}</span>}
          </button>
        ); })}
      </div>
    </aside>
  );
}

/* ── Toolbar — grouped actions + overflow ────────────────────────────────────── */
export function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="tl-toolbar" role="toolbar" aria-label="Actions">
      <div className="tl-toolbar-group">
        <button className="tl-tbtn" aria-label="Back"><CaretLeft weight="bold" /></button>
        <button className="tl-tbtn" aria-label="Forward"><CaretRight weight="bold" /></button>
      </div>
      <span className="tl-toolbar-div" />
      <div className="tl-toolbar-group">{children ?? <>
        <button className="tl-tbtn tl-tbtn--text"><Bell weight="regular" /> Chase</button>
        <button className="tl-tbtn tl-tbtn--text"><CalendarBlank weight="regular" /> Book</button>
      </>}</div>
      <span className="tl-toolbar-grow" />
      <button className="tl-tbtn tl-tbtn--primary"><ArrowRight weight="bold" /> Open file</button>
    </div>
  );
}

/* ── FloatingDock — LENS bar (a floating control → the lens is correct here).
      macOS-dock craft: spring hover-magnify with NEIGHBOUR FALLOFF, press
      scale-down, a travelling frosted pill behind the active icon (same selection
      language as Segmented/Tabs), arrow-key roving focus. Reimplemented on
      spring.ts (framer-motion not approved). Reduced-motion drops the magnify. ── */
const DOCK = [{ icon: House, label: "Hub" }, { icon: MagnifyingGlass, label: "Search" }, { icon: ChatCircle, label: "Updates" }, { icon: Bell, label: "Alerts" }, { icon: Gear, label: "Settings" }];
const MAGNIFY = 0.36; // hovered icon scale lift; neighbours fall off over 2 cells

function DockButton({ Icon, label, on, target, onHover, onLeave, onActivate, reduced, tabIndex, btnRef }:
  { Icon: typeof House; label: string; on: boolean; target: number; onHover: () => void; onLeave: () => void; onActivate: () => void; reduced: boolean; tabIndex: number; btnRef: (el: HTMLButtonElement | null) => void }) {
  const [press, setPress] = useState(false);
  const s = useSpringTo(target, 0.3, 0.3, !reduced);
  const lift = useSpringTo(target > 1.01 ? -(target - 1) * 18 : 0, 0.3, 0.32, !reduced);
  const ps = useSpringTo(press ? 0.9 : 1, 0.24, 0.42, !reduced);
  return (
    <button ref={btnRef} className="tl-dock-btn" data-on={on || undefined} aria-label={label} title={label} tabIndex={tabIndex}
      style={{ transform: `translateY(${lift.toFixed(1)}px) scale(${(s * ps).toFixed(3)})` }}
      onMouseEnter={onHover} onMouseLeave={onLeave} onFocus={onHover} onBlur={onLeave}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)} onClick={onActivate}>
      <Icon weight={on ? "fill" : "regular"} />
    </button>
  );
}
export function FloatingDock() {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const { reducedMotion, reducedTransparency } = useEnv();
  const x = useSpringTo(active, 0.36, 0.34, !reducedMotion);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const target = (i: number) => { if (reducedMotion || hover == null) return 1; return 1 + MAGNIFY * Math.max(0, 1 - Math.abs(i - hover) / 2); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = Math.max(0, Math.min(DOCK.length - 1, active + (e.key === "ArrowRight" ? 1 : -1)));
    setActive(n); refs.current[n]?.focus();
  };
  const row = (
    <div className="tl-dock-row" role="toolbar" aria-label="Quick switch" onKeyDown={onKey} onMouseLeave={() => setHover(null)}>
      <span className="tl-dock-sel" aria-hidden style={{ width: 48, transform: `translateX(${(x * 52).toFixed(1)}px)` }}><span className="tl-dock-sel-face" /></span>
      {DOCK.map((d, i) => (
        <DockButton key={i} Icon={d.icon} label={d.label} on={active === i} target={target(i)} reduced={reducedMotion} tabIndex={active === i ? 0 : -1}
          btnRef={(el) => { refs.current[i] = el; }} onHover={() => setHover(i)} onLeave={() => { /* row handles leave */ }} onActivate={() => setActive(i)} />
      ))}
    </div>
  );
  return (
    <div className="tl-dock-wrap">
      {/* reduced-transparency → the floating lens collapses to a solid bar (a11y) */}
      {reducedTransparency
        ? <div className="tl-dock tl-dock--solid">{row}</div>
        : <Lens radius={22} strength="strong" thickness={1.5} tint="rgba(255,255,255,0.1)" className="tl-dock">{row}</Lens>}
    </div>
  );
}

/* ── Breadcrumb ──────────────────────────────────────────────────────────────── */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="tl-crumb" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i} className="tl-crumb-seg">
          {i > 0 && <CaretRight weight="bold" className="tl-crumb-sep" />}
          {i === items.length - 1 ? <span aria-current="page" className="tl-crumb-cur">{it.label}</span> : <button className="tl-crumb-link">{it.label}</button>}
        </span>
      ))}
    </nav>
  );
}

/* ── Pagination ──────────────────────────────────────────────────────────────── */
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i += 1) { if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…"); }
  return (
    <nav className="tl-page" aria-label="Pagination">
      <button className="tl-page-btn" aria-label="Previous" disabled={page <= 1} onClick={() => onChange(page - 1)}><CaretLeft weight="bold" /></button>
      {nums.map((n, i) => n === "…" ? <span key={i} className="tl-page-dots">…</span> : <button key={i} className="tl-page-num" data-on={n === page || undefined} aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}>{n}</button>)}
      <button className="tl-page-btn" aria-label="Next" disabled={page >= pages} onClick={() => onChange(page + 1)}><CaretRight weight="bold" /></button>
    </nav>
  );
}

/* ── CommandPalette — ⌘K. Our dialog + filtered list + keyboard (cmdk NOT
      installed → custom, documented). Frosted overlay (portalled). ───────────── */
const COMMANDS = [
  { icon: House, label: "Go to Hub", hint: "Navigate" }, { icon: FolderOpen, label: "Open a file", hint: "Navigate" },
  { icon: Bell, label: "Chase the buyer's solicitor", hint: "Action" }, { icon: CalendarBlank, label: "Set a new exchange date", hint: "Action" },
  { icon: ChatCircle, label: "Compose an email", hint: "Action" }, { icon: Users, label: "Invite a team member", hint: "Action" }, { icon: Path, label: "View the chain", hint: "Navigate" },
];
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const list = COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (open && e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  const nav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter" && list[sel]) { setOpen(false); }
  };
  return (
    <>
      <button className="tl-cmd-trigger" onClick={() => setOpen(true)}><MagnifyingGlass weight="regular" /> Search or run a command <kbd>⌘K</kbd></button>
      {open && (
        <Portal>
          <div className="tl-cmd-scrim" onClick={() => setOpen(false)}>
            <Frost radius={18} className="tl-cmd" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
              <div className="tl-cmd-input"><MagnifyingGlass weight="regular" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={nav} placeholder="Search or run a command…" aria-label="Command" /><kbd>esc</kbd></div>
              <div className="tl-cmd-list" role="listbox">
                {list.length === 0 && <p className="tl-cmd-empty">No matches for “{q}”.</p>}
                {list.map((c, i) => { const Icon = c.icon; return (
                  <button key={c.label} role="option" aria-selected={i === sel} className="tl-cmd-item" data-on={i === sel || undefined} onMouseEnter={() => setSel(i)} onClick={() => setOpen(false)}>
                    <Icon weight="regular" /><span>{c.label}</span><em>{c.hint}</em>
                  </button>
                ); })}
              </div>
            </Frost>
          </div>
        </Portal>
      )}
    </>
  );
}

export const NAV_REG: RegEntry[] = [
  { name: "Tabs", purpose: "Switch between sibling views.", source: "Built on the foundation TravellingSelection primitive — the SAME moving glass pill as Segmented and the Dock active state, so selection behaves identically across the library.", licence: "Custom (TSP) on spring.ts", adaptations: "One continuous pill that slides + resizes between tabs; coral selected label; roving arrow-key/Home/End; reduced-transparency → opaque; increased-contrast → stronger edge.", variants: "2–5 tabs", states: "selected · hover · focus-visible · keyboard · reduced-motion (instant)", importPath: "app/dev/library/navigation.tsx → Tabs · app/dev/library/foundation.tsx → TravellingSelection", whenToUse: "Peer views inside one surface (Overview/Timeline/Documents)." },
  { name: "NavRail", purpose: "Compact primary navigation.", source: "Our NavRail pattern + theatom GlassNav feel.", licence: "TSP / theatom MIT", adaptations: "Icon+label, fill-on-active, coral, aria-current.", variants: "icon-only or icon+label", states: "active · hover · focus-visible", importPath: "app/dev/library/navigation.tsx → NavRail", whenToUse: "Narrow primary nav where a full sidebar is too heavy." },
  { name: "Sidebar", purpose: "Primary navigation with sections + collapse.", source: "Custom (our AppShell sidebar concept) — no suitable glass source.", licence: "TSP", adaptations: "Collapsible, sectioned, token fills (in-flow chrome, not lens).", variants: "expanded · collapsed", states: "active · hover · collapsed (labels hidden, titles)", importPath: "app/dev/library/navigation.tsx → Sidebar", whenToUse: "Desktop app shell with several sections." },
  { name: "Toolbar", purpose: "Grouped contextual actions.", source: "Custom (standard pattern).", licence: "TSP", adaptations: "Groups + divider + grow + one coral primary.", variants: "groups; overflow", states: "rest · hover · disabled", importPath: "app/dev/library/navigation.tsx → Toolbar", whenToUse: "Actions on the current view (above content)." },
  { name: "FloatingDock", purpose: "Floating quick-switch / actions.", source: "The slab LENS bar (a genuine floating control, refracts content) + macOS-dock magnify, reimplemented on spring.ts (framer-motion not approved).", licence: "Custom (TSP) · Glassy UI MIT (lens)", adaptations: "Spring hover-magnify with NEIGHBOUR FALLOFF (hovered 1.36×, neighbours ease off over 2 cells); press scale-down; a travelling frosted pill behind the active icon (the shared selection language); arrow-key roving focus; reduced-motion drops the magnify.", variants: "3–6 items", states: "active · hover-magnify (spring) · neighbour falloff · pressed · focus-visible · keyboard · reduced-motion (no magnify)", importPath: "app/dev/library/navigation.tsx → FloatingDock", whenToUse: "A persistent floating switcher over content (the Updates floating-actions role)." },
  { name: "Breadcrumb", purpose: "Show + navigate location.", source: "Custom (standard pattern).", licence: "TSP", adaptations: "Caret separators, current marked, coral links.", variants: "with overflow", states: "link hover · current", importPath: "app/dev/library/navigation.tsx → Breadcrumb", whenToUse: "Deep hierarchies (file → tab)." },
  { name: "Pagination", purpose: "Page through long lists/tables.", source: "Custom (standard pattern).", licence: "TSP", adaptations: "Windowed numbers + ellipsis, prev/next, coral current.", variants: "any page count", states: "current · hover · at-bounds disabled", importPath: "app/dev/library/navigation.tsx → Pagination", whenToUse: "Server-paged tables/lists." },
  { name: "CommandPalette", purpose: "Keyboard command/navigation surface (⌘K).", source: "Custom — cmdk NOT installed; built on our dialog + filter + keyboard, documented. Frosted overlay.", licence: "TSP", adaptations: "⌘K toggle, type-to-filter, arrow/Enter/Esc, frosted portalled surface.", variants: "commands with hints", states: "open · filtering · selected · empty", importPath: "app/dev/library/navigation.tsx → CommandPalette", whenToUse: "Power-user shortcut to any action/route (press ⌘K)." },
];

export const NAV_CSS = `
.tl-tabs{ position:relative; display:inline-flex; padding:4px; border-radius:12px; background:rgba(0,0,0,.2); border:1px solid var(--lg-line); } .lg-ds[data-theme="light"] .tl-tabs{ background:rgba(12,16,28,.05); }
.tl-tabs-ink{ position:absolute; top:4px; bottom:4px; left:4px; border-radius:8px; background:var(--lg-fill); box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 1px 3px rgba(20,30,60,.18); } .lg-ds[data-theme="light"] .tl-tabs-ink{ background:#fff; }
.tl-tab{ position:relative; z-index:1; padding:8px 16px; font:inherit; font-size:13px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; transition:color .3s; } .tl-tab[data-on="true"]{ color:var(--lg-ink); } .tl-tab:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:1px; border-radius:7px; }

.tl-rail{ display:inline-flex; flex-direction:column; gap:3px; padding:8px; border-radius:16px; background:var(--lg-fill); border:1px solid var(--lg-line-2); }
.tl-rail-item{ display:flex; flex-direction:column; align-items:center; gap:4px; width:66px; padding:9px 6px; border-radius:11px; background:none; border:none; cursor:pointer; color:var(--lg-ink-3); font:inherit; font-size:10.5px; font-weight:600; transition:background .15s,color .15s; } .tl-rail-item svg{ width:20px; height:20px; } .tl-rail-item:hover{ background:var(--lg-hover); color:var(--lg-ink); } .tl-rail-item[data-on]{ background:var(--lg-accent-soft); color:var(--lg-accent-ink); } .tl-rail-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

.tl-sidebar{ width:230px; padding:12px; border-radius:16px; background:var(--lg-fill); border:1px solid var(--lg-line-2); transition:width .3s cubic-bezier(.2,.8,.2,1); } .tl-sidebar--collapsed{ width:64px; }
.tl-sidebar-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:4px 6px 10px; } .tl-sidebar-head strong{ font-size:13.5px; font-weight:700; white-space:nowrap; overflow:hidden; } .tl-sidebar-toggle{ width:30px; height:30px; flex-shrink:0; border-radius:8px; display:grid; place-items:center; background:var(--lg-hover); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; } .tl-sidebar-toggle svg{ width:15px; height:15px; }
.tl-sidebar-lab{ display:block; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lg-ink-3); padding:6px 8px 4px; } .tl-sidebar-sec{ display:flex; flex-direction:column; gap:2px; }
.tl-sidebar-item{ display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:10px; background:none; border:none; cursor:pointer; color:var(--lg-ink-2); font:inherit; font-size:13.5px; font-weight:550; text-align:left; transition:background .15s,color .15s; } .tl-sidebar-item svg{ width:18px; height:18px; flex-shrink:0; } .tl-sidebar--collapsed .tl-sidebar-item{ justify-content:center; } .tl-sidebar-item:hover{ background:var(--lg-hover); color:var(--lg-ink); } .tl-sidebar-item[data-on]{ background:var(--lg-accent-soft); color:var(--lg-accent-ink); } .tl-sidebar-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

.tl-toolbar{ display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:13px; background:var(--lg-fill); border:1px solid var(--lg-line-2); } .tl-toolbar-group{ display:flex; gap:2px; } .tl-toolbar-div{ width:1px; height:22px; background:var(--lg-line); } .tl-toolbar-grow{ flex:1; }
.tl-tbtn{ height:34px; min-width:34px; padding:0 9px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:none; border:none; color:var(--lg-ink-2); font:inherit; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s,color .15s; } .tl-tbtn svg{ width:16px; height:16px; } .tl-tbtn:hover{ background:var(--lg-hover); color:var(--lg-ink); } .tl-tbtn--text{ padding:0 12px; } .tl-tbtn--primary{ background:var(--lg-accent); color:#fff; padding:0 14px; } .tl-tbtn--primary:hover{ filter:brightness(1.07); color:#fff; } .tl-tbtn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }

.tl-dock-wrap{ display:flex; justify-content:center; padding:18px 0; }
.tl-dock{ display:inline-flex; padding:9px; }
.tl-dock--solid{ border-radius:22px; background:var(--lg-fill); border:1px solid var(--lg-line); box-shadow:0 10px 30px rgba(0,0,0,.3); } .lg-ds[data-theme="light"] .tl-dock--solid{ background:#fff; box-shadow:0 10px 26px rgba(20,30,60,.16); }
.tl-dock-row{ position:relative; display:inline-flex; align-items:flex-end; gap:4px; }
.tl-dock-sel{ position:absolute; z-index:0; top:0; bottom:0; left:0; border-radius:14px; pointer-events:none; }
.tl-dock-sel-face{ position:absolute; inset:0; border-radius:inherit; background:linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.06)); border:.5px solid rgba(255,255,255,.24); box-shadow:inset 0 1px 0 rgba(255,255,255,.42), 0 2px 8px rgba(0,0,0,.26); }
.lg-ds[data-theme="light"] .tl-dock-sel-face{ background:rgba(255,255,255,.72); border-color:rgba(20,30,60,.08); box-shadow:0 1px 4px rgba(20,30,60,.18), inset 0 1px 0 rgba(255,255,255,.9); }
.tl-dock-btn{ position:relative; z-index:1; width:48px; height:48px; border-radius:14px; display:grid; place-items:center; background:none; border:none; color:var(--lg-ink-2); cursor:pointer; transition:color .2s; transform-origin:center bottom; will-change:transform; } .tl-dock-btn svg{ width:22px; height:22px; } .tl-dock-btn[data-on]{ color:var(--lg-accent-ink); } .tl-dock-btn:hover{ color:var(--lg-ink); } .tl-dock-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }

.tl-crumb{ display:flex; align-items:center; flex-wrap:wrap; gap:2px; } .tl-crumb-seg{ display:inline-flex; align-items:center; gap:2px; } .tl-crumb-sep{ width:12px; height:12px; color:var(--lg-ink-3); margin:0 3px; } .tl-crumb-link{ font:inherit; font-size:13px; font-weight:550; color:var(--lg-ink-2); background:none; border:none; cursor:pointer; padding:3px 5px; border-radius:6px; } .tl-crumb-link:hover{ color:var(--lg-accent-ink); background:var(--lg-hover); } .tl-crumb-cur{ font-size:13px; font-weight:650; color:var(--lg-ink); padding:3px 5px; }

.tl-page{ display:inline-flex; align-items:center; gap:3px; } .tl-page-btn,.tl-page-num{ min-width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:none; border:1px solid transparent; color:var(--lg-ink-2); font:inherit; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s,color .15s,border-color .15s; } .tl-page-btn svg{ width:15px; height:15px; } .tl-page-num:hover,.tl-page-btn:hover:not(:disabled){ background:var(--lg-hover); color:var(--lg-ink); } .tl-page-num[data-on]{ background:var(--lg-accent); color:#fff; } .tl-page-btn:disabled{ opacity:.35; cursor:not-allowed; } .tl-page-dots{ padding:0 4px; color:var(--lg-ink-3); } .tl-page-num:focus-visible,.tl-page-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:1px; }

.tl-cmd-trigger{ display:inline-flex; align-items:center; gap:9px; width:360px; max-width:100%; padding:10px 13px; border-radius:12px; background:var(--lg-field); border:1px solid var(--lg-line); color:var(--lg-ink-3); font:inherit; font-size:13px; cursor:text; transition:border-color .2s; } .tl-cmd-trigger:hover{ border-color:var(--lg-ink-3); } .tl-cmd-trigger svg{ width:16px; height:16px; } .tl-cmd-trigger kbd{ margin-left:auto; font:inherit; font-size:11px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:6px; padding:2px 6px; }
.tl-cmd-scrim{ position:fixed; inset:0; z-index:1650; background:rgba(0,0,0,.4); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); display:flex; align-items:flex-start; justify-content:center; padding-top:14vh; animation:tlfade .2s; } @keyframes tlfade{ from{ opacity:0 } to{ opacity:1 } }
.tl-cmd{ width:min(560px,92vw); padding:0; overflow:hidden; } .tl-cmd-input{ display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--lg-line-2); } .tl-cmd-input svg{ width:17px; height:17px; color:var(--lg-ink-3); } .tl-cmd-input input{ flex:1; background:none; border:none; outline:none; color:var(--lg-ink); font:inherit; font-size:15px; } .tl-cmd-input kbd{ font:inherit; font-size:10.5px; font-weight:600; color:var(--lg-ink-3); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:5px; padding:2px 6px; }
.tl-cmd-list{ max-height:320px; overflow-y:auto; padding:6px; } .tl-cmd-empty{ padding:24px; text-align:center; font-size:13px; color:var(--lg-ink-3); }
.tl-cmd-item{ display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:10px 11px; border-radius:10px; background:none; border:none; cursor:pointer; color:var(--lg-ink); font:inherit; font-size:13.5px; } .tl-cmd-item svg{ width:16px; height:16px; color:var(--lg-ink-3); } .tl-cmd-item span{ flex:1; } .tl-cmd-item em{ font-style:normal; font-size:11px; color:var(--lg-ink-3); } .tl-cmd-item[data-on]{ background:var(--lg-accent-soft); } .tl-cmd-item[data-on] svg,.tl-cmd-item[data-on] em{ color:var(--lg-accent-ink); }
`;
