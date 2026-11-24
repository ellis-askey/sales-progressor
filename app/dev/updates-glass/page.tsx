"use client";
// /dev/updates-glass — CONCEPT. Complete visual redesign of the Updates page
// (real route: /agent/comms) using an in-house Liquid Glass kit modelled on
// Glassy UI. Dev-only, blocks in production. NOT wired to the live design system.
//
// FUNCTIONAL FIDELITY: the filter model (Type / Who / Side / Stage multi-select,
// empty-set-means-all, AND across groups, side only narrows sided rows, stage
// only narrows milestones), the address search, the per-day collapse logic, the
// file snapshot, the count/clear footer and every update-kind's rendering are
// ported verbatim from components/comms/CommsActivityFeed.tsx. Only the
// presentation changes. Data is MOCK (./mock); every action is SIMULATED (no DB
// writes, no emails, no bell clear) — see the footer note.

import { useState, useRef, useEffect, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  CaretDown, Tag, ChatCircle, Paperclip, Bell, MagnifyingGlass, X, NotePencil,
  PaperPlaneTilt, FunnelSimple, House, ArrowUpRight, Check, Sun, MoonStars,
} from "@phosphor-icons/react";
import { LiquidGlass } from "../liquid-glass/LiquidGlass";
import { AppBackground } from "@/components/decor/AppBackground";
import { UserAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import {
  MOCK_DAYS, type DayBucket, type TxGroup, type UpdateRow, type Kind, type Who, type StageKey,
} from "./mock";

type Theme = "dark" | "light";
// Theme-aware glass fills so dark cards lift off black and light cards stay
// believable (the LiquidGlass tint prop is theme-agnostic, so we switch it here).
const GLASS: Record<string, Record<Theme, string>> = {
  card: { dark: "rgba(32,35,47,0.44)", light: "rgba(255,255,255,0.52)" },
  rail: { dark: "rgba(26,29,40,0.5)", light: "rgba(255,255,255,0.56)" },
  sheet: { dark: "rgba(38,41,54,0.66)", light: "rgba(255,255,255,0.74)" },
  dock: { dark: "rgba(34,37,50,0.58)", light: "rgba(255,255,255,0.64)" },
  toast: { dark: "rgba(40,43,56,0.7)", light: "rgba(255,255,255,0.78)" },
  empty: { dark: "rgba(28,31,43,0.44)", light: "rgba(255,255,255,0.52)" },
};

// ── Ported helpers (verbatim behaviour from CommsActivityFeed) ───────────────
function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function splitAddress(addr: string) {
  const [first, ...rest] = addr.split(",");
  return { line1: first.trim(), line2: rest.join(",").trim() };
}
function formatPrice(pence: number) {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}
const STATUS_META: Record<string, { tone: string; label: string }> = {
  active: { tone: "success", label: "Active" },
  on_hold: { tone: "warning", label: "On hold" },
  completed: { tone: "info", label: "Completed" },
  withdrawn: { tone: "muted", label: "Withdrawn" },
};
function exchangeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return "Exchange overdue";
  if (d === 0) return "Exchange today";
  if (d < 14) return `about ${d} day${d === 1 ? "" : "s"} to exchange`;
  const w = Math.round(d / 7);
  return `about ${w} week${w === 1 ? "" : "s"} to exchange`;
}

const TYPE_OPTIONS: { key: Kind; label: string }[] = [
  { key: "milestone", label: "Steps" }, { key: "price", label: "Price" }, { key: "note", label: "Notes" },
  { key: "reply", label: "Replies" }, { key: "document", label: "Docs" }, { key: "notification", label: "Alerts" },
];
const WHO_OPTIONS: { key: Who; label: string }[] = [
  { key: "agent", label: "Us" }, { key: "client", label: "Client" }, { key: "solicitor", label: "Solicitor" },
];
const SIDE_OPTIONS: { key: "vendor" | "purchaser"; label: string }[] = [
  { key: "purchaser", label: "Buyer's" }, { key: "vendor", label: "Seller's" },
];
const STAGE_OPTIONS: { key: StageKey; label: string }[] = [
  { key: "instructed", label: "Instructed" }, { key: "draft_pack", label: "Draft pack" },
  { key: "finances", label: "Finances" }, { key: "searches", label: "Searches" },
  { key: "enquiries", label: "Enquiries" }, { key: "exchange", label: "Exchange" },
  { key: "completion", label: "Completion" },
];

// Real TSP avatars: a person's photo when present, else the branded side-tinted
// SVG art (staff coral, seller blue, buyer green, solicitor grey id-card). Kind
// badges keep their glyph. Mirrors the production Updates page's Leading.
function Leading({ u }: { u: UpdateRow }) {
  if (u.kind === "milestone" || u.kind === "note") {
    if (u.who === "agent") {
      return <UserAvatar user={{ name: u.byName ?? "", image: u.byImage ?? null }} size={30} className="ug-av" />;
    }
    const role: ActorRole =
      u.who === "solicitor" ? "solicitor" : u.side === "vendor" ? "seller" : u.side === "purchaser" ? "buyer" : "other";
    return <ActorAvatar name={u.byName ?? ""} role={role} image={u.byImage ?? null} size={30} className="ug-av" />;
  }
  const glyph = u.kind === "price" ? <Tag weight="regular" /> : u.kind === "reply" ? <ChatCircle weight="regular" /> : u.kind === "notification" ? <Bell weight="regular" /> : <Paperclip weight="regular" />;
  return <span className="ug-kindbadge">{glyph}</span>;
}
function UpdateLine({ u, first, onDoc }: { u: UpdateRow; first: boolean; onDoc: (f: string) => void }) {
  let main: ReactNode;
  let secondary: string | null = null;
  if (u.kind === "milestone") main = u.sentence;
  else if (u.kind === "price") { main = u.oldPrice != null ? `Price changed from ${formatPrice(u.oldPrice)} to ${formatPrice(u.newPrice)}` : `Price set to ${formatPrice(u.newPrice)}`; secondary = u.reason?.trim() || null; }
  else if (u.kind === "note") main = u.content;
  else if (u.kind === "reply") { main = "A solicitor replied to our chase"; secondary = u.content?.trim() || null; }
  else if (u.kind === "notification") main = u.sentence;
  else { const label = `${u.byName ?? "Your team"} uploaded ${u.filename}`; main = <button className="ug-doclink" onClick={() => onDoc(u.filename)}>{label}</button>; }

  // Deliberate row layout: avatar sits in a line-height band so a single-line
  // update centres avatar/text/time on one line, while supporting text flows
  // beneath a top-aligned avatar on multiline rows (no pixel offsets).
  return (
    <div className={`ug-row ${first ? "first" : ""}`}>
      <span className="ug-lead"><Leading u={u} /></span>
      <div className="ug-row-body">
        <div className="ug-row-primary">
          <p className="ug-row-main">{main}</p>
          <span className="ug-row-time" suppressHydrationWarning>{relativeDate(u.atIso)}</span>
        </div>
        {u.kind === "note" && <p className="ug-row-cap">Shared with client</p>}
        {u.kind === "notification" && u.pill && <p className="ug-row-cap">{u.pill}</p>}
        {secondary && <p className="ug-row-sec">{secondary}</p>}
      </div>
    </div>
  );
}

function TxCard({ tx, theme, onOpen, onDoc }: { tx: TxGroup; theme: Theme; onOpen: (a: string) => void; onDoc: (f: string) => void }) {
  const { line1, line2 } = splitAddress(tx.transactionAddress);
  const status = STATUS_META[tx.status];
  const snap = tx.snapshot;
  const exchanged = tx.status === "completed" || tx.status === "withdrawn" || snap?.stage === "Post-exchange";
  const exchange = exchanged ? null : exchangeLabel(tx.expectedExchangeIso);
  return (
    <LiquidGlass radius={18} thickness={14} displace={30} aberration={1} tint={GLASS.card[theme]} className="ug-txcard">
      <button className="ug-txhead" onClick={() => onOpen(tx.transactionAddress)}>
        <span className="ug-marker"><House weight="regular" /></span>
        <span className="ug-txaddr">
          <span className="ug-txaddr-1">{line1}</span>
          {line2 && <span className="ug-txaddr-2">{line2}</span>}
        </span>
        <span className="ug-txmeta">
          {status && (
            <span className="ug-status">
              <span className="ug-status-dot" data-tone={status.tone} />{status.label}
              {snap && <span className="ug-status-pct">· {snap.percent}%</span>}
            </span>
          )}
          {(snap?.stage || exchange) && <span className="ug-meta-line">{snap?.stage ?? ""}{snap?.stage && exchange ? " · " : ""}{exchange ?? ""}</span>}
          {snap?.nextAction && <span className="ug-meta-next">Next: {snap.nextAction.replace(/\.$/, "")}</span>}
        </span>
        <ArrowUpRight weight="bold" className="ug-txgo" />
        {snap && <span className="ug-txprogress"><span style={{ width: `${snap.percent}%` }} /></span>}
      </button>
      <div className="ug-rows">
        {tx.updates.map((u, i) => <UpdateLine key={`${u.kind}-${u.id}`} u={u} first={i === 0} onDoc={onDoc} />)}
      </div>
    </LiquidGlass>
  );
}

function DayDisclosure({ label, count, open, onToggle, children }: { label: string; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="ug-day">
      <button className="ug-daybar" aria-expanded={open} onClick={onToggle}>
        <span className="ug-daylabel">{label}</span>
        <span className="ug-dayrule" />
        <span className="ug-daycount">{count} update{count !== 1 ? "s" : ""}</span>
        <CaretDown weight="bold" className={`ug-daycaret ${open ? "open" : ""}`} />
      </button>
      <div className={`ug-acc ${open ? "open" : ""}`}><div className="ug-acc-in"><div className="ug-day-body">{children}</div></div></div>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`ug-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick}>
      <span className="ug-chip-tick"><Check weight="bold" /></span>{children}
    </button>
  );
}

export default function UpdatesGlass() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<Theme>("dark");
  const [view, setView] = useState<"live" | "loading" | "empty">("live");

  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<Set<Kind>>(new Set());
  const [whos, setWhos] = useState<Set<Who>>(new Set());
  const [sides, setSides] = useState<Set<"vendor" | "purchaser">>(new Set());
  const [stages, setStages] = useState<Set<StageKey>>(new Set());
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ type: true });
  const [mobileFilters, setMobileFilters] = useState(false);

  const [sheet, setSheet] = useState<null | "note" | "email">(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Drive the real TSP AppBackground (which reads <html data-theme>) from this
  // page's theme toggle, so dark/light shows the corresponding real backdrop.
  // Restored on unmount so leaving the dev route doesn't leave html retinted.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  function toggleIn<T>(setter: (fn: (p: Set<T>) => Set<T>) => void) {
    return (k: T) => setter((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  const clearAll = () => { setTypes(new Set()); setWhos(new Set()); setSides(new Set()); setStages(new Set()); setQuery(""); };
  const q = query.trim().toLowerCase();
  const filterActive = types.size > 0 || whos.size > 0 || sides.size > 0 || stages.size > 0 || q.length > 0;

  function passes(u: UpdateRow): boolean {
    if (types.size && !types.has(u.kind)) return false;
    if (whos.size && !whos.has(u.who)) return false;
    if (sides.size && u.side && !sides.has(u.side)) return false;
    if (stages.size && u.kind === "milestone" && (!u.stageKey || !stages.has(u.stageKey))) return false;
    return true;
  }

  const days: DayBucket[] = MOCK_DAYS;
  const totalCount = days.reduce((n, d) => n + d.txGroups.reduce((m, t) => m + t.updates.length, 0), 0);
  const visibleDays = days
    .map((d) => ({
      ...d,
      txGroups: d.txGroups
        .filter((tx) => !q || tx.transactionAddress.toLowerCase().includes(q))
        .map((tx) => ({ ...tx, updates: tx.updates.filter(passes) }))
        .filter((tx) => tx.updates.length > 0),
    }))
    .filter((d) => d.txGroups.length > 0);
  const visibleCount = visibleDays.reduce((n, d) => n + d.txGroups.reduce((m, t) => m + t.updates.length, 0), 0);

  const groups = [
    { key: "type", heading: "Type", options: TYPE_OPTIONS as { key: string; label: string }[], sel: types as Set<string>, toggle: (k: string) => toggleIn(setTypes)(k as Kind) },
    { key: "who", heading: "Who", options: WHO_OPTIONS as { key: string; label: string }[], sel: whos as Set<string>, toggle: (k: string) => toggleIn(setWhos)(k as Who) },
    { key: "side", heading: "Side", options: SIDE_OPTIONS as { key: string; label: string }[], sel: sides as Set<string>, toggle: (k: string) => toggleIn(setSides)(k as "vendor" | "purchaser") },
    { key: "stage", heading: "Stage", options: STAGE_OPTIONS as { key: string; label: string }[], sel: stages as Set<string>, toggle: (k: string) => toggleIn(setStages)(k as StageKey) },
  ];

  const onOpenFile = (addr: string) => fireToast(`Opening ${splitAddress(addr).line1} (simulated)`);
  const onDoc = (f: string) => fireToast(`Opening ${f} (simulated)`);

  const filterInner = (
    <>
      {groups.map((g) => {
        const open = !!openSec[g.key];
        return (
          <div key={g.key} className={`ug-fgroup ${open ? "open" : ""}`}>
            <button className="ug-fgroup-hdr" aria-expanded={open} onClick={() => setOpenSec((p) => ({ ...p, [g.key]: !p[g.key] }))}>
              <span>{g.heading}{g.sel.size > 0 && <span className="ug-fbadge">{g.sel.size}</span>}</span>
              <CaretDown weight="bold" className="ug-fcaret" />
            </button>
            <div className={`ug-acc ${open ? "open" : ""}`}><div className="ug-acc-in">
              <div className="ug-chips">
                {g.options.map((o) => <Chip key={o.key} on={g.sel.has(o.key)} onClick={() => g.toggle(o.key)}>{o.label}</Chip>)}
              </div>
            </div></div>
          </div>
        );
      })}
      <div className="ug-fside-foot">
        <span className="ug-fcount">{filterActive ? `Showing ${visibleCount} of ${totalCount}` : `${totalCount} update${totalCount !== 1 ? "s" : ""}`}</span>
        {filterActive && <button className="ug-clear" onClick={clearAll}>Clear</button>}
      </div>
    </>
  );

  return (
    <div className="ug-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBackground />
      <div className="ug-scene" aria-hidden />

      <main className="ug-wrap">
        <div className="ug-topbar">
          <div className="ug-title-col">
            <div className="ug-eyebrow">Prototype · actions simulated</div>
            <h1 className="ug-title">Updates</h1>
            <p className="ug-sub">What&apos;s happened across your files.</p>
          </div>
          <div className="ug-topctl">
            <div className="ug-seg" style={{ ["--i" as string]: String(["live", "loading", "empty"].indexOf(view)) }}>
              <span className="ug-seg-thumb" />
              {(["live", "loading", "empty"] as const).map((v) => (
                <button key={v} className={`ug-seg-btn ${view === v ? "on" : ""}`} onClick={() => setView(v)}>{v === "live" ? "Live" : v === "loading" ? "Loading" : "Empty"}</button>
              ))}
            </div>
            <button className={`ug-themesw ${theme === "light" ? "on" : ""}`} role="switch" aria-checked={theme === "light"} aria-label="Toggle light mode" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              <span className="ug-themesw-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
            </button>
          </div>
        </div>

        {view === "loading" && <SkeletonFeed />}
        {view === "empty" && <EmptyState theme={theme} />}

        {view === "live" && (
          <div className="ug-layout">
            <aside className="ug-side">
              <LiquidGlass radius={18} thickness={12} displace={24} aberration={1} tint={GLASS.rail[theme]} className="ug-rail">
                {filterInner}
              </LiquidGlass>
            </aside>

            <div className="ug-feed">
              <div className="ug-searchrow">
                <div className="ug-search">
                  <MagnifyingGlass weight="regular" className="ug-search-ico" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by address" aria-label="Search updates by address" />
                  {query && <button className="ug-search-clear" onClick={() => setQuery("")} aria-label="Clear search"><X weight="bold" /></button>}
                </div>
                <button className="ug-mobfilter" onClick={() => setMobileFilters((v) => !v)} aria-expanded={mobileFilters}>
                  <FunnelSimple weight="bold" />{filterActive && <span className="ug-fbadge">{types.size + whos.size + sides.size + stages.size}</span>}
                </button>
              </div>

              {mobileFilters && (
                <LiquidGlass radius={16} thickness={12} displace={24} aberration={1} tint={GLASS.rail[theme]} className="ug-mobrail">{filterInner}</LiquidGlass>
              )}

              {filterActive && visibleDays.length === 0 && (
                <div className="ug-nomatch">
                  <p>No updates match these filters.</p>
                  <button className="ug-clear" onClick={clearAll}>Clear filters</button>
                </div>
              )}

              {visibleDays.map((d) => {
                const open = openDays[d.label] ?? (filterActive ? true : d.defaultOpen);
                const count = d.txGroups.reduce((n, t) => n + t.updates.length, 0);
                return (
                  <DayDisclosure key={d.label} label={d.label} count={count} open={open} onToggle={() => setOpenDays((p) => ({ ...p, [d.label]: !open }))}>
                    {d.txGroups.map((tx) => <TxCard key={tx.transactionId} tx={tx} theme={theme} onOpen={onOpenFile} onDoc={onDoc} />)}
                  </DayDisclosure>
                );
              })}

              <p className="ug-foot">
                Prototype of the Updates page redesigned with an in-house Liquid Glass kit. Mock data; every action
                (open file, open document, new note, new email) is simulated and writes nothing. The live page at
                /agent/comms is unchanged.
              </p>
            </div>
          </div>
        )}
      </main>

      <LiquidGlass radius={22} thickness={14} displace={46} aberration={4} tint={GLASS.dock[theme]} className="ug-dock">
        <button className="ug-dock-btn" onClick={() => setSheet("note")}><NotePencil weight="regular" /><span>New note</span></button>
        <span className="ug-dock-sep" />
        <button className="ug-dock-btn" onClick={() => setSheet("email")}><PaperPlaneTilt weight="regular" /><span>New email</span></button>
      </LiquidGlass>

      {sheet && (
        <div className="ug-overlay" onClick={() => setSheet(null)}>
          <LiquidGlass radius={22} thickness={16} displace={40} aberration={3} tint={GLASS.sheet[theme]} className="ug-sheet" onClick={(e) => e.stopPropagation()}>
            <span className="ug-sheet-grip" />
            <button className="ug-sheet-x" onClick={() => setSheet(null)} aria-label="Close"><X weight="bold" /></button>
            <h3>{sheet === "note" ? "Add a note" : "New email"}</h3>
            <p className="ug-sheet-sub">{sheet === "note" ? "Log an update against a sale. Tick to share it with the client." : "Compose an update to a client or solicitor."}</p>
            <div className="ug-field"><label>Sale</label><div className="ug-fakeinput">14 Bushey Avenue, Broxbourne</div></div>
            {sheet === "email" && <div className="ug-field"><label>To</label><div className="ug-fakeinput">buyer@example.com</div></div>}
            <div className="ug-field"><label>{sheet === "note" ? "Note" : "Message"}</label><textarea className="ug-textarea" placeholder={sheet === "note" ? "What happened?" : "Write your message"} /></div>
            {sheet === "note" && <label className="ug-sharerow"><span className="ug-minicheck"><Check weight="bold" /></span> Share with the client</label>}
            <div className="ug-sheet-actions">
              <button className="ug-btn ghost" onClick={() => setSheet(null)}>Cancel</button>
              <button className="ug-btn primary" onClick={() => { const m = sheet === "note" ? "Note added to 14 Bushey Avenue (simulated)" : "Email queued (simulated)"; setSheet(null); fireToast(m); }}>{sheet === "note" ? "Add note" : "Send"}</button>
            </div>
          </LiquidGlass>
        </div>
      )}

      {toast && (
        <LiquidGlass radius={13} thickness={9} displace={30} aberration={3} tint={GLASS.toast[theme]} className="ug-toast" role="status">
          <Check weight="bold" /><span>{toast}</span>
        </LiquidGlass>
      )}
    </div>
  );
}

function SkeletonFeed() {
  return (
    <div className="ug-layout">
      <aside className="ug-side"><div className="ug-rail ug-skel-rail">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ug-skel-line" style={{ width: `${70 - i * 8}%` }} />)}</div></aside>
      <div className="ug-feed">
        <div className="ug-skel-search" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="ug-skel-card">
            <div className="ug-skel-head"><div className="ug-skel-thumb" /><div className="ug-skel-lines"><div className="ug-skel-line" style={{ width: "40%" }} /><div className="ug-skel-line" style={{ width: "26%" }} /></div></div>
            {Array.from({ length: 2 }).map((_, j) => <div key={j} className="ug-skel-row"><div className="ug-skel-dot" /><div className="ug-skel-line" style={{ width: `${80 - j * 15}%` }} /></div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ theme }: { theme: Theme }) {
  return (
    <div className="ug-empty">
      <LiquidGlass radius={24} thickness={16} displace={30} aberration={1} tint={GLASS.empty[theme]} className="ug-empty-card">
        <span className="ug-empty-pill">Nothing here yet</span>
        <h2>Nothing to catch up on yet</h2>
        <p>Everything happening across your sales, including the work done for you by your progressors, shows up here as it happens.</p>
        <div className="ug-empty-cards">
          {[["Solicitor replies, no chasing", "Replies land here the moment they arrive."], ["See every file's progress", "Each sale's stage and next step, at a glance."], ["See who confirmed each step", "Every confirmation, with the person who made it."]].map(([t, b]) => (
            <div key={t} className="ug-empty-sub"><strong>{t}</strong><span>{b}</span></div>
          ))}
        </div>
      </LiquidGlass>
    </div>
  );
}

const CSS = `
.ug-root{
  --accent:#0a84ff; --accent-soft:rgba(10,132,255,0.16);
  --ok:#30d158; --warn:#ff9f0a; --info:#5e9bff;
  --ink:#f3f4f8; --ink2:rgba(243,244,248,0.64); --ink3:rgba(243,244,248,0.4);
  --line:rgba(255,255,255,0.1); --line2:rgba(255,255,255,0.06);
  --card:rgba(32,35,47,0.44); --solid:rgba(30,33,46,0.6);
  --avatar-bg:rgba(255,255,255,0.08); --field-bg:rgba(255,255,255,0.07);
  --row-hover:rgba(255,255,255,0.045); --seg-thumb:rgba(255,255,255,0.14);
  position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; color:var(--ink); background-color:#0a0e17;
  font-family:-apple-system, BlinkMacSystemFont, "SF Pro Display","SF Pro Text","Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased; letter-spacing:-0.011em;
}
.ug-root[data-theme="light"]{
  --accent-soft:rgba(10,132,255,0.12);
  --ink:#11141b; --ink2:rgba(17,20,27,0.62); --ink3:rgba(17,20,27,0.44);
  --line:rgba(12,16,28,0.1); --line2:rgba(12,16,28,0.06);
  --card:rgba(255,255,255,0.52); --solid:rgba(255,255,255,0.62);
  --avatar-bg:rgba(12,16,28,0.05); --field-bg:rgba(12,16,28,0.04);
  --row-hover:rgba(12,16,28,0.035); --seg-thumb:#ffffff;
  background-color:#f6f8fc;
}
/* Real TSP ambients (exact values from app/styles/elevra.css), layered over the
   real AppBackground aurora + the --c-bg base. Not the production file — scoped
   copy so nothing global changes. */
.ug-scene{ position:absolute; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(60% 40% at 15% 10%, rgba(56,225,255,0.08), transparent 70%),
    radial-gradient(50% 35% at 85% 90%, rgba(168,255,96,0.05), transparent 70%);
}
.ug-root[data-theme="light"] .ug-scene{
  background:
    radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%),
    radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%),
    radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%),
    radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%);
}

/* LiquidGlass base — softened shadow, single top sheen */
.lgx-surface{ position:relative; border:1px solid var(--line);
  -webkit-backdrop-filter:blur(11px) saturate(160%); backdrop-filter:blur(11px) saturate(160%);
  box-shadow:0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.3);
  transition:transform .45s cubic-bezier(.2,.8,.2,1), box-shadow .45s ease, border-radius .4s ease; }
.lgx-surface::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent) top/100% 1px no-repeat;
  opacity:.55; }
.ug-root[data-theme="light"] .lgx-surface{ box-shadow:0 8px 26px rgba(20,30,60,0.1), inset 0 1px 0 rgba(255,255,255,0.7); }
.lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }

.ug-wrap{ position:relative; z-index:2; max-width:1060px; margin:0 auto; padding:52px 24px 150px; }

/* Top bar */
.ug-topbar{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:28px; flex-wrap:wrap; }
.ug-eyebrow{ font-size:12px; font-weight:600; letter-spacing:.01em; color:var(--ink3); margin-bottom:9px; }
.ug-title{ font-size:clamp(30px,4vw,42px); font-weight:780; letter-spacing:-.035em; line-height:1; }
.ug-sub{ font-size:15.5px; color:var(--ink2); margin-top:9px; }
.ug-topctl{ display:flex; align-items:center; gap:10px; }
.ug-seg{ --i:0; position:relative; display:grid; grid-template-columns:repeat(3,1fr); padding:3px; border-radius:11px; background:var(--field-bg); border:1px solid var(--line); }
.ug-seg-thumb{ position:absolute; top:3px; left:3px; bottom:3px; width:calc((100% - 6px)/3); border-radius:9px; background:var(--seg-thumb); box-shadow:inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 3px rgba(20,30,60,0.18); transform:translateX(calc(var(--i)*100%)); transition:transform .42s cubic-bezier(.3,1.25,.4,1); }
.ug-seg-btn{ position:relative; z-index:1; padding:7px 15px; font-size:12.5px; font-weight:550; color:var(--ink3); background:none; border:none; cursor:pointer; transition:color .3s; }
.ug-seg-btn.on{ color:var(--ink); }
.ug-themesw{ width:52px; height:31px; border-radius:999px; border:1px solid var(--line); background:var(--field-bg); position:relative; cursor:pointer; padding:0; transition:background .4s; }
.ug-themesw.on{ background:var(--accent-soft); }
.ug-themesw-knob{ position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.3); transition:transform .4s cubic-bezier(.3,1.35,.4,1); }
.ug-themesw-knob svg{ width:13px; height:13px; color:#33343c; }
.ug-themesw.on .ug-themesw-knob{ transform:translateX(21px); }

/* Layout */
.ug-layout{ display:grid; grid-template-columns:1fr; gap:18px; }
@media (min-width:900px){ .ug-layout{ grid-template-columns:230px minmax(0,1fr); align-items:start; } .ug-side{ position:sticky; top:20px; } .ug-mobfilter,.ug-mobrail{ display:none; } }
@media (max-width:899px){ .ug-side{ display:none; } }

/* Filter rail */
.ug-rail{ padding:7px; } .ug-mobrail{ padding:9px; margin-bottom:2px; } .ug-rail > *, .ug-mobrail > *{ position:relative; z-index:1; }
.ug-fgroup{ border-bottom:1px solid var(--line2); } .ug-fgroup:last-of-type{ border-bottom:none; }
.ug-fgroup-hdr{ display:flex; align-items:center; justify-content:space-between; width:100%; padding:11px 10px; background:none; border:none; cursor:pointer; font-size:12px; font-weight:650; color:var(--ink); border-radius:9px; transition:background .15s; }
.ug-fgroup-hdr:hover{ background:var(--row-hover); }
.ug-fgroup-hdr > span{ display:inline-flex; align-items:center; gap:8px; }
.ug-fcaret{ width:12px; height:12px; color:var(--ink3); transition:transform .25s cubic-bezier(.4,0,.2,1); }
.ug-fgroup.open .ug-fcaret{ transform:rotate(180deg); }
.ug-fbadge{ font-size:10px; font-weight:700; color:#fff; background:var(--accent); border-radius:999px; min-width:16px; height:16px; padding:0 5px; display:inline-flex; align-items:center; justify-content:center; }
.ug-chips{ display:flex; flex-wrap:wrap; gap:7px; padding:2px 8px 12px; }
.ug-chip{ display:inline-flex; align-items:center; gap:0; font-size:12.5px; font-weight:550; color:var(--ink2); background:var(--avatar-bg); border:1px solid var(--line); border-radius:9px; padding:6px 11px; cursor:pointer; transition:transform .3s cubic-bezier(.3,1.4,.4,1), background .25s, color .25s, border-color .25s, gap .25s; }
.ug-chip-tick{ width:0; overflow:hidden; display:inline-flex; align-items:center; transition:width .25s; } .ug-chip-tick svg{ width:12px; height:12px; }
.ug-chip:hover{ color:var(--ink); border-color:var(--ink3); }
.ug-chip.on{ background:var(--accent); border-color:var(--accent); color:#fff; gap:6px; }
.ug-chip.on .ug-chip-tick{ width:12px; }
.ug-fside-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 10px 6px; }
.ug-fcount{ font-size:11px; color:var(--ink3); }
.ug-clear{ font-size:12px; font-weight:600; color:var(--accent); background:none; border:none; cursor:pointer; padding:0; }

/* Feed */
.ug-feed{ display:flex; flex-direction:column; gap:14px; min-width:0; }
.ug-searchrow{ display:flex; gap:10px; }
.ug-search{ flex:1; display:flex; align-items:center; gap:9px; padding:11px 14px; border-radius:12px; background:var(--solid); border:1px solid var(--line); transition:border-color .2s; }
.ug-search:focus-within{ border-color:var(--accent); }
.ug-search-ico{ width:16px; height:16px; color:var(--ink3); flex-shrink:0; }
.ug-search input{ flex:1; min-width:0; background:none; border:none; outline:none; color:var(--ink); font-size:14px; font-family:inherit; }
.ug-search input::placeholder{ color:var(--ink3); }
.ug-search-clear{ background:none; border:none; cursor:pointer; color:var(--ink3); display:grid; place-items:center; padding:3px; } .ug-search-clear svg{ width:13px; height:13px; }
.ug-mobfilter{ display:inline-flex; align-items:center; gap:6px; padding:0 15px; border-radius:12px; background:var(--solid); border:1px solid var(--line); color:var(--ink); cursor:pointer; } .ug-mobfilter svg{ width:18px; height:18px; }

/* Accordion */
.ug-acc{ display:grid; grid-template-rows:0fr; transition:grid-template-rows .4s cubic-bezier(.3,.9,.3,1); }
.ug-acc.open{ grid-template-rows:1fr; } .ug-acc-in{ overflow:hidden; }

/* Day group — light, subordinate */
.ug-day{ display:flex; flex-direction:column; }
.ug-daybar{ display:flex; align-items:center; gap:13px; width:100%; padding:10px 4px 10px 2px; background:none; border:none; cursor:pointer; }
.ug-daylabel{ font-size:13px; font-weight:650; letter-spacing:-.01em; color:var(--ink); }
.ug-dayrule{ flex:1; height:1px; background:var(--line2); }
.ug-daycount{ font-size:11px; color:var(--ink3); }
.ug-daycaret{ width:12px; height:12px; color:var(--ink3); transition:transform .3s cubic-bezier(.4,0,.2,1); }
.ug-daycaret.open{ transform:rotate(180deg); }
.ug-day-body{ display:flex; flex-direction:column; gap:12px; padding:4px 0 10px; }

/* Property card */
.ug-txcard{ overflow:hidden; } .ug-txcard > *{ position:relative; z-index:1; }
.ug-txhead{ display:flex; align-items:flex-start; gap:13px; width:100%; padding:14px 16px 17px; background:none; border:none; cursor:pointer; text-align:left; position:relative; }
.ug-txhead:hover{ background:var(--row-hover); }
.ug-marker{ width:36px; height:36px; border-radius:10px; display:grid; place-items:center; flex-shrink:0; background:var(--avatar-bg); border:1px solid var(--line); }
.ug-marker svg{ width:18px; height:18px; color:var(--ink2); }
.ug-txaddr{ min-width:0; flex:1; padding-top:1px; } .ug-txaddr-1{ display:block; font-size:15px; font-weight:650; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .ug-txaddr-2{ display:block; font-size:12px; color:var(--ink3); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ug-txmeta{ display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; text-align:right; padding-top:1px; }
.ug-status{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--ink2); }
.ug-status-dot{ width:7px; height:7px; border-radius:50%; }
.ug-status-dot[data-tone="success"]{ background:var(--ok); } .ug-status-dot[data-tone="warning"]{ background:var(--warn); } .ug-status-dot[data-tone="info"]{ background:var(--info); } .ug-status-dot[data-tone="muted"]{ background:var(--ink3); }
.ug-status-pct{ color:var(--ink3); font-weight:600; }
.ug-meta-line,.ug-meta-next{ font-size:11px; color:var(--ink3); line-height:1.4; max-width:230px; }
.ug-txgo{ width:14px; height:14px; color:var(--ink3); flex-shrink:0; margin-top:3px; }
.ug-txprogress{ position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--line2); overflow:hidden; } .ug-txprogress > span{ display:block; height:100%; opacity:.85; background:linear-gradient(90deg,var(--accent),#5ac8fa); }
@media (max-width:640px){ .ug-txmeta{ display:none; } .ug-txgo{ display:none; } }

/* Rows */
.ug-row{ display:flex; align-items:flex-start; gap:12px; padding:12px 16px; border-top:1px solid var(--line2); transition:background .2s; }
.ug-row.first{ border-top:none; }
.ug-row:hover{ background:var(--row-hover); }
.ug-lead{ flex-shrink:0; height:20px; display:flex; align-items:center; } /* line-height band: avatar centres on the first line */
.ug-av{ display:block; }
.ug-kindbadge{ width:30px; height:30px; border-radius:50%; display:grid; place-items:center; background:rgba(94,155,255,0.14); color:var(--info); } .ug-kindbadge svg{ width:15px; height:15px; }
.ug-row-body{ flex:1; min-width:0; }
.ug-row-primary{ display:flex; align-items:flex-start; gap:12px; }
.ug-row-main{ flex:1; min-width:0; font-size:13.5px; font-weight:450; line-height:20px; color:var(--ink); }
.ug-row-time{ flex-shrink:0; font-size:11px; line-height:20px; color:var(--ink3); white-space:nowrap; }
.ug-row-cap{ font-size:11.5px; color:var(--ink3); margin-top:4px; font-weight:550; }
.ug-row-sec{ font-size:12.5px; color:var(--ink2); margin-top:4px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ug-doclink{ background:none; border:none; padding:0; font:inherit; font-size:13.5px; font-weight:500; color:var(--accent); cursor:pointer; text-align:left; } .ug-doclink:hover{ text-decoration:underline; text-underline-offset:2px; }

/* No-match + footer */
.ug-nomatch{ text-align:center; padding:32px 24px; border-radius:16px; background:var(--card); border:1px solid var(--line); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
.ug-nomatch p{ font-size:13.5px; color:var(--ink2); margin-bottom:10px; }
.ug-foot{ font-size:11px; line-height:1.6; color:var(--ink3); margin-top:14px; max-width:600px; }

/* Dock */
.ug-dock{ position:fixed; z-index:40; bottom:24px; left:50%; transform:translateX(-50%); display:inline-flex; align-items:center; gap:4px; padding:7px 9px; }
.ug-dock > *{ position:relative; z-index:1; }
.ug-dock-btn{ display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:15px; background:none; border:none; color:var(--ink); font-size:13.5px; font-weight:550; font-family:inherit; cursor:pointer; transition:background .25s, transform .3s cubic-bezier(.3,1.35,.4,1); }
.ug-dock-btn svg{ width:17px; height:17px; color:var(--accent); }
.ug-dock-btn:hover{ background:var(--row-hover); }
.ug-dock-btn:active{ transform:scale(.96); }
.ug-dock-sep{ width:1px; height:22px; background:var(--line); }

/* Overlay + sheet (centred dialog on desktop, bottom sheet on mobile) */
.ug-overlay{ position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(0,0,0,0.4); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); animation:ug-fade .3s; }
@keyframes ug-fade{ from{opacity:0} to{opacity:1} }
.ug-sheet{ position:relative; width:min(440px,100%); padding:26px 26px 24px; animation:ug-dialog-in .42s cubic-bezier(.2,.9,.3,1.04); }
.ug-sheet > *{ position:relative; z-index:1; }
@keyframes ug-dialog-in{ from{opacity:0; transform:translateY(12px) scale(.97)} to{opacity:1; transform:none} }
.ug-sheet-grip{ display:none; }
.ug-sheet-x{ position:absolute; top:16px; right:16px; width:30px; height:30px; border-radius:50%; display:grid; place-items:center; background:var(--avatar-bg); border:1px solid var(--line); color:var(--ink2); cursor:pointer; z-index:2; transition:background .2s, color .2s; } .ug-sheet-x:hover{ color:var(--ink); } .ug-sheet-x svg{ width:13px; height:13px; }
.ug-sheet h3{ font-size:19px; font-weight:720; letter-spacing:-.02em; }
.ug-sheet-sub{ font-size:13px; color:var(--ink2); margin:5px 0 18px; line-height:1.4; }
.ug-field{ margin-bottom:13px; } .ug-field label{ display:block; font-size:11px; font-weight:600; color:var(--ink2); margin-bottom:6px; letter-spacing:.01em; }
.ug-fakeinput{ padding:11px 14px; border-radius:11px; background:var(--field-bg); border:1px solid var(--line); font-size:14px; color:var(--ink); }
.ug-textarea{ width:100%; min-height:86px; resize:vertical; padding:11px 14px; border-radius:11px; background:var(--field-bg); border:1px solid var(--line); font-size:14px; color:var(--ink); font-family:inherit; outline:none; transition:border-color .2s; } .ug-textarea::placeholder{ color:var(--ink3); } .ug-textarea:focus{ border-color:var(--accent); }
.ug-sharerow{ display:flex; align-items:center; gap:9px; font-size:13.5px; color:var(--ink); cursor:default; margin-top:4px; }
.ug-minicheck{ width:19px; height:19px; border-radius:6px; background:var(--accent); display:grid; place-items:center; } .ug-minicheck svg{ width:12px; height:12px; color:#fff; }
.ug-sheet-actions{ display:flex; gap:10px; margin-top:22px; }
.ug-btn{ flex:1; padding:12px; border-radius:12px; font-size:14px; font-weight:600; border:none; cursor:pointer; font-family:inherit; transition:transform .3s cubic-bezier(.2,.9,.2,1.2), filter .2s, background .2s; }
.ug-btn:active{ transform:scale(.97); }
.ug-btn.primary{ background:var(--accent); color:#fff; box-shadow:0 5px 16px rgba(10,132,255,0.35); } .ug-btn.primary:hover{ filter:brightness(1.07); }
.ug-btn.ghost{ background:transparent; color:var(--ink2); border:1px solid var(--line); } .ug-btn.ghost:hover{ color:var(--ink); border-color:var(--ink3); background:var(--row-hover); }
@media (max-width:560px){
  .ug-overlay{ align-items:flex-end; padding:0; }
  .ug-sheet{ width:100%; border-radius:24px 24px 0 0; padding-top:14px; animation:ug-sheet-in .4s cubic-bezier(.2,.9,.3,1.04); }
  .ug-sheet-grip{ display:block; width:40px; height:5px; border-radius:999px; background:var(--line); margin:0 auto 14px; }
  .ug-sheet-x{ display:none; }
}
@keyframes ug-sheet-in{ from{opacity:0; transform:translateY(40px)} to{opacity:1; transform:none} }

/* Toast */
.ug-toast{ position:fixed; z-index:70; bottom:92px; left:50%; transform:translateX(-50%); display:inline-flex; align-items:center; gap:9px; padding:11px 17px; font-size:13px; font-weight:550; color:var(--ink); animation:ug-toast-in .4s cubic-bezier(.2,.9,.3,1.05); }
.ug-toast > *{ position:relative; z-index:1; } .ug-toast svg{ width:14px; height:14px; color:var(--ok); }
@keyframes ug-toast-in{ from{opacity:0; transform:translate(-50%,16px)} to{opacity:1; transform:translate(-50%,0)} }

/* Empty */
.ug-empty{ max-width:660px; margin:8px auto; }
.ug-empty-card{ padding:36px 34px; text-align:center; } .ug-empty-card > *{ position:relative; z-index:1; }
.ug-empty-pill{ display:inline-block; font-size:12px; font-weight:600; color:var(--ink2); background:var(--avatar-bg); border:1px solid var(--line); padding:5px 13px; border-radius:999px; }
.ug-empty-card h2{ font-size:25px; font-weight:740; letter-spacing:-.025em; margin:16px 0 10px; }
.ug-empty-card > p{ font-size:14.5px; color:var(--ink2); line-height:1.5; max-width:420px; margin:0 auto; }
.ug-empty-cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin-top:26px; border-top:1px solid var(--line2); padding-top:4px; text-align:left; }
.ug-empty-sub{ padding:18px 18px 4px; } .ug-empty-sub + .ug-empty-sub{ border-left:1px solid var(--line2); } .ug-empty-sub strong{ display:block; font-size:13.5px; font-weight:650; margin-bottom:5px; } .ug-empty-sub span{ font-size:12.5px; color:var(--ink2); line-height:1.45; }
@media (max-width:720px){ .ug-empty-cards{ grid-template-columns:1fr; } .ug-empty-sub + .ug-empty-sub{ border-left:none; border-top:1px solid var(--line2); } }

/* Skeleton */
.ug-skel-rail,.ug-skel-card{ background:var(--card); border:1px solid var(--line); border-radius:18px; -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
.ug-skel-rail{ padding:16px; display:flex; flex-direction:column; gap:14px; }
.ug-skel-search{ height:46px; border-radius:12px; background:var(--card); border:1px solid var(--line); }
.ug-skel-card{ padding:0; overflow:hidden; } .ug-skel-head{ display:flex; gap:13px; align-items:center; padding:15px 16px; border-bottom:1px solid var(--line2); } .ug-skel-thumb{ width:36px; height:36px; border-radius:10px; } .ug-skel-lines{ flex:1; display:flex; flex-direction:column; gap:8px; }
.ug-skel-row{ display:flex; gap:12px; align-items:center; padding:14px 16px; border-top:1px solid var(--line2); } .ug-skel-row:first-child{ border-top:none; } .ug-skel-dot{ width:30px; height:30px; border-radius:50%; flex-shrink:0; }
.ug-skel-line,.ug-skel-thumb,.ug-skel-dot{ background:linear-gradient(90deg, rgba(128,128,140,0.1) 25%, rgba(128,128,140,0.22) 37%, rgba(128,128,140,0.1) 63%); background-size:400% 100%; animation:ug-shimmer 1.4s ease infinite; } .ug-skel-line{ height:11px; border-radius:6px; }
.ug-skel-card + .ug-skel-card{ margin-top:14px; }
@keyframes ug-shimmer{ from{background-position:100% 0} to{background-position:0 0} }

@media (prefers-reduced-motion: reduce){
  .ug-acc,.ug-seg-thumb,.ug-chip,.ug-daycaret,.ug-fcaret,.ug-themesw-knob,.ug-dock-btn,.lgx-surface,.ug-txprogress>span{ transition:none !important; }
  .ug-sheet,.ug-toast,.ug-overlay,.ug-skel-line,.ug-skel-thumb,.ug-skel-dot{ animation:none !important; }
}
`;
