"use client";
// Focus Next — "The Briefing" (isolated /dev prototype).
//
// A sales progressor's day, written as an editorial brief rather than assembled as
// a dashboard. Two zones: the FEED (left) is the urgent work, in priority order,
// each sale a short "story" carrying both its seller and buyer with their last
// exchange and the one next action; the RAIL (right) is this week's coverage
// ledger, where routine contact lives so it never buries the urgent feed.
//
// All state is local. No DB, no server, no real sends. Everything coral-marked as
// INVENTED below is demonstration prioritisation, not current TSP behaviour.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import {
  PaperPlaneTilt, PhoneCall, MagnifyingGlass, XCircle, Check, CaretRight,
  Moon, Warning, Clock, ChatCircleDots, Sparkle, ArrowRight, Sun, MoonStars,
} from "@/components/icons/ph";
import { FOCUS_CSS } from "./styles";
import {
  SALES, type Sale, type Side, type SideKind, type Comm,
  rel, sideSignal, sideCovered, attentionScore,
} from "./mock";
import { CH, STATE_LABEL, who, first, sideStatus, headline, isBad, dirWord } from "./common";

type Scope = "all" | "vendor" | "purchaser";
type Modal =
  | { kind: "email"; saleId: string; side: Side }
  | { kind: "call"; saleId: string; side: Side }
  | null;
type ToastState = { title: string; undo?: () => void } | null;

export default function FocusNextPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Briefing />;
}

function Briefing() {
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(JSON.stringify(SALES)));
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // follow the OS preference on first paint, the Apple way; the toggle overrides it
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setTheme(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    }
  }, []);
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((title: string, undo?: () => void) => {
    setToast({ title, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4600);
  }, []);

  // ── filtering + priority ordering ──────────────────────────────────────────
  const matchSide = useCallback((s: Side | null) => !!s && (scope === "all" || s.kind === scope), [scope]);
  const inQuery = useCallback((s: Sale) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${s.line1} ${s.town} ${s.vendor?.names ?? ""} ${s.purchaser?.names ?? ""}`.toLowerCase().includes(q);
  }, [query]);

  const pool = useMemo(
    () => sales.filter(inQuery).filter((s) => matchSide(s.vendor) || matchSide(s.purchaser)),
    [sales, inQuery, matchSide],
  );
  const ranked = useMemo(
    () => pool.map((s) => ({ s, score: attentionScore(s) })).sort((a, b) => b.score - a.score),
    [pool],
  );
  const hot = useMemo(() => ranked.filter((x) => x.score > 0).map((x) => x.s), [ranked]);
  const calm = useMemo(() => ranked.filter((x) => x.score === 0).map((x) => x.s), [ranked]);

  // coverage reflects the current view (side scope + any search), so the stat, the
  // feed and the ledger always agree
  const cov = useMemo(() => {
    let total = 0, done = 0;
    for (const s of pool) for (const p of [s.vendor, s.purchaser]) {
      if (!p || (scope !== "all" && p.kind !== scope)) continue;
      total++; if (sideCovered(p)) done++;
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [pool, scope]);

  // the weekly coverage worklist: every uncovered side, grouped by sale, by priority
  const stillToReach = useMemo(
    () => ranked
      .map(({ s }) => ({ sale: s, sides: [s.vendor, s.purchaser].filter((p): p is Side => matchSide(p) && !sideCovered(p)) }))
      .filter((x) => x.sides.length > 0),
    [ranked, matchSide],
  );
  const awaitingCount = useMemo(
    () => pool.reduce((n, s) => n + [s.vendor, s.purchaser].filter((p) => matchSide(p) && !sideCovered(p!) && sideSignal(p).awaitingReply).length, 0),
    [pool, matchSide],
  );
  const parked = useMemo(() => pool.flatMap((s) => [s.vendor, s.purchaser].filter((p): p is Side => matchSide(p) && !!p?.parked).map((p) => ({ sale: s, side: p }))), [pool, matchSide]);
  const reachedCount = cov.done - parked.length;

  // keep the keyboard highlight inside the current feed
  useEffect(() => { setHi((h) => Math.max(0, Math.min(h, hot.length - 1))); }, [hot.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || modal) return;
      if (!hot.length) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setHi((h) => Math.min(hot.length - 1, h + 1)); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
      else if (e.key === "Enter") {
        const sale = hot[hi]; if (!sale) return;
        const side = [sale.vendor, sale.purchaser].find((p) => matchSide(p) && !sideCovered(p!));
        if (side) { e.preventDefault(); setModal({ kind: "email", saleId: sale.id, side }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hot, hi, modal, matchSide]);

  useEffect(() => {
    const el = feedRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [hi]);

  // ── mutations (optimistic, each with its own undo) ─────────────────────────
  const mutateSide = useCallback((saleId: string, kind: SideKind, fn: (s: Side) => Side, toastTitle: string) => {
    let prev: Side | null = null;
    setSales((cur) => cur.map((s) => {
      if (s.id !== saleId) return s;
      const key = kind === "vendor" ? "vendor" : "purchaser";
      if (!s[key]) return s;
      prev = JSON.parse(JSON.stringify(s[key]));
      return { ...s, [key]: fn(JSON.parse(JSON.stringify(s[key])) as Side) };
    }));
    showToast(toastTitle, () => setSales((cur) => cur.map((s) => s.id === saleId && prev ? { ...s, [kind === "vendor" ? "vendor" : "purchaser"]: prev } : s)));
  }, [showToast]);

  const prepend = (comm: Comm) => (s: Side): Side => ({ ...s, touchedThisWeek: true, parked: false, comms: [comm, ...s.comms] });
  const emailSent = (id: string, side: Side, subject: string) => mutateSide(id, side.kind, prepend({ channel: "email", dir: "out", state: "sent", daysAgo: 0, subject: subject || "Update on your sale" }), `Email sent to ${first(side.names)}`);
  const callLogged = (id: string, side: Side, note: string) => mutateSide(id, side.kind, prepend({ channel: "call", dir: "out", state: "called", daysAgo: 0, preview: note || "Spoke with them" }), `Call logged with ${first(side.names)}`);
  const markDone = (id: string, side: Side) => mutateSide(id, side.kind, (s) => ({ ...s, touchedThisWeek: true, parked: false }), `${who(side)} marked contacted`);
  const park = (id: string, side: Side) => mutateSide(id, side.kind, (s) => ({ ...s, parked: true, touchedThisWeek: false }), `${who(side)} set aside this week`);
  const reopen = (id: string, side: Side) => mutateSide(id, side.kind, (s) => ({ ...s, parked: false, touchedThisWeek: false }), `${who(side)} back on your list`);

  const jumpTo = (saleId: string) => {
    const i = hot.findIndex((s) => s.id === saleId);
    if (i >= 0) { setHi(i); feedRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }
  };

  const toReach = cov.total - cov.done;

  return (
    <div className="fb-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: FOCUS_CSS }} />
      <div className="fb-shell">
        <header className="fb-mast">
          <div className="fb-brandrow">
            <span className="fb-brand">Focus<span>.</span></span>
            <span className="fb-chip">Prototype</span>
            <button className="fb-theme-btn" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun weight="fill" /> : <MoonStars weight="fill" />}
            </button>
          </div>
          <div className="fb-mast-main">
            <h1 className="fb-thesis">
              {hot.length === 0
                ? <>Nothing urgent in your book <span className="fb-quiet">right now.</span></>
                : <><b>{hot.length}</b> {hot.length === 1 ? "sale needs" : "sales need"} you,{" "}<span className="fb-quiet">{toReach} {toReach === 1 ? "client" : "clients"} still to reach this week.</span></>}
            </h1>
            <div className="fb-mast-tools">
              <div className="fb-scope" role="group" aria-label="Which side to show">
                {(["all", "vendor", "purchaser"] as const).map((k) => (
                  <button key={k} data-on={scope === k || undefined} onClick={() => setScope(k)}>
                    {k === "all" ? "Everyone" : k === "vendor" ? "Sellers" : "Buyers"}
                  </button>
                ))}
              </div>
              <label className="fb-search" data-filled={query ? "" : undefined}>
                <MagnifyingGlass weight="regular" />
                <input placeholder="Search address or name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
                <button className="fb-clear" aria-label="Clear search" onClick={() => setQuery("")}><XCircle weight="fill" /></button>
              </label>
            </div>
          </div>
        </header>

        <div className="fb-grid">
          <main className="fb-feed" ref={feedRef}>
            {hot.length === 0 && calm.length === 0 ? (
              <div className="fb-empty">No sales match &ldquo;{query}&rdquo;.</div>
            ) : hot.length === 0 ? (
              <CaughtUp scope={scope} />
            ) : (
              hot.map((sale, i) => (
                <Story
                  key={sale.id} sale={sale} i={i} hi={hi === i} scope={scope}
                  onFocusStory={() => setHi(i)}
                  onEmail={(side) => setModal({ kind: "email", saleId: sale.id, side })}
                  onCall={(side) => setModal({ kind: "call", saleId: sale.id, side })}
                  onPark={(side) => park(sale.id, side)}
                  onReopen={(side) => reopen(sale.id, side)}
                />
              ))
            )}

            {calm.length > 0 && (
              <>
                <div className="fb-rule"><span>In good shape</span></div>
                {calm.map((sale) => <CalmLine key={sale.id} sale={sale} />)}
              </>
            )}
          </main>

          <aside className="fb-rail" aria-label="This week's coverage">
            <div className="fb-cov">
              <div className="fb-cov-top">
                <span className="fb-cov-num fb-num">{cov.done}<em>/{cov.total}</em></span>
                <span className="fb-cov-cap">sides contacted<br />this week</span>
              </div>
              <div className="fb-cov-bar" role="progressbar" aria-valuenow={cov.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${cov.pct}%` }} /></div>
              <div className="fb-cov-sub"><b>{toReach}</b> still to reach{awaitingCount > 0 && <> · <b>{awaitingCount}</b> awaiting a reply</>}</div>
            </div>

            <div className="fb-ledger">
              <div className="fb-ledger-h"><span>Still to reach</span><span className="fb-num">{stillToReach.reduce((n, x) => n + x.sides.length, 0)}</span></div>
              {stillToReach.length === 0 ? (
                <p className="fb-ledger-clear">Every side reached this week.</p>
              ) : (
                <div className="fb-still">
                  {stillToReach.map(({ sale, sides }) => (
                    <div key={sale.id} className="fb-still-s">
                      <div className="fb-still-addr" onClick={() => jumpTo(sale.id)}>{sale.line1}<em>, {sale.town}</em></div>
                      {sides.map((s) => {
                        const st = sideStatus(s);
                        return (
                          <div key={s.kind} className="fb-still-side">
                            <span className="fb-still-l"><i className={`fb-dot fb-dot-${st.tone}`} />{who(s)} <em>· {st.short}</em></span>
                            <button className="fb-done-btn" onClick={() => markDone(sale.id, s)}>Done</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {parked.length > 0 && (
                <details className="fb-disc">
                  <summary><CaretRight weight="bold" />Set aside this week ({parked.length})</summary>
                  {parked.map(({ sale, side }) => (
                    <div key={sale.id + side.kind} className="fb-disc-row">
                      <span>{sale.line1} <em>· {who(side)}</em></span>
                      <button className="fb-reopen" onClick={() => reopen(sale.id, side)}>Reopen</button>
                    </div>
                  ))}
                </details>
              )}
              {reachedCount > 0 && (
                <details className="fb-disc">
                  <summary><CaretRight weight="bold" />Reached this week ({reachedCount})</summary>
                  <div className="fb-disc-row"><span>Already contacted. These drop off the worklist until next week.</span></div>
                </details>
              )}
            </div>
          </aside>
        </div>
      </div>

      {modal?.kind === "email" && (
        <EmailModal
          side={modal.side} sale={sales.find((s) => s.id === modal.saleId)!}
          onClose={() => setModal(null)}
          onSend={(subject) => { emailSent(modal.saleId, modal.side, subject); setModal(null); }}
        />
      )}
      {modal?.kind === "call" && (
        <CallModal
          side={modal.side} sale={sales.find((s) => s.id === modal.saleId)!}
          onClose={() => setModal(null)}
          onSave={(note) => { callLogged(modal.saleId, modal.side, note); setModal(null); }}
        />
      )}

      {toast && (
        <div className="fb-toast" role="status">
          <Check weight="bold" />{toast.title}
          {toast.undo && <button className="fb-toast-undo" onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

// ── a single sale, told as a story ───────────────────────────────────────────
function Story({ sale, i, hi, scope, onFocusStory, onEmail, onCall, onPark, onReopen }: {
  sale: Sale; i: number; hi: boolean; scope: Scope;
  onFocusStory: () => void;
  onEmail: (s: Side) => void; onCall: (s: Side) => void; onPark: (s: Side) => void; onReopen: (s: Side) => void;
}) {
  const h = headline(sale);
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s && (scope === "all" || s.kind === scope));
  const lastHuman = sides.map((s) => sideSignal(s).lastHumanDays).filter((d): d is number => d != null);
  return (
    <article className="fb-story" data-hi={hi || undefined} data-i={i} onMouseEnter={onFocusStory}>
      {h && <p className={`fb-kicker fb-k-${h.tone}`}>{h.tone === "danger" ? <Warning weight="fill" /> : h.tone === "warn" ? <Clock weight="fill" /> : <ChatCircleDots weight="fill" />}{h.text}</p>}
      <h2 className="fb-addr" onClick={() => onFocusStory()}>{sale.line1}<span className="fb-town">, {sale.town}</span></h2>
      <p className="fb-dateline">
        <b>{sale.stage}</b>
        {lastHuman.length > 0 ? <> · last spoke {rel(Math.max(...lastHuman))} ago</> : <> · no contact on record</>}
      </p>
      <div className="fb-sides" data-single={sides.length === 1 || undefined}>
        {sides.map((s) => (
          <SideBlock key={s.kind} side={s}
            onEmail={() => onEmail(s)} onCall={() => onCall(s)} onPark={() => onPark(s)} onReopen={() => onReopen(s)} />
        ))}
      </div>
    </article>
  );
}

function SideBlock({ side, onEmail, onCall, onPark, onReopen }: {
  side: Side; onEmail: () => void; onCall: () => void; onPark: () => void; onReopen: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const st = sideStatus(side);
  const covered = sideCovered(side);
  const comms = [...side.comms].sort((a, b) => a.daysAgo - b.daysAgo);
  const shown = showAll ? comms : comms.slice(0, 2);

  return (
    <div className="fb-side">
      <div className="fb-side-h">
        <span className="fb-role">{who(side)}</span>
        <span className="fb-name">{side.names}</span>
      </div>
      <p className={`fb-st fb-s-${st.tone}`}>
        {st.tone === "danger" ? <Warning weight="fill" /> : st.tone === "warn" ? <Clock weight="fill" /> : null}{st.text}
      </p>

      <div className="fb-thread">
        {comms.length === 0 ? (
          <p className="fb-ex-none">No contact on record yet.</p>
        ) : shown.map((m, k) => {
          const Icon = CH[m.channel];
          return (
            <div key={k} className="fb-ex" data-bad={isBad(m.state) || undefined}>
              <Icon weight="regular" className="fb-ex-i" />
              <div>
                <div className="fb-ex-t">{m.subject ?? m.preview ?? STATE_LABEL[m.state]}</div>
                <div className="fb-ex-m" data-bad={isBad(m.state) || undefined}>
                  {m.automated ? <span className="fb-ex-auto">Sent automatically, does not count as contact</span> : <>{dirWord(m)} · {STATE_LABEL[m.state]}</>}
                </div>
              </div>
              <span className="fb-ex-w fb-num">{rel(m.daysAgo)}</span>
            </div>
          );
        })}
        {comms.length > 2 && (
          <button className="fb-more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `${comms.length - 2} earlier`}
          </button>
        )}
      </div>

      {covered ? (
        <span className={`fb-done-line${side.parked ? " is-parked" : ""}`}>
          {side.parked ? <Moon weight="fill" /> : <Check weight="bold" />}
          {side.parked ? "Set aside this week" : "Contacted this week"}
          <button className="fb-reopen" onClick={onReopen}>Reopen</button>
        </span>
      ) : (
        <div className="fb-acts">
          <button className="fb-act fb-act-primary" onClick={onEmail}>
            <PaperPlaneTilt weight="fill" />Email {first(side.names)}<ArrowRight weight="bold" className="fb-arr" />
          </button>
          <button className="fb-act fb-act-muted" onClick={onCall}><PhoneCall weight="regular" />Log call</button>
          <button className="fb-act fb-act-muted" onClick={onPark}><Moon weight="regular" />Set aside</button>
        </div>
      )}
    </div>
  );
}

function CalmLine({ sale }: { sale: Sale }) {
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  const lastHuman = sides.map((s) => sideSignal(s).lastHumanDays).filter((d): d is number => d != null);
  const allParked = sides.length > 0 && sides.every((s) => s.parked);
  return (
    <div className="fb-calm" title={sale.postcode}>
      <span className="fb-calm-addr">{sale.line1}<em>, {sale.town}</em></span>
      <span className="fb-calm-meta">
        {allParked ? "Set aside this week" : sides.every((s) => s.touchedThisWeek) ? "Both contacted this week" : lastHuman.length ? `Both in touch · last spoke ${rel(Math.max(...lastHuman))} ago` : "On track"}
      </span>
    </div>
  );
}

function CaughtUp({ scope }: { scope: Scope }) {
  const noun = scope === "vendor" ? "seller" : scope === "purchaser" ? "buyer" : "client";
  return (
    <div className="fb-caught">
      <Sparkle weight="fill" />
      <h3>All caught up</h3>
      <p>Nothing urgent across your {scope === "all" ? "book" : `${noun}s`} right now. Anything still to reach for weekly coverage is on the right, in your own time.</p>
    </div>
  );
}

// ── bespoke modals (prototype-local; Escape + backdrop to close) ─────────────
function Modal({ title, eyebrow, children, footer, onClose }: {
  title: string; eyebrow: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input, textarea")?.focus(), 40);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [onClose]);
  return (
    <div className="fb-scrim" onMouseDown={onClose}>
      <div className="fb-modal" ref={ref} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="fb-modal-h"><span className="fb-modal-eyebrow">{eyebrow}</span><h3>{title}</h3></div>
        <div className="fb-modal-b">{children}</div>
        <div className="fb-modal-f">{footer}</div>
      </div>
    </div>
  );
}

function EmailModal({ side, sale, onClose, onSend }: { side: Side; sale: Sale; onClose: () => void; onSend: (subject: string) => void }) {
  const [subject, setSubject] = useState("Update on your sale");
  return (
    <Modal title="New email" eyebrow={`${who(side)} · ${sale.line1}`} onClose={onClose}
      footer={<><button className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button><button className="fb-btn fb-btn-primary" onClick={() => onSend(subject)}><PaperPlaneTilt weight="fill" />Send</button></>}>
      <div className="fb-to">To <b>{side.names}</b></div>
      <div className="fb-field"><label>Subject</label><input className="fb-input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      <div className="fb-field"><label>Message</label><textarea className="fb-textarea" defaultValue={`Hi ${first(side.names)},\n\nA quick update on ${sale.line1}. `} /></div>
    </Modal>
  );
}

function CallModal({ side, sale, onClose, onSave }: { side: Side; sale: Sale; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="Log a call" eyebrow={`${who(side)} · ${sale.line1}`} onClose={onClose}
      footer={<><button className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button><button className="fb-btn fb-btn-primary" onClick={() => onSave(note)}><Check weight="bold" />Save call</button></>}>
      <div className="fb-to">Call with <b>{side.names}</b></div>
      <div className="fb-field"><label>What was said? <span className="fb-hint">Internal note, the client never sees this.</span></label><textarea className="fb-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Reassured them on the search delay, chasing the local authority." /></div>
    </Modal>
  );
}
