"use client";
// /dev/library — the component showroom. Renders the ACTUAL reusable components
// (not replicas) across all five categories, over the Updates atmosphere. Dev-only.
// Nothing is Approved.

import { useState } from "react";
import { notFound } from "next/navigation";
import { Sun, MoonStars, Sparkle, Bell, PaperPlaneTilt, TextB, House, FolderOpen, Pencil, Trash } from "@phosphor-icons/react";
import { ThemeCtx, Atmosphere, cn, type Theme } from "./lib";
import {
  Button, IconButton, Switch, Checkbox, RadioGroup, Slider, Segmented,
  Field, Input, Textarea, Search, Select, DatePicker, Stepper, Toggle,
} from "./controls";
import {
  Tabs, NavRail, Sidebar, Toolbar, FloatingDock, Breadcrumb, Pagination, CommandPalette, NAV_REG, NAV_CSS,
} from "./navigation";
import {
  DropdownMenu, ContextMenu, Popover, Tooltip, Dialog, ConfirmDialog, Drawer, Sheet,
  ToastProvider, useToast, OVERLAY_REG, OVERLAY_CSS,
} from "./overlays";
import {
  List, Table, Filters, Carousel, Sparkline, BarMini, ProgressRing, ProgressBar, StepProgress,
  Timeline, Skeleton, EmptyState, DATA_REG, DATA_CSS,
} from "./data";
import {
  PropertyRow, PropertySummary, Milestones, TransactionProgress, ChainView, EnquiryItem,
  Reminder, DiaryEvent, ActivityUpdate, PersonDisplay, ContextualActions, TSP_REG, TSP_CSS,
} from "./tsp";
import { FOUNDATION_CSS } from "./foundation";
import { MaterialBench, BENCH_CSS } from "./bench";
import { CONTROLS, type RegEntry } from "./registry";

const REG = [...CONTROLS, ...NAV_REG, ...OVERLAY_REG, ...DATA_REG, ...TSP_REG];
function reg(name: string): RegEntry { return REG.find((e) => e.name === name)!; }
const CATEGORIES = [
  { key: "controls", name: "Controls", count: CONTROLS.length },
  { key: "navigation", name: "Navigation", count: NAV_REG.length },
  { key: "overlays", name: "Overlays", count: OVERLAY_REG.length },
  { key: "data", name: "Data & content", count: DATA_REG.length },
  { key: "tsp", name: "TSP patterns", count: TSP_REG.length },
];

export default function Library() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  return (
    <ThemeCtx.Provider value={theme}>
      <ToastProvider>
        <div className="lg-ds tl-root" data-theme={theme}>
          <style dangerouslySetInnerHTML={{ __html: CONTROLS_CSS + FOUNDATION_CSS + BENCH_CSS + NAV_CSS + OVERLAY_CSS + DATA_CSS + TSP_CSS }} />
          <Atmosphere />

          <header className="tl-top">
            <div>
              <span className="tl-kicker"><Sparkle weight="fill" /> TSP component library · isolated · nothing approved</span>
              <h1>Component library</h1>
              <p>The reusable components that will power the application — sourced from theatom liquid-glass, Radix and our own proven work, on the slab lens, coral and the Updates atmosphere. Judge in your GPU browser.</p>
            </div>
            <button className={cn("tl-theme", theme === "light" && "on")} aria-label="Toggle theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              <span className="tl-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
            </button>
          </header>

          <div className="tl-shell">
            <nav className="tl-nav" aria-label="Categories">
              <a href="#foundations" className="tl-nav-item tl-nav-item--lead"><span>Foundations</span><span className="tl-nav-count">Phase 0</span></a>
              {CATEGORIES.map((c) => (<a key={c.key} href={`#${c.key}`} className="tl-nav-item"><span>{c.name}</span><span className="tl-nav-count">{c.count}</span></a>))}
              <p className="tl-nav-foot">Phase 0 rebuilds the selection + slider materials and adds the Material Bench. Rest of the library is prior work. <code>framer-motion</code> not added — all motion is spring.ts.</p>
            </nav>

            <main className="tl-main">
              {/* ───────── FOUNDATIONS (Phase 0) ───────── */}
              <section id="foundations" className="tl-cat">
                <div className="tl-cat-head"><h2>Foundations</h2><span>Phase 0 · materials · travelling selection · the bench</span></div>
                <article className="tl-spec">
                  <div className="tl-spec-head"><div><h3>Material Bench</h3><p>Drag the slider, switch segments and tabs, and hover the dock over each backdrop. Flip the accessibility toggles — they really drive the components. Judge refraction, legibility and frame-rate in your GPU browser.</p></div></div>
                  <div className="tl-stage tl-stage--bench"><MaterialBench /></div>
                  <div className="tl-meta"><span><b>Primitives</b> Surface (solid · frost · lens) · TravellingSelection · SliderThumb</span><span><b>Import</b> <code>app/dev/library/foundation.tsx</code>, <code>bench.tsx</code></span></div>
                  <p className="tl-demo-note">Refraction only reveals over high-frequency content (text, grid, colour-band edges, the photo) — it is deliberately near-invisible over a smooth gradient. That is correct optical behaviour, and the reason the bench exists.</p>
                </article>
              </section>

              {/* ───────── CONTROLS ───────── */}
              <Cat id="controls" name="Controls" count={CONTROLS.length}>
                <Spec entry={reg("Button")}>
                  <div className="tl-demo-row"><Button variant="primary"><PaperPlaneTilt weight="fill" /> Send chase</Button><Button variant="secondary">Secondary</Button><Button variant="subtle">Subtle</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Withdraw</Button></div>
                  <div className="tl-demo-row"><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button><Button variant="primary" loading>Loading</Button><Button disabled>Disabled</Button><IconButton label="Alerts"><Bell weight="fill" /></IconButton></div>
                </Spec>
                <Spec entry={reg("Switch")}><SwitchDemo /></Spec>
                <Spec entry={reg("Checkbox")}><CheckboxDemo /></Spec>
                <Spec entry={reg("RadioGroup")}><RadioDemo /></Spec>
                <Spec entry={reg("Slider")}><SliderDemo /></Spec>
                <Spec entry={reg("Segmented")}><SegmentedDemo /></Spec>
                <Spec entry={reg("Input · Textarea · Search · Field")}><InputsDemo /></Spec>
                <Spec entry={reg("Select")}><SelectDemo /></Spec>
                <Spec entry={reg("DatePicker")}><DateDemo /></Spec>
                <Spec entry={reg("Stepper")}><StepperDemo /></Spec>
                <Spec entry={reg("Toggle")}><ToggleDemo /></Spec>
              </Cat>

              {/* ───────── NAVIGATION ───────── */}
              <Cat id="navigation" name="Navigation" count={NAV_REG.length}>
                <Spec entry={reg("Tabs")}><TabsDemo /></Spec>
                <Spec entry={reg("NavRail")}><NavRail /></Spec>
                <Spec entry={reg("Sidebar")}><Sidebar /></Spec>
                <Spec entry={reg("Toolbar")}><Toolbar /></Spec>
                <Spec entry={reg("FloatingDock")}><FloatingDock /></Spec>
                <Spec entry={reg("Breadcrumb")}><Breadcrumb items={[{ label: "Files" }, { label: "3 Maple Court" }, { label: "Milestones" }]} /></Spec>
                <Spec entry={reg("Pagination")}><PaginationDemo /></Spec>
                <Spec entry={reg("CommandPalette")}><CommandPalette /></Spec>
              </Cat>

              {/* ───────── OVERLAYS ───────── */}
              <Cat id="overlays" name="Overlays" count={OVERLAY_REG.length}>
                <Spec entry={reg("DropdownMenu")}><div className="tl-demo-row"><DropdownMenu label="Actions" items={[{ label: "Mark as chased", icon: <PaperPlaneTilt weight="regular" /> }, { label: "Confirm step done" }, { label: "Snooze a week" }, { label: "Dismiss", danger: true, icon: <Trash weight="regular" /> }]} /></div></Spec>
                <Spec entry={reg("ContextMenu")}><ContextMenu items={[{ label: "Open file", icon: <FolderOpen weight="regular" /> }, { label: "Add a note", icon: <Pencil weight="regular" /> }, { label: "Dismiss", danger: true }]}><div className="tl-ctxdemo">Right-click anywhere in this area</div></ContextMenu></Spec>
                <Spec entry={reg("Popover")}><Popover trigger="Open popover"><div className="tl-pop-demo"><strong>Exchange forecast</strong><p>3 exchanges this week · £12k in fees.</p><ProgressBar pct={62} /></div></Popover></Spec>
                <Spec entry={reg("Tooltip")}><div className="tl-demo-row"><Tooltip content="Chase the buyer's solicitor"><IconButton label="Chase"><PaperPlaneTilt weight="fill" /></IconButton></Tooltip><Tooltip content="Alerts · 3 new"><IconButton label="Alerts"><Bell weight="fill" /></IconButton></Tooltip></div></Spec>
                <Spec entry={reg("Dialog")}><DialogDemo /></Spec>
                <Spec entry={reg("ConfirmDialog")}><ConfirmDemo /></Spec>
                <Spec entry={reg("Drawer")}><DrawerDemo /></Spec>
                <Spec entry={reg("Sheet")}><SheetDemo /></Spec>
                <Spec entry={reg("Toast")}><ToastDemo /></Spec>
                <Spec entry={reg("Notification")}><NotificationDemo /></Spec>
              </Cat>

              {/* ───────── DATA & CONTENT ───────── */}
              <Cat id="data" name="Data & content" count={DATA_REG.length}>
                <Spec entry={reg("List")}><List /></Spec>
                <Spec entry={reg("Table")}><Table /></Spec>
                <Spec entry={reg("Filters")}><Filters /></Spec>
                <Spec entry={reg("Carousel")}><Carousel /></Spec>
                <Spec entry={reg("Charts")}><div className="tl-demo-row" style={{ gap: 32, alignItems: "flex-end" }}><div><Sparkline /><p className="tl-demo-note">Sparkline</p></div><BarMini /><ProgressRing pct={64} label="within 12 wks" /></div></Spec>
                <Spec entry={reg("Progress")}><div className="tl-demo-col" style={{ gap: 18, width: "100%" }}><ProgressBar pct={62} /><StepProgress step={3} total={6} labels={["Offer", "Legal", "Searches", "Enquiries", "Exchange", "Complete"]} /></div></Spec>
                <Spec entry={reg("Timeline")}><Timeline /></Spec>
                <Spec entry={reg("Skeleton")}><Skeleton lines={3} /></Spec>
                <Spec entry={reg("EmptyState")}><EmptyState title="No sales need you" body="Nothing is waiting — we'll surface the next thing the moment it lands." cta={{ label: "Add a sale", onClick: () => {} }} /></Spec>
              </Cat>

              {/* ───────── TSP PATTERNS ───────── */}
              <Cat id="tsp" name="TSP patterns" count={TSP_REG.length}>
                <Spec entry={reg("PropertyRow")}><div className="tl-demo-col" style={{ gap: 8 }}><PropertyRow /><PropertyRow addr="3 Maple Court" loc="Hertford, SG14 1QF" status="Overdue" pct={44} next="Exchange was due 28 Oct — 5 days ago" tone="danger" /></div></Spec>
                <Spec entry={reg("PropertySummary")}><PropertySummary /></Spec>
                <Spec entry={reg("Milestones")}><Milestones /></Spec>
                <Spec entry={reg("TransactionProgress")}><TransactionProgress /></Spec>
                <Spec entry={reg("ChainView")}><ChainView /></Spec>
                <Spec entry={reg("EnquiryItem")}><EnquiryItem /></Spec>
                <Spec entry={reg("Reminder")}><Reminder /></Spec>
                <Spec entry={reg("DiaryEvent")}><div className="tl-demo-col" style={{ gap: 8 }}><DiaryEvent type="exchange" ready /><DiaryEvent type="completion" addr="22 Nathaniels Walk, Harlow" ready={false} /></div></Spec>
                <Spec entry={reg("ActivityUpdate")}><div className="tl-demo-col" style={{ gap: 4, width: "100%" }}><ActivityUpdate /><ActivityUpdate kind="milestone" text="Searches received, no adverse entries" body="" who="P" role="staff" at="2h ago" /></div></Spec>
                <Spec entry={reg("PersonDisplay")}><div className="tl-demo-row" style={{ gap: 22 }}><PersonDisplay /><PersonDisplay name="Duggan & Co" role="Buyer's solicitor" side="sol" initials="D" /><PersonDisplay name="James Okafor" role="Buyer" side="buyer" initials="JO" /></div></Spec>
                <Spec entry={reg("ContextualActions")}><ContextualActions /></Spec>
              </Cat>
            </main>
          </div>
        </div>
      </ToastProvider>
    </ThemeCtx.Provider>
  );
}

function Cat({ id, name, count, children }: { id: string; name: string; count: number; children: React.ReactNode }) {
  return <section id={id} className="tl-cat"><div className="tl-cat-head"><h2>{name}</h2><span>{count} components</span></div>{children}</section>;
}
function Spec({ entry, children }: { entry: RegEntry; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="tl-spec">
      <div className="tl-spec-head"><div><h3>{entry.name}</h3><p>{entry.purpose}</p></div><button className="tl-spec-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Registry"}</button></div>
      <div className="tl-stage">{children}</div>
      <div className="tl-meta"><span><b>Source</b> {entry.source.split(";")[0]}</span><span><b>Licence</b> {entry.licence}</span><span><b>Import</b> <code>{entry.importPath}</code></span></div>
      {open && <dl className="tl-reg"><div><dt>Adaptations for TSP</dt><dd>{entry.adaptations}</dd></div><div><dt>Variants</dt><dd>{entry.variants}</dd></div><div><dt>States</dt><dd>{entry.states}</dd></div><div><dt>When to use</dt><dd>{entry.whenToUse}</dd></div><div><dt>Full source</dt><dd>{entry.source}</dd></div></dl>}
    </article>
  );
}

/* ── demos (local state; render the real components) ─────────────────────────── */
function SwitchDemo() { const [a, setA] = useState(true); const [b, setB] = useState(false); return <div className="tl-demo-row"><Switch checked={a} onCheckedChange={setA} label="Email the client" /><Switch checked={b} onCheckedChange={setB} label="Pause reminders" /><Switch checked={false} onCheckedChange={() => {}} disabled label="Disabled" /></div>; }
function CheckboxDemo() { const [a, setA] = useState(true); const [b, setB] = useState(false); return <div className="tl-demo-col"><Checkbox checked={a} onChange={setA}>Copy the solicitor</Checkbox><Checkbox checked={b} onChange={setB}>Mark as urgent</Checkbox><Checkbox checked={false} onChange={() => {}} disabled>Disabled</Checkbox></div>; }
function RadioDemo() { const [v, setV] = useState("week"); return <RadioGroup value={v} onChange={setV} options={[{ value: "day", label: "Chase daily", hint: "Every working day" }, { value: "week", label: "Chase weekly", hint: "Once a week" }, { value: "off", label: "Don't chase", hint: "Manual only" }]} />; }
function SliderDemo() { const [v, setV] = useState(58); return <div style={{ maxWidth: 360 }}><Slider value={v} onChange={setV} /><p className="tl-demo-note">Value: {v} — drag: the slab-lens capsule refracts the track & stretches (GPU)</p></div>; }
function SegmentedDemo() { const [v, setV] = useState("week"); return <Segmented value={v} onChange={setV} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />; }
function InputsDemo() { const [a, setA] = useState("14 Bushey Avenue"); const [s, setS] = useState(""); const [n, setN] = useState(""); return (<div className="tl-demo-grid2"><Field label="Property"><Input value={a} onChange={(e) => setA(e.target.value)} clearable onClear={() => setA("")} placeholder="Address" /></Field><Field label="Fee" error="Enter a valid amount"><Input value="abc" onChange={() => {}} error /></Field><Field label="Find a sale"><Search value={s} onChange={(e) => setS(e.target.value)} onClear={() => setS("")} /></Field><Field label="Note to the solicitor"><Textarea value={n} onChange={(e) => setN(e.target.value)} rows={3} placeholder="Message…" /></Field></div>); }
function SelectDemo() { const [v, setV] = useState<string | null>("maple"); return <div style={{ maxWidth: 280 }}><Select value={v} onChange={setV} options={[{ value: "maple", label: "3 Maple Court" }, { value: "bushey", label: "14 Bushey Avenue" }, { value: "oak", label: "41 Oak Lane" }, { value: "river", label: "18 Riverside" }]} /></div>; }
function DateDemo() { const [d, setD] = useState<Date | null>(null); return <DatePicker value={d} onChange={setD} />; }
function StepperDemo() { const [v, setV] = useState(3); return <Stepper value={v} onChange={setV} min={0} max={10} suffix="chases" />; }
function ToggleDemo() { const [a, setA] = useState(true); const [b, setB] = useState(false); return <div className="tl-demo-row"><Toggle pressed={a} onPressedChange={setA}><TextB weight="bold" /> Bold</Toggle><Toggle pressed={b} onPressedChange={setB}>Escalated only</Toggle></div>; }
function TabsDemo() { const [v, setV] = useState("overview"); return <Tabs value={v} onChange={setV} tabs={[{ value: "overview", label: "Overview" }, { value: "timeline", label: "Timeline" }, { value: "documents", label: "Documents" }]} />; }
function PaginationDemo() { const [p, setP] = useState(3); return <Pagination page={p} pages={12} onChange={setP} />; }
function DialogDemo() { const [open, setOpen] = useState(false); return (<><Button onClick={() => setOpen(true)}>Open dialog</Button><Dialog open={open} onClose={() => setOpen(false)} eyebrow="Exchange overdue" title="3 Maple Court" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setOpen(false)}>Set date</Button></>}>Exchange was due 28 October. Set a new expected date, or recalculate from the file&apos;s progress.</Dialog></>); }
function ConfirmDemo() { const [open, setOpen] = useState(false); return (<><Button variant="danger" onClick={() => setOpen(true)}>Withdraw the file</Button><ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => {}} danger title="Withdraw this file?" body="This marks the sale as withdrawn and stops all reminders. You can re-list it later." confirmLabel="Withdraw" /></>); }
function DrawerDemo() { const [open, setOpen] = useState(false); return (<><Button onClick={() => setOpen(true)}>Open drawer</Button><Drawer open={open} onClose={() => setOpen(false)} eyebrow="Chase" title="Duggan & Co" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setOpen(false)}><PaperPlaneTilt weight="fill" /> Send chase</Button></>}><Field label="Message to the solicitor"><Textarea rows={6} defaultValue={"Dear Sirs,\n\nWe should be grateful for your replies to the outstanding enquiries at your earliest convenience.\n\nKind regards"} /></Field></Drawer></>); }
function SheetDemo() { const [open, setOpen] = useState(false); return (<><Button onClick={() => setOpen(true)}>Open sheet</Button><Sheet open={open} onClose={() => setOpen(false)} title="Quick actions" footer={<Button full variant="primary" onClick={() => setOpen(false)}>Done</Button>}><div className="tl-demo-col"><Toggle pressed onPressedChange={() => {}}>Email the client</Toggle><Toggle pressed={false} onPressedChange={() => {}}>Copy the solicitor</Toggle></div></Sheet></>); }
function ToastDemo() { const toast = useToast(); return <div className="tl-demo-row"><Button onClick={() => toast({ text: "Chase sent · Duggan & Co" })}>Success toast</Button><Button variant="secondary" onClick={() => toast({ text: "Nothing to update", tone: "info" })}>Info</Button><Button variant="secondary" onClick={() => toast({ text: "Couldn't reach the server", tone: "warn" })}>Warn</Button></div>; }
function NotificationDemo() { const toast = useToast(); return <Button onClick={() => toast({ title: "Solicitor replied", body: "Duggan & Co answered the boundary enquiry on 3 Maple Court.", tone: "info", action: { label: "Open file", onClick: () => {} } })}>Fire a notification</Button>; }

// Base control + showroom styles. Exported so the isolated /dev/todo-next workspace
// reuses the exact button/input/select/date styling instead of duplicating it.
export const CONTROLS_CSS = `
.tl-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; }
.tl-scene{ position:fixed; inset:0; z-index:0; pointer-events:none; background:radial-gradient(46% 42% at 10% 6%, rgba(255,107,74,0.12), transparent 66%), radial-gradient(40% 36% at 92% 10%, rgba(56,189,248,0.09), transparent 68%); }
.tl-scene-2{ background:radial-gradient(54% 48% at 74% 96%, rgba(168,120,255,0.10), transparent 70%), radial-gradient(40% 40% at 50% 50%, rgba(48,200,160,0.05), transparent 72%); animation:tldrift 22s ease-in-out infinite alternate; }
@keyframes tldrift{ from{ transform:translate(-1.5%,-1%) scale(1.02); } to{ transform:translate(2%,1.5%) scale(1.06); } }
.lg-ds[data-theme="light"] .tl-scene{ background:radial-gradient(46% 42% at 10% 4%, rgba(255,138,101,0.22), transparent 70%), radial-gradient(40% 36% at 92% 8%, rgba(56,189,248,0.16), transparent 70%); }
.lg-ds[data-theme="light"] .tl-scene-2{ background:radial-gradient(54% 48% at 74% 98%, rgba(168,120,255,0.2), transparent 72%), radial-gradient(40% 40% at 50% 50%, rgba(48,200,160,0.08), transparent 72%); }

.tl-top{ position:relative; z-index:2; max-width:1180px; margin:0 auto; padding:34px 28px 16px; display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.tl-kicker{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; letter-spacing:.03em; color:var(--lg-accent-ink); text-transform:uppercase; } .tl-kicker svg{ width:14px; height:14px; }
.tl-top h1{ font-size:clamp(28px,3.4vw,36px); font-weight:820; letter-spacing:-.03em; margin:8px 0 8px; } .tl-top p{ font-size:14px; color:var(--lg-ink-2); max-width:680px; line-height:1.5; }
.tl-theme{ width:50px; height:30px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; flex-shrink:0; } .tl-theme.on{ background:var(--lg-accent-soft); } .tl-theme-knob{ position:absolute; top:2px; left:2px; width:24px; height:24px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; transition:transform .4s cubic-bezier(.3,1.35,.4,1); } .tl-theme-knob svg{ width:12px; height:12px; color:#33343c; } .tl-theme.on .tl-theme-knob{ transform:translateX(20px); }

.tl-shell{ position:relative; z-index:2; max-width:1180px; margin:0 auto; padding:10px 28px 120px; display:grid; grid-template-columns:200px 1fr; gap:26px; }
@media (max-width:860px){ .tl-shell{ grid-template-columns:1fr; } .tl-nav{ position:static !important; } }
.tl-nav{ position:sticky; top:20px; align-self:start; display:flex; flex-direction:column; gap:2px; }
.tl-nav-item{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 12px; border-radius:10px; font-size:13.5px; font-weight:600; color:var(--lg-ink-2); text-decoration:none; transition:background .15s,color .15s; } .tl-nav-item:hover{ background:var(--lg-hover); color:var(--lg-ink); } .tl-nav-count{ font-size:11px; color:var(--lg-ink-3); font-weight:600; }
.tl-nav-foot{ font-size:11px; color:var(--lg-ink-3); margin-top:14px; line-height:1.5; padding:0 12px; } .tl-nav-foot code{ font-size:10.5px; background:var(--lg-fill); padding:1px 5px; border-radius:5px; }

.tl-cat{ margin-bottom:34px; } .tl-cat-head{ display:flex; align-items:baseline; gap:12px; margin-bottom:16px; } .tl-cat-head h2{ font-size:20px; font-weight:780; letter-spacing:-.02em; } .tl-cat-head span{ font-size:12px; color:var(--lg-ink-3); }

.tl-spec{ border:1px solid var(--lg-line-2); border-radius:18px; background:color-mix(in srgb, var(--lg-base) 58%, transparent); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); padding:16px 18px; margin-bottom:14px; }
.lg-ds[data-theme="light"] .tl-spec{ background:rgba(255,255,255,.44); }
.tl-spec-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; } .tl-spec-head h3{ font-size:15px; font-weight:700; } .tl-spec-head p{ font-size:12.5px; color:var(--lg-ink-3); margin-top:2px; }
.tl-spec-toggle{ font:inherit; font-size:11.5px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:8px; padding:5px 10px; cursor:pointer; } .tl-spec-toggle:hover{ color:var(--lg-ink); border-color:var(--lg-ink-3); }
.tl-stage{ margin:16px 0 14px; padding:20px; border-radius:14px; background:var(--lg-fill); border:1px solid var(--lg-line-2); display:flex; flex-direction:column; gap:14px; align-items:flex-start; }
.tl-stage--bench{ padding:0; background:none; border:none; }
.tl-nav-item--lead{ color:var(--lg-ink); font-weight:700; } .tl-nav-item--lead .tl-nav-count{ color:var(--lg-accent-ink); font-weight:700; }
.tl-demo-row{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; } .tl-demo-col{ display:flex; flex-direction:column; gap:12px; align-items:flex-start; } .tl-demo-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; width:100%; } @media (max-width:620px){ .tl-demo-grid2{ grid-template-columns:1fr; } }
.tl-demo-note{ font-size:11.5px; color:var(--lg-ink-3); margin-top:8px; }
.tl-meta{ display:flex; gap:18px; flex-wrap:wrap; font-size:11.5px; color:var(--lg-ink-3); } .tl-meta b{ color:var(--lg-ink-2); font-weight:650; margin-right:4px; } .tl-meta code{ font-size:10.5px; background:var(--lg-fill); padding:1px 6px; border-radius:5px; }
.tl-reg{ margin-top:12px; border-top:1px solid var(--lg-line-2); padding-top:12px; display:flex; flex-direction:column; gap:8px; } .tl-reg div{ display:grid; grid-template-columns:140px 1fr; gap:12px; } .tl-reg dt{ font-size:11.5px; font-weight:700; color:var(--lg-ink-2); } .tl-reg dd{ font-size:12.5px; color:var(--lg-ink-2); line-height:1.5; } @media (max-width:620px){ .tl-reg div{ grid-template-columns:1fr; gap:2px; } }

.tl-ctl-label{ font-size:13.5px; color:var(--lg-ink); } .tl-ctl-hint{ display:block; font-size:11.5px; color:var(--lg-ink-3); margin-top:1px; }
.tl-ctxdemo{ padding:28px; border:1px dashed var(--lg-line); border-radius:12px; font-size:13px; color:var(--lg-ink-3); text-align:center; width:100%; } .tl-pop-demo strong{ display:block; font-size:13.5px; font-weight:700; } .tl-pop-demo p{ font-size:12.5px; color:var(--lg-ink-2); margin:5px 0 10px; }

/* Button */
.tl-btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px; font:inherit; font-size:13.5px; font-weight:650; cursor:pointer; border:none; padding:9px 16px; border-radius:11px; color:var(--lg-ink); position:relative; transition:background .18s,border-color .18s,filter .18s,box-shadow .2s; }
.tl-btn svg{ width:16px; height:16px; } .tl-btn:disabled{ opacity:.45; cursor:not-allowed; } .tl-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tl-btn--primary{ background:var(--lg-accent); color:#fff; box-shadow:0 5px 16px rgba(255,107,74,.3); } .tl-btn--primary:hover:not(:disabled){ filter:brightness(1.07); box-shadow:0 7px 20px rgba(255,107,74,.4); }
.tl-btn--secondary{ background:var(--lg-fill); border:1px solid var(--lg-line); } .tl-btn--secondary:hover:not(:disabled){ border-color:var(--lg-ink-3); background:var(--lg-hover); }
.tl-btn--subtle{ background:transparent; color:var(--lg-ink-2); } .tl-btn--subtle:hover:not(:disabled){ background:var(--lg-hover); color:var(--lg-ink); }
.tl-btn--ghost{ background:transparent; color:var(--lg-ink-2); border:1px solid var(--lg-line); } .tl-btn--ghost:hover:not(:disabled){ color:var(--lg-ink); border-color:var(--lg-ink-3); background:var(--lg-hover); }
.tl-btn--danger{ background:rgba(255,69,58,.14); color:var(--lg-danger-ink); } .tl-btn--danger:hover:not(:disabled){ background:rgba(255,69,58,.22); }
.tl-btn--sm{ padding:6px 12px; font-size:12.5px; border-radius:9px; } .tl-btn--lg{ padding:12px 20px; font-size:15px; border-radius:13px; } .tl-btn--icon{ padding:0; width:38px; height:38px; } .tl-btn--icon.tl-btn--sm{ width:32px; height:32px; } .tl-btn--full{ width:100%; }
.tl-spin{ width:15px; height:15px; border-radius:50%; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; animation:tlspin .7s linear infinite; } .tl-btn--secondary .tl-spin,.tl-btn--ghost .tl-spin{ border-color:var(--lg-line); border-top-color:var(--lg-accent); } @keyframes tlspin{ to{ transform:rotate(360deg); } }

/* Switch */
.tl-switch-row{ display:inline-flex; align-items:center; gap:10px; cursor:pointer; }
.tl-switch{ width:46px; height:28px; border-radius:999px; border:none; padding:0; position:relative; background:rgba(120,120,128,.38); cursor:pointer; transition:background .3s; } .tl-switch[data-state="checked"]{ background:var(--lg-accent); } .tl-switch:disabled{ opacity:.45; cursor:not-allowed; } .tl-switch:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; } .tl-switch-knob{ position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:0 2px 5px rgba(0,0,0,.3); display:block; }

/* Checkbox */
.tl-check-row{ display:inline-flex; align-items:center; gap:10px; background:none; border:none; cursor:pointer; padding:0; } .tl-check-row:disabled{ opacity:.45; cursor:not-allowed; }
.tl-check{ width:21px; height:21px; border-radius:7px; background:var(--lg-field); border:1.5px solid var(--lg-line); display:grid; place-items:center; transition:background .2s,border-color .2s; flex-shrink:0; } .tl-check[data-on]{ background:var(--lg-accent); border-color:var(--lg-accent); }
.tl-check svg{ width:13px; height:13px; } .tl-check svg path{ fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:16; stroke-dashoffset:16; transition:stroke-dashoffset .28s cubic-bezier(.3,1.2,.4,1); } .tl-check[data-on] svg path{ stroke-dashoffset:0; } .tl-check-row:focus-visible{ outline:none; } .tl-check-row:focus-visible .tl-check{ outline:2px solid var(--lg-accent); outline-offset:2px; }

/* Radio */
.tl-radio-group{ display:flex; flex-direction:column; gap:12px; } .tl-radio-row{ display:inline-flex; align-items:flex-start; gap:10px; cursor:pointer; }
.tl-radio{ width:21px; height:21px; border-radius:50%; background:var(--lg-field); border:1.5px solid var(--lg-line); position:relative; flex-shrink:0; margin-top:1px; cursor:pointer; transition:border-color .2s; } .tl-radio[data-state="checked"]{ border-color:var(--lg-accent); } .tl-radio:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; } .tl-radio-dot{ display:block; width:100%; height:100%; position:relative; } .tl-radio-dot::after{ content:""; position:absolute; inset:5px; border-radius:50%; background:var(--lg-accent); }

/* Slider */
.tl-slider{ position:relative; display:flex; align-items:center; height:30px; width:100%; touch-action:none; user-select:none; } .tl-slider-track{ position:relative; flex:1; height:6px; border-radius:999px; background:var(--lg-fill); } .tl-slider-range{ position:absolute; height:100%; border-radius:999px; background:var(--lg-accent); }
.tl-slider-thumb{ display:block; width:44px; height:26px; outline:none; cursor:grab; } .tl-slider-thumb:active{ cursor:grabbing; } .tl-slider-cap{ display:block; width:44px; height:26px; } .tl-slider-lens{ width:44px; height:26px; box-shadow:0 3px 10px rgba(0,0,0,.3), inset 0 1px 1px rgba(255,255,255,.55) !important; } .tl-slider-thumb:focus-visible .tl-slider-lens{ box-shadow:0 0 0 3px var(--lg-accent-soft), 0 0 0 1.5px var(--lg-accent) !important; }

/* Segmented */
.tl-seg{ position:relative; display:inline-grid; padding:3px; border-radius:11px; background:rgba(0,0,0,.2); border:1px solid var(--lg-line); } .lg-ds[data-theme="light"] .tl-seg{ background:rgba(12,16,28,.05); }
.tl-seg-thumb{ position:absolute; top:3px; bottom:3px; left:3px; border-radius:8px; background:var(--lg-fill); box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 1px 3px rgba(20,30,60,.18); } .lg-ds[data-theme="light"] .tl-seg-thumb{ background:#fff; }
.tl-seg-btn{ position:relative; z-index:1; padding:7px 15px; font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; transition:color .3s; } .tl-seg-btn[data-on="true"]{ color:var(--lg-ink); } .tl-seg-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:1px; border-radius:7px; }

/* Field / Input */
.tl-field{ display:flex; flex-direction:column; gap:6px; width:100%; } .tl-field-label{ font-size:11.5px; font-weight:650; color:var(--lg-ink-2); } .tl-field-err{ font-size:11.5px; color:var(--lg-danger-ink); } .tl-field-hint{ font-size:11.5px; color:var(--lg-ink-3); }
.tl-input{ display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:11px; background:var(--lg-field); border:1px solid var(--lg-line); transition:border-color .2s; } .tl-input:focus-within{ border-color:var(--lg-accent); } .tl-input[data-error]{ border-color:var(--lg-danger); }
.tl-input input{ flex:1; min-width:0; background:none; border:none; outline:none; color:var(--lg-ink); font:inherit; font-size:13.5px; } .tl-input input::placeholder{ color:var(--lg-ink-3); }
.tl-input-lead{ display:inline-flex; color:var(--lg-ink-3); } .tl-input-lead svg{ width:16px; height:16px; } .tl-input-clear{ display:inline-grid; place-items:center; width:20px; height:20px; border-radius:50%; background:var(--lg-hover); border:none; color:var(--lg-ink-3); cursor:pointer; } .tl-input-clear:hover{ color:var(--lg-ink); } .tl-input-clear svg{ width:11px; height:11px; }
.tl-textarea{ width:100%; min-height:72px; background:var(--lg-field); border:1px solid var(--lg-line); border-radius:11px; padding:10px 12px; color:var(--lg-ink); font:inherit; font-size:13.5px; line-height:1.5; resize:vertical; transition:border-color .2s; } .tl-textarea:focus{ outline:none; border-color:var(--lg-accent); } .tl-textarea[data-error]{ border-color:var(--lg-danger); } .tl-textarea::placeholder{ color:var(--lg-ink-3); }

/* Select + Date */
.tl-select{ display:inline-flex; align-items:center; justify-content:space-between; gap:10px; width:100%; padding:9px 12px; border-radius:11px; background:var(--lg-field); border:1px solid var(--lg-line); color:var(--lg-ink); font:inherit; font-size:13.5px; cursor:pointer; transition:border-color .2s; } .tl-select:hover{ border-color:var(--lg-ink-3); } .tl-select[data-open]{ border-color:var(--lg-accent); } .tl-select:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; } .tl-select svg{ width:15px; height:15px; color:var(--lg-ink-3); flex-shrink:0; } .tl-select-ph{ color:var(--lg-ink-3); } .tl-datebtn{ justify-content:flex-start; }

/* frosted overlay surface (small portalled overlays) */
.tl-frost{ position:relative; border:1px solid var(--lg-line); background:color-mix(in srgb, var(--lg-base) 92%, transparent); -webkit-backdrop-filter:blur(18px) saturate(165%); backdrop-filter:blur(18px) saturate(165%); box-shadow:0 16px 40px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.16); animation:tlpop .16s ease; } .lg-ds[data-theme="light"] .tl-frost{ background:color-mix(in srgb,#fff 92%, transparent); box-shadow:0 16px 36px rgba(20,30,60,.2), inset 0 1px 0 rgba(255,255,255,.8); } @keyframes tlpop{ from{ opacity:0; transform:translateY(-5px) scale(.985); } to{ opacity:1; transform:none; } }
.tl-cal{ padding:14px; width:268px; } .tl-cal-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; } .tl-cal-head strong{ font-size:13.5px; font-weight:700; } .tl-cal-nav{ width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; } .tl-cal-nav:hover{ color:var(--lg-ink); } .tl-cal-nav svg{ width:13px; height:13px; }
.tl-cal-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; } .tl-cal-dow{ font-size:10px; font-weight:700; color:var(--lg-ink-3); text-align:center; padding-bottom:4px; } .tl-cal-day{ aspect-ratio:1; border-radius:8px; border:none; background:none; color:var(--lg-ink); font:inherit; font-size:12.5px; cursor:pointer; transition:background .15s; } .tl-cal-day:hover{ background:var(--lg-hover); } .tl-cal-day[data-on]{ background:var(--lg-accent); color:#fff; font-weight:700; } .tl-cal-day:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

/* Stepper */
.tl-stepper{ display:inline-flex; align-items:center; gap:2px; padding:3px; border-radius:11px; background:var(--lg-fill); border:1px solid var(--lg-line); } .tl-step-btn{ width:32px; height:32px; border-radius:8px; display:grid; place-items:center; background:none; border:none; color:var(--lg-ink-2); cursor:pointer; transition:background .15s,color .15s; } .tl-step-btn:hover:not(:disabled){ background:var(--lg-hover); color:var(--lg-ink); } .tl-step-btn:disabled{ opacity:.35; cursor:not-allowed; } .tl-step-btn svg{ width:14px; height:14px; } .tl-step-val{ min-width:78px; text-align:center; font-size:13px; font-weight:600; } .tl-step-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

/* Toggle */
.tl-toggle{ display:inline-flex; align-items:center; gap:7px; font:inherit; font-size:13px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:10px; padding:8px 13px; cursor:pointer; transition:background .18s,color .18s,border-color .18s; } .tl-toggle svg{ width:15px; height:15px; } .tl-toggle:hover{ color:var(--lg-ink); border-color:var(--lg-ink-3); } .tl-toggle[data-on]{ background:var(--lg-accent-soft); border-color:var(--lg-accent); color:var(--lg-accent-ink); } .tl-toggle:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }

.tl-portal{ font-family:inherit; }
@media (prefers-reduced-motion: reduce){ .tl-root *, .tl-portal *{ animation:none !important; transition:none !important; } }
`;
