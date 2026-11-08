"use client";
// Workspace Lab — "the bench" (v3). One art-directed surface: a floating glass dock
// of properties, and a single luminous bench carrying one story (this house, the
// hold-up, the conversation, your move) beside the day's work. Local state only;
// would-be side effects surface as prototype toasts. No DB, no production code.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { PaperPlaneTilt, Check, ChatCircleDots, SealCheck, Sun, MoonStars } from "@phosphor-icons/react";
import { LAB_CSS } from "./styles";
import { PROPERTIES, WORK, TODAY, STAGES, type Property, type WorkItem, type Tone } from "./mock";

const TONE: Record<Tone, string> = {
  coral: "var(--t-coral)", amber: "var(--t-amber)", blue: "var(--t-blue)", green: "var(--t-green)", slate: "var(--t-slate)",
};

export default function WorkspaceLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lab />;
}

function Lab() {
  const [selectedId, setSelectedId] = useState(PROPERTIES[0].id);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);
  const [threadOpen, setThreadOpen] = useState(false);
  const [work, setWork] = useState<WorkItem[]>(() => JSON.parse(JSON.stringify(WORK)));
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = useMemo(() => PROPERTIES.find((p) => p.id === selectedId)!, [selectedId]);
  const left = work.filter((w) => !w.done).length;

  const say = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const pick = (id: string) => { setSelectedId(id); setThreadOpen(false); };

  const toggle = (id: string) => {
    let became = false;
    setWork((cur) => cur.map((w) => (w.id === id ? ((became = !w.done), { ...w, done: !w.done }) : w)));
    const item = work.find((w) => w.id === id);
    if (became && item) say(`Done. ${item.title}`, () => setWork((cur) => cur.map((w) => (w.id === id ? { ...w, done: false } : w))));
  };

  return (
    <div className="wl-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: LAB_CSS }} />

      <div className="wl-shell">
        <Dock selectedId={selectedId} onPick={pick} theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          onMe={() => say("Prototype. Your account would open here")} />

        <div className="wl-bench">
          <Story key={selected.id} p={selected} threadOpen={threadOpen} onThread={() => setThreadOpen((v) => !v)} say={say} />
          <div className="wl-seam" aria-hidden />
          <Day work={work} left={left} here={selected.line1} openItem={openItem}
            onOpen={(id) => setOpenItem((v) => (v === id ? null : id))} onToggle={toggle} say={say} />
        </div>
      </div>

      {toast && (
        <div className="wl-toast" role="status">
          <SealCheck weight="fill" />{toast.msg}
          {toast.undo && <button onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

// ── dock ─────────────────────────────────────────────────────────────────────
function Dock({ selectedId, onPick, onMe, theme, onToggleTheme }: {
  selectedId: string; onPick: (id: string) => void; onMe: () => void; theme: "light" | "dark"; onToggleTheme: () => void;
}) {
  return (
    <nav className="wl-dock" aria-label="Your sales">
      <div className="wl-mark" aria-hidden>s</div>
      <div className="wl-dock-rule" />
      <div className="wl-dock-cap">Sales</div>
      <div className="wl-book">
        {PROPERTIES.map((p) => (
          <button key={p.id} className="wl-thumb" data-on={p.id === selectedId || undefined}
            style={{ backgroundImage: `url(${p.photo})` }} onClick={() => onPick(p.id)}
            aria-label={`${p.line1}, ${p.town}`} aria-current={p.id === selectedId || undefined}>
            <span className="wl-thumb-dot" style={{ background: TONE[p.statusTone] }} />
            <span className="wl-thumb-label"><b>{p.line1}</b><span>{p.town}</span></span>
          </button>
        ))}
      </div>
      <div className="wl-dock-foot">
        <button className="wl-theme-btn" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}>
          {theme === "dark" ? <Sun weight="fill" /> : <MoonStars weight="fill" />}
        </button>
        <button className="wl-me" onClick={onMe} aria-label="Your account">EA</button>
      </div>
    </nav>
  );
}

// ── story (narrative region) ─────────────────────────────────────────────────
function Story({ p, threadOpen, onThread, say }: { p: Property; threadOpen: boolean; onThread: () => void; say: (m: string) => void }) {
  const thread = p.enquiry.thread;
  const latest = thread[thread.length - 1];
  const earlier = thread.slice(0, -1);
  return (
    <section className="wl-story">
      <div className="wl-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="wl-addr">{p.line1}</h1>
          <p className="wl-addr-sub">{p.town}&ensp;{p.postcode}</p>
        </div>
        <div className="wl-price"><b>{p.price}</b><span>{p.tenure}</span></div>
      </div>

      <div className="wl-plate">
        <img src={p.photo} alt={`${p.line1}, ${p.town}`} />
        <div className="wl-plate-cap">
          <span className="wl-plate-stage" style={{ ["--tc" as string]: TONE[p.statusTone] }}><i />{p.stage}</span>
        </div>
        <span className="wl-plate-pct wl-num">{Math.round(p.progress * 100)}% to completion</span>
      </div>

      <div className="wl-hold">
        <div className="wl-hold-top">
          <h2 className="wl-hold-h">{p.enquiry.title}</h2>
          <div className="wl-metric"><b>{p.enquiry.waiting}</b><span>waiting</span></div>
        </div>
        <p className="wl-hold-sum">{p.enquiry.summary}</p>

        <div className="wl-well">
          <div className="wl-well-h">
            <span>The conversation so far</span>
            {earlier.length > 0 && (
              <button className="wl-well-more" onClick={onThread}>{threadOpen ? "Hide earlier" : `Show earlier (${earlier.length})`}</button>
            )}
          </div>
          <div className="wl-note-collapsed" data-open={threadOpen || undefined}>
            {earlier.map((n, i) => <Note key={i} n={n} />)}
          </div>
          <Note n={latest} />
        </div>

        <div className="wl-act">
          <button className="wl-primary" onClick={() => say("Prototype. A reply to the solicitor would open")}>
            <PaperPlaneTilt weight="fill" />Reply to the solicitor
          </button>
          <button className="wl-quiet" onClick={() => say("Prototype. A note to the seller would open")}>Ask the seller</button>
        </div>
      </div>

      <div className="wl-engrave" />

      <div className="wl-clients">
        <Client p={p.seller} say={say} /><Client p={p.buyer} say={say} />
      </div>

      <Timeline stage={p.stage} />
    </section>
  );
}

function Timeline({ stage }: { stage: string }) {
  const ci = STAGES.indexOf(stage);
  return (
    <div className="wl-timeline">
      <p className="wl-timeline-h">Where this sale is</p>
      <div className="wl-steps">
        {STAGES.map((s, i) => (
          <div key={s} className="wl-step" data-done={i < ci || undefined} data-current={i === ci || undefined}>
            <span className="wl-node" />
            <span className="wl-step-l">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Note({ n }: { n: Property["enquiry"]["thread"][number] }) {
  return (
    <div className="wl-note" data-side={n.side}>
      <div className="wl-note-av">{n.side === "you" ? "You" : initials(n.from)}</div>
      <div style={{ minWidth: 0 }}>
        <div className="wl-note-h"><span className="wl-note-from">{n.from}</span><span className="wl-note-when">{n.when}</span></div>
        <div className="wl-note-body">{n.body}</div>
      </div>
    </div>
  );
}

function Client({ p, say }: { p: Property["seller"]; say: (m: string) => void }) {
  return (
    <div className="wl-client">
      <div className="wl-client-av" style={{ background: `linear-gradient(150deg, hsl(${p.hue} 40% 94%), hsl(${p.hue} 38% 88%))`, color: `hsl(${p.hue} 44% 34%)` }}>{p.initials}</div>
      <div style={{ minWidth: 0 }}>
        <div className="wl-client-role">{p.role}</div>
        <div className="wl-client-name">{p.name}</div>
        <div className={`wl-client-recency wl-rc-${p.state}`}><i />{p.lastContact}</div>
      </div>
      <button className="wl-client-do" onClick={() => say(`Prototype. Message ${first(p.name)}`)} aria-label={`Message ${first(p.name)}`}>
        <ChatCircleDots weight="regular" />
      </button>
    </div>
  );
}

// ── day (right region) ───────────────────────────────────────────────────────
function Day({ work, left, here, openItem, onOpen, onToggle, say }: {
  work: WorkItem[]; left: number; here: string; openItem: string | null;
  onOpen: (id: string) => void; onToggle: (id: string) => void; say: (m: string) => void;
}) {
  return (
    <section className="wl-day" aria-label="Today">
      <div className="wl-day-h">
        <h2 className="wl-day-title">Today</h2>
        <span className="wl-day-date">{TODAY.date}</span>
      </div>
      <p className="wl-day-lede">{TODAY.lede}</p>

      <div className="wl-progress">
        <div className="wl-ticks">{work.map((w) => <span key={w.id} className="wl-tick" data-done={w.done || undefined} />)}</div>
        <span className="wl-progress-l"><b>{left}</b> left</span>
      </div>

      <div className="wl-list">
        {work.map((w) => {
          const open = openItem === w.id;
          const hereNow = w.property === here;
          const urgent = w.when === "Overdue" || w.when === "Due today";
          return (
            <div key={w.id} className="wl-item" data-open={open || undefined} data-done={w.done || undefined} onClick={() => onOpen(w.id)}>
              <div className="wl-item-row">
                <button className="wl-tick-btn" onClick={(e) => { e.stopPropagation(); onToggle(w.id); }} aria-pressed={w.done} aria-label={w.done ? "Mark undone" : "Mark done"}><Check weight="bold" /></button>
                <div style={{ minWidth: 0 }}>
                  <div className="wl-item-title">{w.title}</div>
                  <div className="wl-item-ctx" data-here={hereNow || undefined} style={{ ["--tc" as string]: TONE[w.tone] }}>
                    <i />{hereNow ? "This sale" : w.property}
                  </div>
                </div>
                <span className="wl-item-when" data-urgent={urgent || undefined}>{w.when}</span>
              </div>
              <div className="wl-item-exp">
                <div className="wl-item-exp-in">
                  <p>{w.detail}</p>
                  <div className="wl-item-exp-acts">
                    {w.actions.map((a) => <button key={a} className="wl-exp-act" onClick={(e) => { e.stopPropagation(); say(`Prototype. ${a}`); }}>{a}</button>)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function initials(name: string): string {
  const core = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((core[0]?.[0] ?? "") + (core[1]?.[0] ?? "")).toUpperCase() || "–";
}
function first(name: string): string {
  return name.replace(/\(.*?\)/g, "").trim().split(/[\s&]+/)[0] || name;
}
