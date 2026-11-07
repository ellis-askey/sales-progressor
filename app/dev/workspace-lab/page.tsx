"use client";
// Workspace Lab — an isolated /dev design experiment. A warm, airy desk of
// frosted-glass objects: a property navigator, a property workspace built around
// one outstanding enquiry, and a live "today" widget. All state is local; every
// would-be side effect surfaces as a prototype toast. No DB, no production code.

import { useCallback, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import {
  ChatCircleDots, PaperPlaneTilt, ArrowUpRight, CaretDown, Check,
  SealCheck, NotePencil,
} from "@/components/icons/ph";
import { LAB_CSS } from "./styles";
import { PROPERTIES, WORK, TODAY, type Property, type WorkItem, type Tone } from "./mock";

const TONE_VAR: Record<Tone, string> = {
  coral: "var(--t-coral)", amber: "var(--t-amber)", blue: "var(--t-blue)", green: "var(--t-green)", slate: "var(--t-slate)",
};

export default function WorkspaceLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lab />;
}

function Lab() {
  const [selectedId, setSelectedId] = useState(PROPERTIES[0].id);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [work, setWork] = useState<WorkItem[]>(() => JSON.parse(JSON.stringify(WORK)));
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = useMemo(() => PROPERTIES.find((p) => p.id === selectedId)!, [selectedId]);
  const doneCount = work.filter((w) => w.done).length;

  const say = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const pick = (id: string) => { setSelectedId(id); setEnquiryOpen(false); };

  const toggleDone = (id: string) => {
    let became = false;
    setWork((cur) => cur.map((w) => {
      if (w.id !== id) return w;
      became = !w.done;
      return { ...w, done: !w.done };
    }));
    const item = work.find((w) => w.id === id);
    if (became && item) say(`Marked done: ${item.title}`, () => setWork((cur) => cur.map((w) => w.id === id ? { ...w, done: false } : w)));
  };

  return (
    <div className="wl-root">
      <style dangerouslySetInnerHTML={{ __html: LAB_CSS }} />
      <div className="wl-bg" aria-hidden><img src={selected.photo} alt="" key={selected.id} /></div>

      <div className="wl-shell">
        <Rail selectedId={selectedId} onPick={pick} onMe={() => say("Prototype: your account menu would open here")} />

        <Workspace
          property={selected}
          enquiryOpen={enquiryOpen}
          onToggleEnquiry={() => setEnquiryOpen((v) => !v)}
          say={say}
        />

        <Today
          work={work}
          openItem={openItem}
          onOpen={(id) => setOpenItem((v) => (v === id ? null : id))}
          onToggle={toggleDone}
          relatedAddress={selected.line1}
          doneCount={doneCount}
          say={say}
        />
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

// ── navigation rail ──────────────────────────────────────────────────────────
function Rail({ selectedId, onPick, onMe }: { selectedId: string; onPick: (id: string) => void; onMe: () => void }) {
  return (
    <nav className="wl-rail" aria-label="Your properties">
      <div className="wl-brand" aria-hidden>S</div>
      <div className="wl-rail-sep" />
      <div className="wl-book">
        {PROPERTIES.map((p) => (
          <button
            key={p.id}
            className="wl-thumb"
            data-on={p.id === selectedId || undefined}
            style={{ backgroundImage: `url(${p.photo})` }}
            onClick={() => onPick(p.id)}
            aria-label={`${p.line1}, ${p.town}`}
            aria-current={p.id === selectedId || undefined}
          >
            <span className="wl-thumb-dot" style={{ background: TONE_VAR[p.statusTone] }} />
            <span className="wl-thumb-label"><b>{p.line1}</b> <span>{p.town}</span></span>
          </button>
        ))}
      </div>
      <button className="wl-avatar-me" onClick={onMe} aria-label="Your account">EA</button>
    </nav>
  );
}

// ── property workspace ───────────────────────────────────────────────────────
function Workspace({ property, enquiryOpen, onToggleEnquiry, say }: {
  property: Property; enquiryOpen: boolean; onToggleEnquiry: () => void; say: (m: string) => void;
}) {
  const p = property;
  return (
    <section className="wl-stage">
      <div className="wl-stage-head">
        <div>
          <h1 className="wl-addr">{p.line1}</h1>
          <p className="wl-addr-sub">{p.town} · {p.postcode}</p>
        </div>
        <div className="wl-meta">
          <span className="wl-price">{p.price}</span>
          <span className="wl-ten">{p.tenure}</span>
        </div>
      </div>

      <div className="wl-photo" key={p.id}>
        <img src={p.photo} alt={`${p.line1}, ${p.town}`} />
        <div className="wl-photo-top">
          <span className="wl-stagepill" style={{ ["--tc" as string]: TONE_VAR[p.statusTone] }}><i />{p.stage}</span>
        </div>
        <div className="wl-photo-foot">
          <div className="wl-photo-status">{p.statusLine}</div>
          <div className="wl-prog">
            <span className="wl-prog-l">{Math.round(p.progress * 100)}% through to completion</span>
            <div className="wl-prog-track"><div className="wl-prog-fill" style={{ width: `${p.progress * 100}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="wl-work">
        <div className="wl-eyebrow">
          <span className="wl-eyebrow-l"><span className="wl-ico"><ChatCircleDots weight="fill" /></span>Outstanding enquiry</span>
          <span className="wl-waiting">Raised by {p.enquiry.raisedBy} · waiting <b>{p.enquiry.waiting}</b></span>
        </div>

        <h2 className="wl-enq-title">{p.enquiry.title}</h2>
        <p className="wl-enq-sum">{p.enquiry.summary}</p>

        <div className="wl-actions">
          <button className="wl-btn wl-btn-primary" onClick={() => say("Prototype: a reply to the solicitor would open here")}>
            <PaperPlaneTilt weight="fill" />Draft reply to solicitor
          </button>
          <button className="wl-btn wl-btn-ghost" onClick={() => say("Prototype: a request to the seller would open here")}>
            <ArrowUpRight weight="bold" />Request from seller
          </button>
          <button className="wl-disclose" data-open={enquiryOpen || undefined} onClick={onToggleEnquiry} aria-expanded={enquiryOpen}>
            {enquiryOpen ? "Hide thread" : "See the thread"}<CaretDown weight="bold" />
          </button>
        </div>

        <div className="wl-reveal" data-open={enquiryOpen || undefined}>
          <div className="wl-reveal-in">
            <div className="wl-thread">
              {p.enquiry.thread.map((n, i) => (
                <div key={i} className="wl-note" data-side={n.side}>
                  <div className="wl-note-av">{n.side === "you" ? "You" : initials(n.from)}</div>
                  <div>
                    <div className="wl-note-h"><span className="wl-note-from">{n.from}</span><span className="wl-note-when">{n.when}</span></div>
                    <div className="wl-note-body">{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="wl-subacts">
              <button className="wl-subact" onClick={() => say("Prototype: enquiry marked resolved")}><SealCheck weight="regular" />Mark resolved</button>
              <button className="wl-subact" onClick={() => say("Prototype: an internal note would open")}><NotePencil weight="regular" />Add a note</button>
            </div>
          </div>
        </div>

        <div className="wl-people">
          <PersonRow p={p.seller} /><PersonRow p={p.buyer} />
        </div>
      </div>
    </section>
  );
}

function PersonRow({ p }: { p: Property["seller"] }) {
  return (
    <div className="wl-person">
      <div className="wl-person-av" style={{ background: `hsl(${p.hue} 44% 92%)`, color: `hsl(${p.hue} 42% 36%)` }}>{p.initials}</div>
      <div>
        <div className="wl-person-role">{p.role}</div>
        <div className="wl-person-name">{p.name}</div>
        <div className={`wl-person-last wl-st-${p.state}`}><i />{p.lastContact}</div>
      </div>
    </div>
  );
}

// ── today widget ─────────────────────────────────────────────────────────────
function Today({ work, openItem, onOpen, onToggle, relatedAddress, doneCount, say }: {
  work: WorkItem[]; openItem: string | null; onOpen: (id: string) => void; onToggle: (id: string) => void;
  relatedAddress: string; doneCount: number; say: (m: string) => void;
}) {
  return (
    <aside className="wl-today" aria-label="Today">
      <div className="wl-today-h">
        <h2 className="wl-greet"><span className="wl-live" aria-hidden />{TODAY.greeting}</h2>
        <p className="wl-greet-sub">{TODAY.date}. It&rsquo;s <b>{TODAY.summary}</b>.</p>
      </div>

      <div className="wl-list">
        {work.map((w) => {
          const open = openItem === w.id;
          const urgent = w.when === "Overdue" || w.when === "Due today";
          return (
            <div key={w.id} className="wl-item" data-open={open || undefined} data-done={w.done || undefined}
              data-related={w.property === relatedAddress || undefined} onClick={() => onOpen(w.id)}>
              <div className="wl-item-row">
                <button className="wl-check" onClick={(e) => { e.stopPropagation(); onToggle(w.id); }} aria-label={w.done ? "Mark not done" : "Mark done"} aria-pressed={w.done}>
                  <Check weight="bold" />
                </button>
                <div>
                  <div className="wl-item-title">{w.title}</div>
                  <div className="wl-item-meta"><i style={{ background: TONE_VAR[w.tone] }} />{w.property}</div>
                </div>
                <span className="wl-item-when" data-urgent={urgent || undefined}>{w.when}</span>
              </div>
              <div className="wl-item-detail">
                <div className="wl-item-detail-in">
                  <p>{w.detail}</p>
                  <div className="wl-item-acts">
                    {w.actions.map((a) => (
                      <button key={a} className="wl-mini" onClick={(e) => { e.stopPropagation(); say(`Prototype: ${a}`); }}>{a}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="wl-today-foot">
        <div className="wl-foot-track"><div className="wl-foot-fill" style={{ width: `${(doneCount / work.length) * 100}%` }} /></div>
        <span className="wl-foot-l"><b>{doneCount}</b> of {work.length} done</span>
      </div>
    </aside>
  );
}

function initials(name: string): string {
  const core = name.replace(/\(.*?\)/g, "").trim();
  const parts = core.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "–";
}
