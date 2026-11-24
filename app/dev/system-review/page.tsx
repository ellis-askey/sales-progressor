"use client";
// /dev/system-review — the single visual-approval environment for the forward TSP
// Liquid-Glass system. Renders the ACTUAL candidate implementations from
// components/liquid/ui (no showroom copies), in realistic TSP context, light+dark.
// Nothing here is approved until founder review. Dev-only.

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  PaperPlaneTilt, Note, Plus, Sun, MoonStars, Sparkle, Pencil, Trash, Bell,
} from "@phosphor-icons/react";
import {
  GLASS_CSS, cn, ThemeCtx, type Theme, Surface, TravellingSelection,
  Button, IconButton, Input, Textarea, Field, Select, DatePicker, Checkbox, Segmented, Search,
  Drawer, Dialog, ConfirmDialog, DropdownMenu, ToastProvider, useToast,
  EmptyState, Pill, Skeleton, Spinner,
} from "@/components/liquid/ui";
import "@/app/styles/liquid-glass.css";

const FILES = [
  { addr: "3 Maple Court", loc: "Hertford · SG14 1QF", status: "Exchange due", tone: "warn" as const, pct: 72 },
  { addr: "14 Bushey Avenue", loc: "Watford · WD23 2AA", status: "Enquiries", tone: "info" as const, pct: 48 },
  { addr: "41 Oak Lane", loc: "St Albans · AL1 3RT", status: "Searches back", tone: "coral" as const, pct: 61 },
  { addr: "18 Riverside", loc: "Ware · SG12 9AB", status: "On hold", tone: "neutral" as const, pct: 30 },
];

export default function SystemReview() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  return (
    <ThemeCtx.Provider value={theme}>
      <ToastProvider>
        <div className="lg-ds sr-root" data-theme={theme}>
          <style dangerouslySetInnerHTML={{ __html: GLASS_CSS + REVIEW_CSS }} />
          <Review theme={theme} setTheme={setTheme} />
        </div>
      </ToastProvider>
    </ThemeCtx.Provider>
  );
}

function Review({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <>
      <header className="sr-top">
        <div>
          <span className="sr-kicker"><Sparkle weight="fill" /> TSP Liquid Glass · system review · nothing approved yet</span>
          <h1>One system, light and dark</h1>
          <p>The actual candidate components, in realistic context. Approve a component and that exact implementation becomes canonical.</p>
        </div>
        <button className={cn("sr-theme", theme === "light" && "on")} aria-label="Toggle light and dark" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <span className="sr-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
        </button>
      </header>

      <div className="sr-legend">
        <span className="sr-stat sr-stat--approved">Approved</span> optical engine (LiquidLens) · spring motion
        <span className="sr-dot" />
        <span className="sr-stat sr-stat--cand">Candidate</span> everything below — pending your review
      </div>

      {/* ── Materials against realistic content ── */}
      <Section title="Materials" status="candidate" note="Solid for content, frosted glass for overlays, refraction reserved for floating elements — judged over real content, not a demo backdrop.">
        <div className="sr-stage sr-stage--photo">
          <div className="sr-contentlayer" aria-hidden>
            {FILES.map((f) => (
              <div key={f.addr} className="sr-filecard">
                <div className="sr-filethumb" />
                <div><b>{f.addr}</b><span>{f.loc}</span></div>
                <Pill tone={f.tone}>{f.status}</Pill>
              </div>
            ))}
          </div>
          <div className="sr-mats">
            <Surface material="solid" radius={16} className="sr-matcard"><b>Solid</b><p>Dense content and controls. Opaque, highest legibility.</p></Surface>
            <Surface material="frost" radius={16} className="sr-matcard"><b>Frosted</b><p>Overlays and chrome over content. Blurs, keeps context.</p></Surface>
            <Surface material="lens" radius={16} lensThickness={1.4} className="sr-matcard sr-matcard--lens"><b>Refractive</b><p>Floating interactive elements. Genuine optical glass.</p></Surface>
          </div>
        </div>
      </Section>

      {/* ── Travelling selection ── */}
      <Section title="Travelling selection" status="candidate" note="One continuous glass pill that slides and resizes. Keyboard: arrows / Home / End.">
        <SelectionDemo />
      </Section>

      {/* ── Buttons & controls ── */}
      <Section title="Buttons & controls" status="candidate" note="All interaction states. One coral primary per surface; the rest quiet.">
        <div className="sr-row"><Button variant="primary"><PaperPlaneTilt weight="fill" /> Send chase</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="subtle">Subtle</Button><Button variant="danger"><Trash weight="regular" /> Withdraw</Button></div>
        <div className="sr-row"><Button variant="primary" size="sm">Small</Button><Button variant="primary">Medium</Button><Button variant="primary" size="lg">Large</Button><Button variant="primary" loading>Sending</Button><Button variant="secondary" disabled>Disabled</Button><IconButton label="Alerts" variant="secondary"><Bell weight="fill" /></IconButton></div>
        <div className="sr-row"><CheckRow /></div>
      </Section>

      {/* ── Inputs, validation, select, date, dropdown ── */}
      <Section title="Inputs & selection" status="candidate" note="Crafted fields with real focus rings and error states — not generic grey boxes.">
        <InputsDemo />
      </Section>

      {/* ── Overlays: drawer, modal, confirm, nested, toast ── */}
      <Section title="Overlays" status="candidate" note="Complete drawer and modal built from the same controls; nested dropdown + confirmation; frosted regular-variant glass.">
        <OverlaysDemo />
      </Section>

      {/* ── States ── */}
      <Section title="Empty · loading · disabled · error" status="candidate" note="The states every real surface needs.">
        <div className="sr-grid3">
          <div className="sr-statebox"><span className="sr-statelab">Empty</span><Surface material="solid" radius={14}><EmptyState title="No sales need you" body="Nothing is waiting. We'll surface the next thing the moment it lands." cta={<Button variant="primary" size="sm"><Plus weight="bold" /> Add a sale</Button>} /></Surface></div>
          <div className="sr-statebox"><span className="sr-statelab">Loading</span><Surface material="solid" radius={14} className="sr-pad"><div className="sr-loadrow"><Spinner /> <span>Loading your files…</span></div><Skeleton lines={3} /></Surface></div>
          <div className="sr-statebox"><span className="sr-statelab">Disabled · error</span><Surface material="solid" radius={14} className="sr-pad"><Field label="Fee" error="Enter a valid amount"><Input value="abc" onChange={() => {}} error /></Field><div style={{ height: 10 }} /><Field label="Reference (locked)"><Input value="TSP-0043" onChange={() => {}} disabled /></Field></Surface></div>
        </div>
      </Section>

      <footer className="sr-foot">Candidate system · <code>components/liquid/ui</code> · promote only on approval.</footer>
    </>
  );
}

function Section({ title, status, note, children }: { title: string; status: "candidate" | "approved"; note: string; children: React.ReactNode }) {
  return (
    <section className="sr-section">
      <div className="sr-sechead"><h2>{title}</h2><span className={cn("sr-stat", status === "approved" ? "sr-stat--approved" : "sr-stat--cand")}>{status === "approved" ? "Approved" : "Candidate"}</span></div>
      <p className="sr-secnote">{note}</p>
      <div className="sr-secbody">{children}</div>
    </section>
  );
}

function SelectionDemo() {
  const [a, setA] = useState("week"); const [b, setB] = useState("overview"); const [c, setC] = useState("all");
  return (
    <div className="sr-col">
      <div className="sr-selrow"><span className="sr-sellab">Segmented</span><Segmented value={a} onChange={setA} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} ariaLabel="Range" /></div>
      <div className="sr-selrow"><span className="sr-sellab">Tabs</span><TravellingSelection variant="tabs" ariaLabel="Views" value={b} onChange={setB} items={[{ value: "overview", label: "Overview" }, { value: "timeline", label: "Timeline" }, { value: "documents", label: "Documents" }]} /></div>
      <div className="sr-selrow"><span className="sr-sellab">Filter bar</span><Segmented value={c} onChange={setC} options={[{ value: "all", label: "All" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Today" }, { value: "done", label: "Done" }]} ariaLabel="Filter" /></div>
    </div>
  );
}
function CheckRow() {
  const [a, setA] = useState(true); const [b, setB] = useState(false);
  return <div className="sr-row"><Checkbox checked={a} onChange={setA}>Copy the solicitor</Checkbox><Checkbox checked={b} onChange={setB}>Mark as urgent</Checkbox><Checkbox checked={false} onChange={() => {}} disabled>Disabled</Checkbox></div>;
}
function InputsDemo() {
  const [addr, setAddr] = useState("14 Bushey Avenue"); const [q, setQ] = useState(""); const [note, setNote] = useState("");
  const [file, setFile] = useState<string | null>("maple"); const [date, setDate] = useState<Date | null>(null);
  return (
    <div className="sr-grid2">
      <Field label="Property"><Input value={addr} onChange={(e) => setAddr(e.target.value)} clearable onClear={() => setAddr("")} placeholder="Address" /></Field>
      <Field label="Find a sale"><Search value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} /></Field>
      <Field label="Which file"><Select value={file} onChange={setFile} options={[{ value: "maple", label: "3 Maple Court" }, { value: "bushey", label: "14 Bushey Avenue" }, { value: "oak", label: "41 Oak Lane" }]} /></Field>
      <Field label="Bring back on"><DatePicker value={date} onChange={setDate} /></Field>
      <div style={{ gridColumn: "1 / -1" }}><Field label="Note to the solicitor"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's happened?" /></Field></div>
      <div className="sr-row" style={{ gridColumn: "1 / -1" }}><DropdownMenu label="Actions" items={[{ label: "Mark as chased", icon: <PaperPlaneTilt weight="regular" /> }, { label: "Add a note", icon: <Pencil weight="regular" /> }, { label: "Remove", danger: true, icon: <Trash weight="regular" /> }]} /><span className="sr-selnote">Dropdown menu · frosted, anchored, keyboard + Esc</span></div>
    </div>
  );
}
function OverlaysDemo() {
  const [drawer, setDrawer] = useState(false); const [modal, setModal] = useState(false); const [confirm, setConfirm] = useState(false);
  const [title, setTitle] = useState(""); const [owner, setOwner] = useState("mine"); const [date, setDate] = useState<Date | null>(null);
  const toast = useToast();
  return (
    <>
      <div className="sr-row">
        <Button variant="secondary" onClick={() => setDrawer(true)}><Note weight="regular" /> Open drawer</Button>
        <Button variant="secondary" onClick={() => setModal(true)}><Pencil weight="regular" /> Open modal</Button>
        <Button variant="secondary" onClick={() => toast({ title: "Chase sent", body: "Duggan & Co · 3 Maple Court", tone: "ok", action: { label: "Open file", onClick: () => {} } })}>Fire a toast</Button>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} eyebrow="New to-do" title="Add a to-do"
        footer={<><Button variant="ghost" onClick={() => setDrawer(false)}>Cancel</Button><Button variant="primary" disabled={!title.trim()} onClick={() => { setConfirm(true); }}>Add</Button></>}>
        <Field label="What needs doing?"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" /></Field>
        <Field label="Who's it for?"><Segmented value={owner} onChange={setOwner} options={[{ value: "mine", label: "Mine" }, { value: "prog", label: "Your progressor" }]} ariaLabel="Owner" /></Field>
        <Field label="Due date"><DatePicker value={date} onChange={setDate} /></Field>
        <Field label="Action"><DropdownMenu label="Attach to a file" items={[{ label: "3 Maple Court" }, { label: "14 Bushey Avenue" }, { label: "41 Oak Lane" }]} /></Field>
      </Drawer>

      <Dialog open={modal} onClose={() => setModal(false)} eyebrow="Reschedule" title="3 Maple Court"
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => { setModal(false); toast({ text: "Rescheduled", tone: "ok" }); }}>Save</Button></>}>
        <Field label="New date"><DatePicker value={date} onChange={setDate} /></Field>
        <div style={{ height: 10 }} />
        <Field label="Update (optional)"><Textarea rows={3} placeholder="What's happened?" /></Field>
      </Dialog>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setDrawer(false); toast({ text: "Added", tone: "ok" }); }} title="Add this to-do?" body="Nested confirmation opened from inside the drawer." confirmLabel="Add" />
      <span className="sr-selnote">The drawer, modal and confirmation share the same controls, materials, type and motion.</span>
    </>
  );
}

const REVIEW_CSS = `
.sr-root{ position:relative; min-height:100vh; background:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.01em; -webkit-font-smoothing:antialiased; padding:0 0 100px; }
.sr-top{ max-width:1080px; margin:0 auto; padding:40px 28px 16px; display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.sr-kicker{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--lg-accent-ink); } .sr-kicker svg{ width:14px; height:14px; }
.sr-top h1{ font-size:clamp(26px,3.2vw,34px); font-weight:760; letter-spacing:-.03em; margin:9px 0 7px; } .sr-top p{ font-size:14px; color:var(--lg-ink-2); max-width:560px; line-height:1.5; }
.sr-theme{ width:50px; height:30px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; flex-shrink:0; box-shadow:inset 0 1px 2px var(--track-inset); } .sr-theme.on{ background:var(--lg-accent-soft); } .sr-theme-knob{ position:absolute; top:2px; left:2px; width:24px; height:24px; border-radius:50%; background:var(--surface-2); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); display:grid; place-items:center; transition:transform .4s cubic-bezier(.3,1.35,.4,1); } .sr-theme-knob svg{ width:13px; height:13px; color:var(--lg-ink-2); } .sr-theme.on .sr-theme-knob{ transform:translateX(20px); }
.sr-legend{ max-width:1080px; margin:6px auto 0; padding:0 28px; font-size:12.5px; color:var(--lg-ink-3); display:flex; align-items:center; gap:8px; flex-wrap:wrap; } .sr-dot{ width:3px; height:3px; border-radius:50%; background:var(--lg-ink-3); margin:0 4px; }
.sr-stat{ display:inline-flex; align-items:center; font-size:10.5px; font-weight:700; letter-spacing:-.003em; padding:2px 8px; border-radius:999px; } .sr-stat--approved{ color:#3aa76d; background:color-mix(in srgb,#3aa76d 15%, transparent); } .sr-stat--cand{ color:var(--lg-accent-ink); background:var(--lg-accent-soft); }

.sr-section{ max-width:1080px; margin:0 auto; padding:30px 28px 0; }
.sr-sechead{ display:flex; align-items:center; gap:10px; } .sr-sechead h2{ font-size:19px; font-weight:720; letter-spacing:-.022em; } .sr-secnote{ font-size:13px; color:var(--lg-ink-3); margin:5px 0 16px; max-width:640px; line-height:1.5; }
.sr-secbody{ display:flex; flex-direction:column; gap:14px; }
.sr-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; } .sr-col{ display:flex; flex-direction:column; gap:16px; }

.sr-stage{ position:relative; border-radius:20px; overflow:hidden; border:1px solid var(--lg-line-2); padding:22px; }
.sr-stage--photo{ background:radial-gradient(60% 80% at 14% 10%, rgba(255,170,120,.5), transparent 55%), radial-gradient(55% 70% at 86% 16%, rgba(110,170,255,.45), transparent 58%), radial-gradient(70% 70% at 70% 100%, rgba(80,190,150,.4), transparent 55%), var(--lg-base); }
.sr-contentlayer{ display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px; margin-bottom:18px; }
.sr-filecard{ display:flex; align-items:center; gap:11px; padding:11px 13px; border-radius:13px; background:var(--surface); border:1px solid var(--lg-line); box-shadow:var(--sh-ctl), inset 0 1px 0 var(--edge-top); } .sr-filethumb{ width:40px; height:40px; border-radius:9px; flex-shrink:0; background:linear-gradient(140deg, rgba(255,140,100,.5), rgba(110,160,255,.4)); } .sr-filecard b{ display:block; font-size:13px; font-weight:650; } .sr-filecard span{ display:block; font-size:11px; color:var(--lg-ink-3); margin-top:1px; }
.sr-mats{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; } @media (max-width:760px){ .sr-mats{ grid-template-columns:1fr; } }
.sr-matcard{ padding:16px; } .sr-matcard b{ display:block; font-size:14px; font-weight:680; margin-bottom:5px; } .sr-matcard p{ font-size:12px; color:var(--lg-ink-2); line-height:1.45; } .sr-matcard--lens{ color:#fff; } .sr-matcard--lens b{ color:#fff; } .sr-matcard--lens p{ color:rgba(255,255,255,.88); }

.sr-selrow{ display:flex; align-items:center; gap:16px; } .sr-sellab{ width:90px; flex-shrink:0; font-size:12px; font-weight:600; color:var(--lg-ink-3); } .sr-selnote{ font-size:12px; color:var(--lg-ink-3); }

.sr-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; } @media (max-width:640px){ .sr-grid2{ grid-template-columns:1fr; } }
.sr-grid3{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; } @media (max-width:820px){ .sr-grid3{ grid-template-columns:1fr; } }
.sr-statebox{ display:flex; flex-direction:column; gap:8px; } .sr-statelab{ font-size:11.5px; font-weight:600; color:var(--lg-ink-3); } .sr-pad{ padding:18px; } .sr-loadrow{ display:flex; align-items:center; gap:9px; font-size:13px; color:var(--lg-ink-2); margin-bottom:14px; }

.sr-foot{ max-width:1080px; margin:40px auto 0; padding:20px 28px 0; border-top:1px solid var(--lg-line-2); font-size:12px; color:var(--lg-ink-3); } .sr-foot code{ font-size:11px; background:var(--lg-fill); padding:1px 6px; border-radius:5px; }
`;
