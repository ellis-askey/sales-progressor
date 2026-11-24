"use client";
// TSP library · Data & content. Interactive content patterns (sortable/expandable
// table, filters, carousel, charts, progress, timeline, skeletons, empty states).
// These are content-layer patterns, so token/solid surfaces (not the lens) — the
// lens is for floating chrome. Charts are lightweight local SVG (no chart dep
// added). Registry in DATA_REG.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CaretDown, CaretUp, CaretRight, MagnifyingGlass, Check, House, ChatCircle,
  FileArrowDown, Plus, ArrowRight, TrendUp,
} from "@phosphor-icons/react";
import { cn, useReducedMotion } from "./lib";
import type { RegEntry } from "./registry";

/* ── List ────────────────────────────────────────────────────────────────────── */
const SALES = [
  { addr: "3 Maple Court", loc: "Hertford", stage: "Moving", pct: 44 },
  { addr: "14 Bushey Avenue", loc: "Broxbourne", stage: "Legal work", pct: 62 },
  { addr: "7 Victoria Road", loc: "Ware", stage: "Nearly there", pct: 81 },
  { addr: "41 Oak Lane", loc: "Hoddesdon", stage: "Moving", pct: 38 },
];
export function List() {
  const [sel, setSel] = useState(1);
  return (
    <div className="tl-list" role="list">
      {SALES.map((s, i) => (
        <button key={s.addr} role="listitem" className="tl-list-row" data-on={sel === i || undefined} onClick={() => setSel(i)}>
          <span className="tl-list-main"><strong>{s.addr}</strong><span>{s.loc} · {s.stage}</span></span>
          <span className="tl-list-tail">{s.pct}%<CaretRight weight="bold" /></span>
        </button>
      ))}
    </div>
  );
}

/* ── Table — sortable headers + expandable rows ──────────────────────────────── */
type Row = { addr: string; stage: string; days: number; fee: number; detail: string };
const ROWS: Row[] = [
  { addr: "3 Maple Court", stage: "Moving", days: 71, fee: 4.2, detail: "Exchange 5 days overdue · chasing the buyer's solicitor." },
  { addr: "14 Bushey Avenue", stage: "Legal work", days: 54, fee: 5.0, detail: "Enquiries open 23 days · escalated by Priya." },
  { addr: "7 Victoria Road", stage: "Nearly there", days: 63, fee: 4.2, detail: "Ready to exchange Thursday." },
];
export function Table() {
  const [sort, setSort] = useState<{ k: keyof Row; dir: 1 | -1 }>({ k: "days", dir: 1 });
  const [open, setOpen] = useState<string | null>("3 Maple Court");
  const rows = [...ROWS].sort((a, b) => (a[sort.k] < b[sort.k] ? -1 : 1) * sort.dir);
  const Th = ({ k, children }: { k: keyof Row; children: ReactNode }) => (
    <button className="tl-th" aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      {children}{sort.k === k && (sort.dir === 1 ? <CaretUp weight="bold" /> : <CaretDown weight="bold" />)}
    </button>
  );
  return (
    <div className="tl-table" role="table">
      <div className="tl-tr tl-tr--head" role="row"><span className="tl-td-x" /><Th k="addr">Property</Th><Th k="stage">Stage</Th><Th k="days">Days</Th><Th k="fee">Fee</Th></div>
      {rows.map((r) => (
        <div key={r.addr} className="tl-trow">
          <button className="tl-tr" role="row" aria-expanded={open === r.addr} onClick={() => setOpen((o) => (o === r.addr ? null : r.addr))}>
            <span className="tl-td-x"><CaretRight weight="bold" style={{ transform: open === r.addr ? "rotate(90deg)" : "none" }} /></span>
            <span className="tl-td tl-td--main">{r.addr}</span><span className="tl-td">{r.stage}</span><span className="tl-td">{r.days}d</span><span className="tl-td">£{r.fee}k</span>
          </button>
          <div className={cn("tl-trow-detail", open === r.addr && "tl-trow-detail--open")}><div>{r.detail}</div></div>
        </div>
      ))}
    </div>
  );
}

/* ── Filters + Sorting bar ───────────────────────────────────────────────────── */
export function Filters() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string[]>(["overdue"]);
  const [sort, setSort] = useState("urgency");
  const chips = [{ k: "overdue", l: "Overdue" }, { k: "exchanging", l: "Exchanging soon" }, { k: "quiet", l: "Gone quiet" }, { k: "mine", l: "Mine" }];
  const toggle = (k: string) => setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  return (
    <div className="tl-filters">
      <div className="tl-filter-search"><MagnifyingGlass weight="regular" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by address…" aria-label="Filter" /></div>
      <div className="tl-chips">{chips.map((c) => <button key={c.k} className="tl-chip" aria-pressed={active.includes(c.k)} data-on={active.includes(c.k) || undefined} onClick={() => toggle(c.k)}>{active.includes(c.k) && <Check weight="bold" />}{c.l}</button>)}</div>
      <span className="tl-filter-grow" />
      <label className="tl-sort"><span>Sort</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="urgency">Urgency</option><option value="days">Days active</option><option value="fee">Fee</option></select>
      </label>
    </div>
  );
}

/* ── Carousel — our proven WinsCarousel pattern (auto/dots/swipe/pause/reduced);
      motion-primitives Carousel NOT used (needs framer-motion). ───────────────── */
export function Carousel() {
  const slides = [{ v: "9", k: "exchanges this month" }, { v: "6", k: "completions" }, { v: "38d", k: "fastest to exchange" }, { v: "£7.4k", k: "biggest fee" }];
  const [i, setI] = useState(0); const [paused, setPaused] = useState(false); const touch = useRef<number | null>(null); const reduced = useReducedMotion();
  useEffect(() => { if (reduced || paused) return; const t = setInterval(() => setI((x) => (x + 1) % slides.length), 4000); return () => clearInterval(t); }, [reduced, paused, slides.length]);
  return (
    <div className="tl-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) setI((x) => (x + (dx < 0 ? 1 : -1) + slides.length) % slides.length); touch.current = null; }}>
      <div className="tl-carousel-h">Wins this month</div>
      <div className="tl-carousel-slide" key={i} aria-live="polite"><strong>{slides[i].v}</strong> <span>{slides[i].k}</span></div>
      <div className="tl-carousel-dots">{slides.map((s, x) => <button key={s.k} className={cn("tl-dot", x === i && "on")} aria-label={`Slide ${x + 1}`} onClick={() => setI(x)} />)}</div>
    </div>
  );
}

/* ── Charts (lightweight local SVG) ──────────────────────────────────────────── */
export function Sparkline({ data = [4, 6, 5, 7, 6, 8, 7, 9] }: { data?: number[] }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(" ");
  return <svg className="tl-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke="var(--lg-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function BarMini({ data = [3, 2, 4, 1, 2], labels = ["W1", "W2", "W3", "W4", "W5"] }: { data?: number[]; labels?: string[] }) {
  const max = Math.max(...data);
  return <div className="tl-bars">{data.map((v, i) => <div key={i} className="tl-bar-col"><span className="tl-bar" style={{ height: `${16 + (v / max) * 48}px` }}><b>{v}</b></span><span>{labels[i]}</span></div>)}</div>;
}
export function ProgressRing({ pct = 62, label }: { pct?: number; label?: string }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="tl-ring">
      <svg viewBox="0 0 64 64" aria-label={`${pct}%`}><circle cx="32" cy="32" r={r} className="tl-ring-bg" /><circle cx="32" cy="32" r={r} className="tl-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} /></svg>
      <span className="tl-ring-val">{pct}%</span>{label && <span className="tl-ring-lab">{label}</span>}
    </div>
  );
}
export function ProgressBar({ pct = 62 }: { pct?: number }) {
  return <div className="tl-prog"><span className="tl-prog-fill" style={{ width: `${pct}%` }} /></div>;
}
export function StepProgress({ step = 3, total = 6, labels }: { step?: number; total?: number; labels?: string[] }) {
  return <div className="tl-steps">{Array.from({ length: total }).map((_, i) => <div key={i} className="tl-step" data-state={i < step ? "done" : i === step ? "current" : "todo"}><span className="tl-step-dot" />{labels?.[i] && <span className="tl-step-lab">{labels[i]}</span>}</div>)}</div>;
}

/* ── Timeline ────────────────────────────────────────────────────────────────── */
export function Timeline() {
  const items = [
    { t: "Enquiries raised confirmed", ctx: "14 Bushey Avenue", at: "18m ago", kind: "milestone" as const },
    { t: "A solicitor replied to our chase", ctx: "3 Maple Court", at: "52m ago", kind: "comm" as const },
    { t: "Searches received, no adverse entries", ctx: "7 Victoria Road", at: "2h ago", kind: "milestone" as const },
    { t: "Memorandum of sale issued", ctx: "41 Oak Lane", at: "Yesterday", kind: "milestone" as const },
  ];
  return (
    <ol className="tl-timeline">
      {items.map((it, i) => (
        <li key={i} className="tl-tl-item">
          <span className="tl-tl-rail"><span className={cn("tl-tl-dot", `tl-tl-dot--${it.kind}`)}>{it.kind === "comm" ? <ChatCircle weight="fill" /> : <Check weight="bold" />}</span></span>
          <div className="tl-tl-body"><strong>{it.t}</strong><span>{it.ctx} · {it.at}</span></div>
        </li>
      ))}
    </ol>
  );
}

/* ── Skeleton + EmptyState ───────────────────────────────────────────────────── */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="tl-skel">{Array.from({ length: lines }).map((_, i) => <span key={i} className="tl-skel-line" style={{ width: `${90 - i * 14}%` }} />)}</div>;
}
export function EmptyState({ icon, title, body, cta }: { icon?: ReactNode; title: string; body: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="tl-empty">
      <span className="tl-empty-ic">{icon ?? <House weight="regular" />}</span>
      <strong>{title}</strong><p>{body}</p>
      {cta && <button className="tl-btn tl-btn--primary tl-btn--sm" onClick={cta.onClick}>{cta.label} <ArrowRight weight="bold" /></button>}
    </div>
  );
}

export const DATA_REG: RegEntry[] = [
  { name: "List", purpose: "Selectable rows of records.", source: "Our de-washed row pattern (hub).", licence: "TSP", adaptations: "Address-led, token hover/selection, trailing meta + caret; no coloured-border rows.", variants: "selectable", states: "rest · hover · selected", importPath: "app/dev/library/data.tsx → List", whenToUse: "Scannable record lists where a table is overkill." },
  { name: "Table", purpose: "Tabular data, sortable + expandable rows.", source: "Custom (no suitable glass table source).", licence: "TSP", adaptations: "Click-to-sort headers (aria-sort), click-to-expand rows (animated), token surfaces.", variants: "sortable; expandable", states: "sorted asc/desc · row hover · expanded", importPath: "app/dev/library/data.tsx → Table", whenToUse: "Dense comparable data with per-row detail." },
  { name: "Filters", purpose: "Filter + sort a collection.", source: "Custom (composed from library controls).", licence: "TSP", adaptations: "Search + toggle chips (aria-pressed) + sort select.", variants: "chips; sort options", states: "chip on/off · typing · sort change", importPath: "app/dev/library/data.tsx → Filters", whenToUse: "Above lists/tables to narrow + order." },
  { name: "Carousel", purpose: "Rotating spotlight of items.", source: "Our proven WinsCarousel; motion-primitives Carousel NOT used (needs framer-motion).", licence: "TSP", adaptations: "Auto-rotate, dots, swipe, pause-on-hover, reduced-motion.", variants: "slides", states: "auto · paused · swiped · reduced (static)", importPath: "app/dev/library/data.tsx → Carousel", whenToUse: "Wins / highlights where space is tight." },
  { name: "Charts", purpose: "Compact data viz.", source: "Custom lightweight SVG (no chart dependency added).", licence: "TSP", adaptations: "Sparkline, mini bars, progress ring — coral, theme-aware.", variants: "Sparkline · BarMini · ProgressRing", states: "static (data-driven)", importPath: "app/dev/library/data.tsx → Sparkline / BarMini / ProgressRing", whenToUse: "Inline metrics (momentum, forecast, % complete)." },
  { name: "Progress", purpose: "Show completion.", source: "Custom (standard patterns).", licence: "TSP", adaptations: "Linear bar, stepped milestones, ring; coral.", variants: "ProgressBar · StepProgress · ProgressRing", states: "value-driven · step done/current/todo", importPath: "app/dev/library/data.tsx → ProgressBar / StepProgress", whenToUse: "Sale/task completion." },
  { name: "Timeline", purpose: "Chronological events.", source: "Our Updates activity pattern.", licence: "TSP", adaptations: "Rail + typed dots (milestone/comm), grounded text.", variants: "events", states: "static", importPath: "app/dev/library/data.tsx → Timeline", whenToUse: "Activity feeds, file history." },
  { name: "Skeleton", purpose: "Loading placeholder.", source: "Custom (shimmer).", licence: "TSP", adaptations: "Shimmer lines; honours reduced-motion.", variants: "lines", states: "shimmer", importPath: "app/dev/library/data.tsx → Skeleton", whenToUse: "Between navigation and data arrival (not for brand-new accounts)." },
  { name: "EmptyState", purpose: "Nothing-here state with a next action.", source: "Our hub empty-state pattern.", licence: "TSP", adaptations: "Icon + title + body + coral CTA; invites the next step.", variants: "icon; cta", states: "static", importPath: "app/dev/library/data.tsx → EmptyState", whenToUse: "Empty lists/sections — always offer the next action." },
];

export const DATA_CSS = `
.tl-list{ display:flex; flex-direction:column; gap:2px; max-width:440px; } .tl-list-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 13px; border-radius:11px; background:none; border:1px solid transparent; cursor:pointer; text-align:left; transition:background .15s,border-color .15s; } .tl-list-row:hover{ background:var(--lg-hover); } .tl-list-row[data-on]{ background:var(--lg-fill); border-color:var(--lg-line); } .tl-list-main{ display:flex; flex-direction:column; } .tl-list-main strong{ font-size:13.5px; font-weight:650; } .tl-list-main span{ font-size:11.5px; color:var(--lg-ink-3); } .tl-list-tail{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:var(--lg-ink-2); } .tl-list-tail svg{ width:13px; height:13px; color:var(--lg-ink-3); } .tl-list-row:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

.tl-table{ border:1px solid var(--lg-line-2); border-radius:14px; overflow:hidden; } .tl-tr{ display:grid; grid-template-columns:30px 1.6fr 1fr .7fr .7fr; align-items:center; gap:10px; width:100%; padding:11px 14px; background:none; border:none; cursor:pointer; text-align:left; } .tl-tr--head{ cursor:default; background:var(--lg-fill); border-bottom:1px solid var(--lg-line-2); } .tl-trow:not(:last-child) .tl-tr{ border-bottom:1px solid var(--lg-line-2); } .tl-trow .tl-tr:hover{ background:var(--lg-hover); }
.tl-th{ display:inline-flex; align-items:center; gap:4px; font:inherit; font-size:11px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; padding:0; } .tl-th svg{ width:11px; height:11px; color:var(--lg-accent-ink); } .tl-th:hover{ color:var(--lg-ink-2); }
.tl-td{ font-size:13px; color:var(--lg-ink-2); } .tl-td--main{ font-weight:650; color:var(--lg-ink); } .tl-td-x{ display:grid; place-items:center; color:var(--lg-ink-3); } .tl-td-x svg{ width:13px; height:13px; transition:transform .2s; }
.tl-trow-detail{ display:grid; grid-template-rows:0fr; transition:grid-template-rows .25s ease; } .tl-trow-detail--open{ grid-template-rows:1fr; } .tl-trow-detail > div{ overflow:hidden; font-size:12.5px; color:var(--lg-ink-2); padding:0 14px 0 54px; } .tl-trow-detail--open > div{ padding:4px 14px 12px 54px; }

.tl-filters{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; } .tl-filter-search{ display:inline-flex; align-items:center; gap:7px; padding:8px 11px; border-radius:10px; background:var(--lg-field); border:1px solid var(--lg-line); } .tl-filter-search svg{ width:15px; height:15px; color:var(--lg-ink-3); } .tl-filter-search input{ background:none; border:none; outline:none; color:var(--lg-ink); font:inherit; font-size:13px; width:150px; }
.tl-chips{ display:flex; gap:6px; flex-wrap:wrap; } .tl-chip{ display:inline-flex; align-items:center; gap:5px; font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:999px; padding:6px 12px; cursor:pointer; transition:background .15s,color .15s,border-color .15s; } .tl-chip svg{ width:12px; height:12px; } .tl-chip:hover{ border-color:var(--lg-ink-3); color:var(--lg-ink); } .tl-chip[data-on]{ background:var(--lg-accent); border-color:var(--lg-accent); color:#fff; } .tl-chip:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tl-filter-grow{ flex:1; } .tl-sort{ display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--lg-ink-3); } .tl-sort select{ font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink); background:var(--lg-field); border:1px solid var(--lg-line); border-radius:9px; padding:6px 9px; cursor:pointer; }

.tl-carousel{ width:260px; padding:15px 16px; border:1px solid var(--lg-line-2); border-radius:16px; background:var(--lg-fill); } .tl-carousel-h{ font-size:12px; font-weight:700; color:var(--lg-ink-2); margin-bottom:6px; } .tl-carousel-slide{ display:flex; align-items:baseline; gap:7px; min-height:34px; animation:tlcar .4s; } @keyframes tlcar{ from{ opacity:0; transform:translateY(5px) } to{ opacity:1; transform:none } } .tl-carousel-slide strong{ font-size:30px; font-weight:820; letter-spacing:-.03em; } .tl-carousel-slide span{ font-size:12px; color:var(--lg-ink-2); } .tl-carousel-dots{ display:flex; gap:5px; margin-top:10px; } .tl-dot{ width:6px; height:6px; border-radius:999px; background:var(--lg-line); border:none; padding:0; cursor:pointer; transition:background .2s,width .2s; } .tl-dot.on{ background:var(--lg-accent); width:16px; }

.tl-spark{ width:120px; height:32px; } .tl-bars{ display:flex; align-items:flex-end; gap:8px; height:84px; } .tl-bar-col{ display:flex; flex-direction:column; align-items:center; gap:4px; } .tl-bar{ width:30px; border-radius:6px 6px 3px 3px; background:var(--lg-accent-soft); display:grid; place-items:start center; padding-top:3px; } .tl-bar b{ font-size:10px; font-weight:750; color:var(--lg-accent-ink); } .tl-bar-col span{ font-size:10px; color:var(--lg-ink-3); }
.tl-ring{ position:relative; display:inline-grid; place-items:center; width:64px; height:64px; } .tl-ring svg{ width:64px; height:64px; transform:rotate(-90deg); } .tl-ring-bg{ fill:none; stroke:var(--lg-fill); stroke-width:6; } .tl-ring-fg{ fill:none; stroke:var(--lg-accent); stroke-width:6; stroke-linecap:round; transition:stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1); } .tl-ring-val{ position:absolute; font-size:14px; font-weight:750; } .tl-ring-lab{ position:absolute; bottom:-16px; font-size:10px; color:var(--lg-ink-3); white-space:nowrap; }
.tl-prog{ height:7px; border-radius:999px; background:var(--lg-fill); overflow:hidden; max-width:360px; } .tl-prog-fill{ display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,var(--lg-accent-2),var(--lg-accent)); transition:width .5s cubic-bezier(.2,.8,.2,1); }
.tl-steps{ display:flex; align-items:center; gap:0; } .tl-step{ display:flex; align-items:center; flex:1; } .tl-step-dot{ width:12px; height:12px; border-radius:50%; background:var(--lg-base); border:2px solid var(--lg-line); flex-shrink:0; } .tl-step[data-state="done"] .tl-step-dot{ background:var(--lg-accent); border-color:var(--lg-accent); } .tl-step[data-state="current"] .tl-step-dot{ border-color:var(--lg-accent); box-shadow:0 0 0 4px var(--lg-accent-soft); } .tl-step:not(:last-child)::after{ content:""; flex:1; height:2px; margin:0 6px; background:var(--lg-line); } .tl-step[data-state="done"]:not(:last-child)::after{ background:var(--lg-accent); } .tl-step-lab{ font-size:10.5px; color:var(--lg-ink-3); margin-left:6px; }

.tl-timeline{ list-style:none; padding:0; margin:0; } .tl-tl-item{ display:flex; gap:12px; } .tl-tl-rail{ display:flex; flex-direction:column; align-items:center; } .tl-tl-dot{ width:28px; height:28px; border-radius:9px; display:grid; place-items:center; flex-shrink:0; background:var(--lg-fill); color:var(--lg-ink-3); } .tl-tl-dot svg{ width:14px; height:14px; } .tl-tl-dot--milestone{ color:#5ce08a; } .tl-tl-dot--comm{ color:var(--lg-accent-ink); } .tl-tl-item:not(:last-child) .tl-tl-rail::after{ content:""; flex:1; width:2px; background:var(--lg-line-2); margin:4px 0; } .tl-tl-body{ padding-bottom:16px; } .tl-tl-body strong{ display:block; font-size:13px; font-weight:600; } .tl-tl-body span{ font-size:11.5px; color:var(--lg-ink-3); }

.tl-skel{ display:flex; flex-direction:column; gap:9px; max-width:360px; } .tl-skel-line{ height:12px; border-radius:6px; background:linear-gradient(90deg,rgba(128,128,140,.1) 25%,rgba(128,128,140,.2) 37%,rgba(128,128,140,.1) 63%); background-size:400% 100%; animation:tlshim 1.4s ease infinite; } @keyframes tlshim{ from{ background-position:100% 0 } to{ background-position:0 0 } }
.tl-empty{ text-align:center; padding:28px 20px; } .tl-empty-ic{ display:inline-grid; place-items:center; width:48px; height:48px; border-radius:14px; background:var(--lg-fill); color:var(--lg-ink-3); margin-bottom:12px; } .tl-empty-ic svg{ width:22px; height:22px; } .tl-empty strong{ display:block; font-size:16px; font-weight:750; } .tl-empty p{ font-size:13px; color:var(--lg-ink-2); margin:6px auto 16px; max-width:320px; line-height:1.5; }
`;
