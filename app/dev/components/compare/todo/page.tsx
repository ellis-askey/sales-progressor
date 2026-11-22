"use client";

// TO-DO (/agent/to-do) — canonical-alignment comparison, gallery-style.
//
// Each component is shown isolated on a clean stage like /dev/components:
//   BEFORE = the real shipped markup + real classes (TodoTabs / SectionHeader /
//            Card / PropertyThumb imported LIVE; bespoke bits reproduced with
//            their real agent-system / globals classes).
//   AFTER  = the real canonical, rendered live.
// Register-as-is items show one stage. No approximations.
//
// Dev-only, read-only. Nothing applied. Overlay drawers/modals excluded; the
// inline add-form + reschedule popover are in scope.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ListChecks, CalendarBlank, CalendarCheck, UsersThree, CaretDown,
} from "@phosphor-icons/react";
import { TodoTabs } from "@/components/agent/TodoTabs";
import { SectionHeader } from "@/components/agent/SectionHeader";
import { Card } from "@/components/ui/Card";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { DateField } from "@/components/ui/DateField";
import { buttonClasses } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

type Cls = "A" | "B" | "C" | "D";
const CLS: Record<Cls, { label: string; fg: string }> = {
  A: { label: "COMPLIANT — already canonical", fg: "#15803d" },
  B: { label: "ALIGN — swap to canonical", fg: "#b45309" },
  C: { label: "REGISTER — keep as-is, make it canonical", fg: "#b91c1c" },
  D: { label: "KEEP — intentional (colour = meaning)", fg: "#6d28d9" },
};
function Tag({ k }: { k: Cls }) {
  const t = CLS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: `${t.fg}1e`, border: `1px solid ${t.fg}55`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Stage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ background: "var(--stage-bg)", borderRadius: 14, border: "1px solid var(--stage-line)", padding: 20, minHeight: 60, display: "flex", alignItems: "center", justifyContent: wide ? "flex-start" : "center", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", overflowX: "auto" }}>
      <div style={{ width: wide ? "100%" : "auto", maxWidth: "100%" }}>{children}</div>
    </div>
  );
}
function Lbl({ kind }: { kind: "before" | "after" | "both" }) {
  const m = {
    before: { t: "Before — shipped now", c: "var(--compare-muted)" },
    after: { t: "After — canonical (how it ships)", c: CORAL },
    both: { t: "Current = canonical — register as-is, no change", c: "#b91c1c" },
  }[kind];
  return <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: m.c, marginBottom: 7 }}>{m.t}</span>;
}
function Spec({ n, title, cls, verdict, before, after, both, wide }: {
  n: string; title: string; cls: Cls; verdict: ReactNode; before?: ReactNode; after?: ReactNode; both?: ReactNode; wide?: boolean;
}) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag k={cls} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 900 }}>{verdict}</p>
      {both !== undefined ? (
        <div><Lbl kind="both" /><Stage wide={wide}>{both}</Stage></div>
      ) : (
        <div style={{ display: wide ? "block" : "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0, marginBottom: wide ? 14 : 0 }}><Lbl kind="before" /><Stage wide={wide}>{before}</Stage></div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}><Lbl kind="after" /><Stage wide={wide}>{after}</Stage></div>
        </div>
      )}
    </section>
  );
}

/* ---------- live tab row ---------- */
function TabsLive() {
  const [active, setActive] = useState("todo");
  return (
    <div style={{ width: "100%" }}>
      <TodoTabs
        tabs={[{ key: "todo", label: "Internal", count: 18 }, { key: "agents", label: "From agents" }, { key: "reviews", label: "Reviews", count: 1 }]}
        active={active}
        onChange={setActive}
        action={<button type="button" className="agent-btn agent-btn-sm agent-btn-primary">+ Add to-do</button>}
        glassId="todo-tabs-compare"
        glassLabel="Compare · tabs"
      >
        <span />
      </TodoTabs>
    </div>
  );
}

/* ---------- task checkbox (agent-circle-btn + hover tick) ---------- */
function TaskCheck({ done = false, tone = "info" }: { done?: boolean; tone?: "info" | "warning" }) {
  const [hovered, setHovered] = useState(false);
  const border = done ? "none" : `1.5px solid ${hovered ? "var(--agent-success)" : tone === "warning" ? "var(--agent-warning)" : "var(--agent-info-border)"}`;
  return (
    <button className="agent-circle-btn" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} aria-label={done ? "Reopen" : "Mark as done"}
      style={{ width: 18, height: 18, borderRadius: "50%", border, background: done ? "var(--agent-success)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms", position: "relative" }}>
      {done ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg className={`todo-hover-tick${hovered ? " todo-hover-tick-show" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--agent-success)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute" }}><polyline className="todo-tick-path" points="20 6 9 17 4 12" /></svg>
      )}
    </button>
  );
}

/* ---------- a full task row (real markup) ---------- */
function TaskRow({ check, dateTrigger, noteBox }: { check: ReactNode; dateTrigger: ReactNode; noteBox?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px" }}>
      <div style={{ flexShrink: 0 }}>{check}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: "var(--agent-text-primary)" }}>Chase confirmation that enquiries are satisfied on sale</p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>From WhatsApp: &ldquo;We will indeed — haven&apos;t had it confirmed so I&apos;m chasing it now…&rdquo;</p>
        {noteBox}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right", marginTop: 2 }}>{dateTrigger}</div>
    </div>
  );
}
const DateTriggerBefore = () => (
  <button className="atl-date-btn" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
    <CalendarBlank size={12} weight="bold" className="atl-date-cal" aria-hidden />
    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-danger)" }}>Overdue · 17 days</span>
  </button>
);
// Note box eyebrow is ALL-CAPS today → canonical agent-eyebrow is sentence case.
const NoteBoxBefore = () => (
  <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "var(--agent-surface-subtle, rgba(0,0,0,0.03))", borderLeft: "2px solid var(--agent-border-default)" }}>
    <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Latest update · 4 Nov</p>
    <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>Chased the solicitor, awaiting a reply.</p>
  </div>
);
const NoteBoxAfter = () => (
  <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "var(--agent-surface-subtle, rgba(0,0,0,0.03))", borderLeft: "2px solid var(--agent-border-default)" }}>
    <p className="agent-eyebrow" style={{ margin: "0 0 2px" }}>Latest update · 4 Nov</p>
    <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>Chased the solicitor, awaiting a reply.</p>
  </div>
);

/* ---------- reschedule popover body ---------- */
const ReschedBefore = () => (
  <div style={{ textAlign: "left", width: 244, background: "var(--stage-bg)", border: "1px solid var(--stage-line)", borderRadius: 12, padding: 14 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--agent-text-muted)", marginBottom: 5 }}>New Date</label>
    <input type="date" className="glass-input" style={{ width: "100%", fontSize: 12, padding: "6px 8px", boxSizing: "border-box" }} />
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--agent-text-muted)", margin: "10px 0 5px" }}>Update <span style={{ fontWeight: 500 }}>(optional)</span></label>
    <textarea placeholder="What's happened?" rows={2} className="glass-input" style={{ width: "100%", fontSize: 12, lineHeight: 1.45, padding: "6px 8px", resize: "vertical", boxSizing: "border-box" }} />
    <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
      <button className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
      <button className="agent-btn agent-btn-primary agent-btn-sm">Save</button>
    </div>
  </div>
);
function ReschedAfter() {
  const [d, setD] = useState("");
  return (
    <div style={{ textAlign: "left", width: 244, background: "var(--stage-bg)", border: "1px solid var(--stage-line)", borderRadius: 12, padding: 14 }}>
      <p className="agent-eyebrow" style={{ margin: "0 0 5px" }}>New date</p>
      <DateField value={d} onChange={(e) => setD(e.target.value)} className="agent-input agent-input-sm" style={{ width: "100%", fontSize: 12 }} />
      <p className="agent-eyebrow" style={{ margin: "10px 0 5px" }}>Update (optional)</p>
      <textarea placeholder="What's happened?" rows={2} className="agent-textarea" style={{ width: "100%", fontSize: 12, lineHeight: 1.45, padding: "6px 8px", resize: "vertical", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
        <button className={buttonClasses({ variant: "ghost", size: "sm" })}>Cancel</button>
        <button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#fff" } as CSSProperties}>Save</button>
      </div>
    </div>
  );
}

/* ---------- completed disclosure bar (SectionDisclosure is shim-coupled → reproduced) ---------- */
const DisclosureBar = () => (
  <button style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 12, border: "1px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
    <CaretDown size={13} weight="bold" style={{ color: "var(--agent-text-muted)" }} /> Completed <span style={{ color: "var(--agent-text-muted)", fontWeight: 500 }}>· 6</span>
  </button>
);

/* ---------- inventory ---------- */
const INVENTORY: { item: string; cls: Cls; verdict: string }[] = [
  { item: "PageHeader", cls: "A", verdict: "Shared page-header primitive" },
  { item: "Tab row (Internal / From agents / Reviews)", cls: "C", verdict: "Register TodoTabs as-is (glass count-tabs); or align to arc SegmentedControl" },
  { item: "“+ Add to-do” button", cls: "B", verdict: "agent-btn-primary (glossy) → canonical arc primary (your glossy/flat call, as Chase)" },
  { item: "Section header (icon + title + sub)", cls: "A", verdict: "Shared SectionHeader — register in gallery" },
  { item: "Task group card", cls: "A", verdict: "Canonical Card" },
  { item: "Property header (thumb + address)", cls: "A", verdict: "Canonical PropertyThumb + address text" },
  { item: "Task checkbox (circle + hover tick)", cls: "C", verdict: "Register agent-circle-btn as a canonical TaskCheck (nice hover-tick + done + loading)" },
  { item: "Task title + source line", cls: "A", verdict: "Compliant text" },
  { item: "Note box eyebrow (Latest update)", cls: "B", verdict: "ALL-CAPS enq-style eyebrow → canonical agent-eyebrow (sentence case)" },
  { item: "Overdue badge", cls: "D", verdict: "Semantic coloured text (amber/red) — keep" },
  { item: "Due / reschedule trigger", cls: "A", verdict: "atl-date-btn — a quiet text+icon trigger, compliant (register)" },
  { item: "Reschedule popover fields", cls: "B", verdict: "glass-input date → DateField; textarea → agent-textarea; agent-btn → arc Button" },
  { item: "Completed disclosure bar", cls: "A", verdict: "Canonical SectionDisclosure" },
  { item: "Add-to-do inline form", cls: "B", verdict: "Its inputs → canonical LabelInput / DateField; add button → arc" },
  { item: "Empty states (per-tab + onboarding)", cls: "A", verdict: "Canonical empty-card / SetupCard hero" },
  { item: "loading.tsx skeleton", cls: "A", verdict: "Canonical Skeleton" },
];

export default function TodoComparePage() {
  const restore = useRef<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  // The agent app has no "light" theme — its default light theme is "sunset"
  // (lib/agent/use-portal-theme.ts). Map our Light/Dark toggle onto the real
  // theme values so the FULL --agent-* semantic token set (info/warning/success/
  // danger borders + bg, input surfaces) is defined — otherwise bespoke classes
  // render half-styled (invisible circles, borderless inputs).
  const themeAttr = theme === "light" ? "sunset" : "dark";
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", themeAttr); }, [themeAttr]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars: CSSProperties = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
    ["--stage-bg" as string]: theme === "dark" ? "#201b14" : "#ffffff",
    ["--stage-line" as string]: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,23,30,0.07)",
  };
  const tog = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });
  const counts = INVENTORY.reduce((a, r) => { a[r.cls] = (a[r.cls] ?? 0) + 1; return a; }, {} as Record<Cls, number>);

  return (
    <div className="agent-shell-root nv2-night" data-theme={themeAttr} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Compare · To-Do (/agent/to-do)</span>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>To-Do — canonical alignment</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 820 }}>
          One component per row, clean like the gallery. <b style={{ color: CLS.B.fg }}>Before</b> = the real shipped component. <b style={{ color: CLS.B.fg }}>After</b> = the real canonical, live. <b style={{ color: CLS.C.fg }}>Register</b> items show one stage — keep exactly, make it official.
        </p>

        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "11px 16px", background: "var(--stage-bg)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>{INVENTORY.length} components</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}><b style={{ color: CLS.A.fg }}>{counts.A ?? 0} compliant</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} register</b> · <b style={{ color: CLS.D.fg }}>{counts.D ?? 0} keep</b></span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {INVENTORY.map((r) => (
                  <tr key={r.item} style={{ borderTop: "1px solid var(--compare-line)" }}>
                    <td style={{ padding: "7px 16px", color: "var(--compare-ink)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.item}</td>
                    <td style={{ padding: "7px 16px" }}><span style={{ color: CLS[r.cls].fg, fontWeight: 700 }}>{r.cls}</span></td>
                    <td style={{ padding: "7px 16px", color: "var(--compare-body)" }}>{r.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* components */}
        <Spec n="1" title="Tab row — Internal / From agents / Reviews" cls="C" wide verdict={<>The glass segmented tabs with count pills + the Add action (real <code>TodoTabs</code>). Richer than the arc SegmentedControl (counts + action slot), so proposed to register as-is. Or align to arc SegmentedControl if you&apos;d rather one tab system app-wide — your call.</>} both={<TabsLive />} />
        <Spec n="2" title="“+ Add to-do” button" cls="B" verdict={<>Current is the glossy <code>agent-btn-primary</code>. Proposed is the canonical arc primary (flat coral via token). Same glossy-vs-flat call you made on the Chase button — shown so you can pick.</>}
          before={<button className="agent-btn agent-btn-sm agent-btn-primary">+ Add to-do</button>}
          after={<button className={buttonClasses({ variant: "primary", size: "sm" })} style={{ ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#fff" } as CSSProperties}>+ Add to-do</button>} />
        <Spec n="3" title="Section header" cls="A" verdict={<>Icon-in-coral-circle + title + subtitle (+ optional count) — the shared <code>SectionHeader</code>. Compliant; register in the gallery. Shown live.</>}
          both={<div style={{ width: "100%" }}><SectionHeader icon={<ListChecks size={22} weight="regular" />} title="Internal to-dos" subtitle="Your team's notes and follow-ups." /></div>} />
        <Spec n="4" title="Task group card (header + rows)" cls="A" wide verdict={<>The property-grouped card — canonical <code>Card</code> + <code>PropertyThumb</code> header, then task rows. Shown live (real Card + PropertyThumb + reproduced rows).</>}
          both={<Card glassId="todo-compare-group" padding="none">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 10px" }}>
              <PropertyThumb photoUrl={null} size={48} />
              <div style={{ minWidth: 0 }}><span className="todo-addr" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>19 Bodge Piece</span><p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Aylesbury · HP22 3BR</p></div>
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)" }}>
              <TaskRow check={<TaskCheck tone="info" />} dateTrigger={<DateTriggerBefore />} />
            </div>
          </Card>} />
        <Spec n="5" title="Task checkbox (circle + hover tick)" cls="C" verdict={<>The 18px circle toggle — empty ring → hovers a draw-on tick → fills green when done → spins while saving. A lovely, reusable control. Register <code>agent-circle-btn</code> as a canonical TaskCheck. (Hover the empty one.)</>}
          both={<div style={{ display: "flex", gap: 20, alignItems: "center" }}><div style={{ textAlign: "center" }}><TaskCheck tone="info" /><span style={{ display: "block", fontSize: 10, color: "var(--compare-muted)", marginTop: 6 }}>open (hover)</span></div><div style={{ textAlign: "center" }}><TaskCheck tone="warning" /><span style={{ display: "block", fontSize: 10, color: "var(--compare-muted)", marginTop: 6 }}>progressor</span></div><div style={{ textAlign: "center" }}><TaskCheck done /><span style={{ display: "block", fontSize: 10, color: "var(--compare-muted)", marginTop: 6 }}>done</span></div></div>} />
        <Spec n="6" title="“Latest update” note box — eyebrow" cls="B" verdict={<><strong>The ALL-CAPS fix.</strong> The note box eyebrow is uppercase like the enquiries one. Proposed: the canonical <code>agent-eyebrow</code> (sentence case). The box tint + border stay.</>}
          before={<div style={{ width: 320 }}><NoteBoxBefore /></div>} after={<div style={{ width: 320 }}><NoteBoxAfter /></div>} />
        <Spec n="7" title="Reschedule popover fields" cls="B" verdict={<>The date + update popover (the Popover itself is canonical). Current uses <code>glass-input</code> + <code>agent-btn</code>. Proposed: canonical <code>DateField</code> + <code>agent-textarea</code> + arc Buttons, eyebrow labels sentence-case.</>}
          before={<ReschedBefore />} after={<ReschedAfter />} />
        <Spec n="8" title="Completed disclosure bar" cls="A" verdict={<>The collapsible “Completed · N” bar is the canonical <code>SectionDisclosure</code> (shim-coupled, so reproduced here). Compliant — no change.</>}
          both={<div style={{ width: 360 }}><DisclosureBar /></div>} />
      </div>
    </div>
  );
}
