"use client";
// /dev/hub-glass-v3 — Hub redesign (B+C hybrid). Dev-only (blocks in production).
// Presentation-only. Mock/read-only data (./mock). Every action is SIMULATED
// (drawer / dialog / toast; no writes, emails or chases). Production, logic,
// permissions and queries are untouched.
//
// The experience: TSP states your morning in one grounded line, pre-focuses the
// most pressing situation on a lens surface with its real actions, and keeps the
// whole workload (index) and whole business (the book line) a glance away. Overlays
// are portalled to a top layer so menus/popovers can never be clipped. Glass is
// used selectively (focus surface + overlays only); the index + book stay crisp.

import {
  createContext, forwardRef, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, Sparkle, ArrowRight, Plus, NotePencil, PaperPlaneTilt, Check, CaretDown,
  CaretRight, TrendUp, CheckCircle, X, DotOutline, CalendarCheck, ArrowUDownLeft,
} from "@phosphor-icons/react";
import { GlassCard, GlassButton } from "@/components/liquid";
import {
  HUB, ROLES, CLIENTS, CATEGORY_LABEL, URGENCY, groupByProperty,
  type RoleKey, type WorkItem, type WorkAction, type PropertyGroup,
} from "./mock";

type Theme = "dark" | "light";
type View = "populated" | "clear" | "empty";

/* ─── reduced motion ─────────────────────────────────────────────────────── */
function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

/* ─── portal + anchored positioning (so overlays never clip) ─────────────── */
// Portalled content mounts on <body>, OUTSIDE the .lg-ds scope, so it would lose
// every --lg-* token. Re-establish the scope + theme on the portal root.
const ThemeCtx = createContext<Theme>("dark");
function Portal({ children }: { children: ReactNode }) {
  const theme = useContext(ThemeCtx);
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  return m ? createPortal(<div className="lg-ds v3-portal" data-theme={theme}>{children}</div>, document.body) : null;
}

function useAnchored(open: boolean, anchorRef: RefObject<HTMLElement>, floatRef: RefObject<HTMLElement>, opts: { side?: "top" | "bottom"; align?: "start" | "center" | "end"; gap?: number }) {
  const { side = "bottom", align = "start", gap = 8 } = opts;
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const f = floatRef.current?.getBoundingClientRect();
      if (!a || !f) return;
      let top = side === "top" ? a.top - f.height - gap : a.bottom + gap;
      if (side === "bottom" && top + f.height > window.innerHeight - 10) top = a.top - f.height - gap;
      if (top < 10) top = 10;
      let left = align === "end" ? a.right - f.width : align === "center" ? a.left + a.width / 2 - f.width / 2 : a.left;
      left = Math.max(10, Math.min(left, window.innerWidth - f.width - 10));
      setPos({ top, left });
    };
    place();
    const t = setTimeout(place, 0); // after glass measures
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, side, align, gap, anchorRef, floatRef]);
  return pos;
}

/* interactive portalled popover (click-open): outside-pointerdown + Esc close */
function Pop({ open, anchorRef, onClose, align = "start", side = "bottom", width, children }: { open: boolean; anchorRef: RefObject<HTMLElement>; onClose: () => void; align?: "start" | "center" | "end"; side?: "top" | "bottom"; width?: number; children: ReactNode }) {
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchored(open, anchorRef, floatRef, { side, align, gap: 8 });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (floatRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return (
    <Portal>
      <div ref={floatRef} className="v3-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600, width }}>
        <div className="v3-pop v3-glass">{children}</div>
      </div>
    </Portal>
  );
}

/* hover tooltip-style popover (non-interactive), portalled */
function HoverPop({ open, anchorRef, children }: { open: boolean; anchorRef: RefObject<HTMLElement>; children: ReactNode }) {
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "top", align: "center", gap: 8 });
  if (!open) return null;
  return (
    <Portal>
      <div ref={floatRef} className="v3-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1500, pointerEvents: "none" }}>
        <div className="v3-pop v3-pop--tip v3-glass">{children}</div>
      </div>
    </Portal>
  );
}

/* portalled glass menu (click-open), keyboard + outside close */
function Menu({ open, anchorRef, onClose, items, onPick }: { open: boolean; anchorRef: RefObject<HTMLElement>; onClose: () => void; items: WorkAction[]; onPick: (a: WorkAction) => void }) {
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "bottom", align: "end", gap: 6 });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (floatRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); (anchorRef.current as HTMLElement)?.focus?.(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = Array.from(floatRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
        btns[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    const f = setTimeout(() => floatRef.current?.querySelector("button")?.focus(), 10);
    return () => { clearTimeout(f); document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return (
    <Portal>
      <div ref={floatRef} className="v3-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600 }}>
        <div className="v3-menu v3-glass" role="menu">
          {items.map((it, i) => (
            <button key={i} role="menuitem" className={`v3-menu-item ${it.danger ? "danger" : ""}`} onClick={() => onPick(it)}>{it.label}</button>
          ))}
        </div>
      </div>
    </Portal>
  );
}

export default function HubGlassV3() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [roleKey, setRoleKey] = useState<RoleKey>("director");
  const [view, setView] = useState<View>("populated");
  const reduced = useReducedMotion();
  const role = ROLES[roleKey];

  const [scope, setScope] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ kind: "chase" | "email"; item: WorkItem; label: string } | null>(null);
  const [modal, setModal] = useState<{ item: WorkItem; label: string } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = useCallback((m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2500); }, []);
  const run = useCallback((item: WorkItem, a: WorkAction) => {
    if (a.kind === "chase") setDrawer({ kind: "chase", item, label: a.label });
    else if (a.kind === "email") setDrawer({ kind: "email", item, label: a.label });
    else if (a.kind === "confirm_date") setModal({ item, label: a.label });
    else fire(`${a.label} · ${item.address} (simulated)`);
  }, [fire]);

  // scope filter = ownership as a control (not a row label)
  const scopedWork = useMemo(() => {
    if (view !== "populated") return [];
    const label = role.scopes[scope];
    if (!role.showOwner || !label || scope === 0) return HUB.work;
    if (label === "Mine") return HUB.work.filter((w) => w.assignee === "You");
    const name = label.replace("'s", "");
    return HUB.work.filter((w) => w.assignee === name);
  }, [view, role, scope]);

  const groups = useMemo(() => groupByProperty(scopedWork), [scopedWork]);
  const escalatedGroups = groups.filter((g) => g.topUrgency === "escalated");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focused = groups.find((g) => g.propertyId === focusedId) ?? groups[0] ?? null;
  useEffect(() => { setFocusedId(groups[0]?.propertyId ?? null); }, [scope, roleKey, view]); // re-focus top when the set changes

  const escIndex = escalatedGroups.findIndex((g) => g.propertyId === focused?.propertyId);
  const stepEscalated = () => { if (!escalatedGroups.length) return; const n = escalatedGroups[(Math.max(0, escIndex) + 1) % escalatedGroups.length]; setFocusedId(n.propertyId); };

  const workFirst = role.emphasis === "execution";

  return (
    <ThemeCtx.Provider value={theme}>
    <div className="lg-ds v3-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="v3-scene" aria-hidden />

      {/* prototype dev controls */}
      <div className="v3-dev">
        <span className="v3-dev-tag"><Sparkle weight="fill" /> Hub prototype v3 · actions simulated</span>
        <div className="v3-dev-ctl">
          <select className="v3-sel" value={roleKey} aria-label="Role" onChange={(e) => { setRoleKey(e.target.value as RoleKey); setScope(0); }}>
            {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <div className="v3-seg3">
            {(["populated", "clear", "empty"] as View[]).map((v) => (
              <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v === "populated" ? "Populated" : v === "clear" ? "All clear" : "Empty"}</button>
            ))}
          </div>
          <button className={`v3-theme ${theme === "light" ? "on" : ""}`} aria-label="Theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="v3-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </div>
      </div>

      <main className="v3-wrap">
        {role.banners.includes("card") && view !== "empty" && <Banner tone="warn" title="Add a payment card to keep adding sales" body="£5 per sale · £59 subscription · £39 per extra team member." cta="Add a card" onCta={() => fire("Open billing (simulated)")} />}
        {role.banners.includes("email") && view !== "empty" && <Banner tone="accent" title="Send emails from your own address" body="Verify your sender so clients see your agency, not ours." cta="Set up" onCta={() => fire("Email setup (simulated)")} />}

        <Briefing role={role} view={view} groups={groups} escalatedGroups={escalatedGroups} reduced={reduced} fire={fire} focusEscalated={() => { if (escalatedGroups[0]) setFocusedId(escalatedGroups[0].propertyId); }} />

        {view === "empty" ? (
          <EmptyState role={roleKey} onCta={fire} />
        ) : workFirst ? (
          <>
            <Work role={role} view={view} groups={groups} escalatedGroups={escalatedGroups} focused={focused} setFocusedId={setFocusedId} escIndex={escIndex} stepEscalated={stepEscalated} scope={scope} setScope={setScope} run={run} fire={fire} reduced={reduced} />
            <Book role={role} roleKey={roleKey} fire={fire} reduced={reduced} />
          </>
        ) : (
          <>
            <Book role={role} roleKey={roleKey} fire={fire} reduced={reduced} />
            <Work role={role} view={view} groups={groups} escalatedGroups={escalatedGroups} focused={focused} setFocusedId={setFocusedId} escIndex={escIndex} stepEscalated={stepEscalated} scope={scope} setScope={setScope} run={run} fire={fire} reduced={reduced} />
          </>
        )}
      </main>

      {drawer && <ActionDrawer data={drawer} onClose={() => setDrawer(null)} onSend={(m) => { setDrawer(null); fire(m); }} />}
      {modal && <ConfirmDateModal data={modal} onClose={() => setModal(null)} onConfirm={(m) => { setModal(null); fire(m); }} />}
      {toast && (
        <Portal>
          <div className="v3-layer" style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 1700 }}>
            <div className="v3-toast v3-glass"><Check weight="bold" /><span>{toast}</span></div>
          </div>
        </Portal>
      )}
    </div>
    </ThemeCtx.Provider>
  );
}

/* ─── briefing: one grounded line, with two live facts ───────────────────── */
function Briefing({ role, view, groups, escalatedGroups, reduced, fire, focusEscalated }: { role: typeof ROLES[RoleKey]; view: View; groups: PropertyGroup[]; escalatedGroups: PropertyGroup[]; reduced: boolean; fire: (m: string) => void; focusEscalated: () => void }) {
  const p = HUB.pipeline;
  const nearRef = useRef<HTMLButtonElement>(null);
  const [fc, setFc] = useState(false);
  const esc = escalatedGroups.length;
  const rest = groups.length - esc;

  let line: ReactNode;
  if (view === "empty") line = "Your pipeline starts with one sale.";
  else if (view === "clear" || groups.length === 0) {
    line = <>Nothing needs you right now. {p.activeFiles} sales moving, <NearFact ref={nearRef} onClick={() => setFc(true)}>{p.exchangingSoon} near exchange</NearFact>, all on track.</>;
  } else {
    line = <>{p.activeFiles} sales moving, <NearFact ref={nearRef} onClick={() => setFc(true)}>{p.exchangingSoon} near exchange</NearFact>. <button className="v3-fact v3-fact--alert" onClick={focusEscalated}>{esc} escalated need you</button>{rest > 0 ? <>, {rest} more this week.</> : "."}</>;
  }

  return (
    <header className="v3-brief">
      <div className="v3-brief-text">
        <h1>Good morning, {role.name}</h1>
        {view !== "empty" && <p>{line}</p>}
      </div>
      <div className="v3-brief-actions">
        <GlassButton variant="subtle" onClick={() => fire("New note (simulated)")}><NotePencil weight="regular" /> Note</GlassButton>
        <GlassButton variant="subtle" onClick={() => fire("New email (simulated)")}><PaperPlaneTilt weight="regular" /> Email</GlassButton>
        {role.canCreateSale && <GlassButton variant="primary" onClick={() => fire("Add a sale (simulated)")}><Plus weight="bold" /> Add a sale</GlassButton>}
      </div>
      <Pop open={fc} anchorRef={nearRef} onClose={() => setFc(false)} align="start" width={300}>
        <ForecastBody />
      </Pop>
    </header>
  );
}
const NearFact = forwardRef<HTMLButtonElement, { children: ReactNode; onClick: () => void }>(
  function NearFact({ children, onClick }, ref) {
    return <button ref={ref} className="v3-fact" onClick={onClick}>{children}</button>;
  }
);

/* ─── the book: pipeline line + scannable cockpit (always visible) ───────── */
function Book({ role, roleKey, fire, reduced }: { role: typeof ROLES[RoleKey]; roleKey: RoleKey; fire: (m: string) => void; reduced: boolean }) {
  const p = HUB.pipeline;
  const total = p.stages.reduce((s, st) => s + st.count, 0);
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const fcRef = useRef<HTMLButtonElement>(null);
  const perfRef = useRef<HTMLButtonElement>(null);
  const whoRef = useRef<HTMLButtonElement>(null);
  const [fc, setFc] = useState(false);
  const [perf, setPerf] = useState(false);
  const [who, setWho] = useState(false);
  const slim = role.emphasis === "execution";

  return (
    <section className="v3-book">
      <div className="v3-book-line" role="list">
        {p.stages.map((st, i) => {
          const grow = Math.max(8, (st.count / total) * 100);
          const active = hover === st.key;
          return (
            <div
              key={st.key} role="listitem" className="v3-seg" data-reached={i < 5} style={{ flexGrow: grow }}
              ref={active ? hoverRef : undefined}
              onMouseEnter={() => setHover(st.key)} onMouseLeave={() => setHover((h) => (h === st.key ? null : h))}
            >
              <button className="v3-seg-btn" onFocus={() => setHover(st.key)} onBlur={() => setHover((h) => (h === st.key ? null : h))} onClick={() => fire(`Open ${st.label} (simulated)`)}>
                <span className="v3-seg-n">{st.count}</span>
                <span className="v3-seg-l">{st.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      <HoverPop open={!!hover} anchorRef={hoverRef}>
        {hover && (() => { const st = p.stages.find((s) => s.key === hover)!; return (
          <>
            <div className="v3-pop-h">{st.label} · {st.count}</div>
            {st.files.slice(0, 6).map((f) => <div key={f} className="v3-pop-row">{f}</div>)}
            {st.files.length > 6 && <div className="v3-pop-more">+{st.files.length - 6} more</div>}
          </>
        ); })()}
      </HoverPop>

      {/* cockpit — key figures stay visible; detail is one expand away */}
      <div className="v3-cockpit">
        <span className="v3-ck"><b>£{p.pipelineValueM}m</b> pipeline <i>{role.moneyLabel}</i></span>
        <span className="v3-ck-div" />
        <span className="v3-ck"><b>{p.exchLast30}</b> exchanges · 30 days <span className="v3-up"><TrendUp weight="bold" />{p.momentumPct}%</span></span>
        {!slim && <><span className="v3-ck-div" /><span className="v3-ck"><b>{p.medianDays}d</b> median</span>
          <span className="v3-ck-div" /><span className="v3-ck"><b>{p.within12Pct}%</b> within 12 weeks</span></>}
        <span className="v3-ck-grow" />
        <button ref={fcRef} className="v3-ck-link" aria-expanded={fc} onClick={() => setFc((v) => !v)}>Forecast <CaretDown weight="bold" /></button>
        <button ref={perfRef} className="v3-ck-link" aria-expanded={perf} onClick={() => setPerf((v) => !v)}>Performance <CaretDown weight="bold" /></button>
        {role.businessPanel === "service" && <button ref={whoRef} className="v3-ck-link" aria-expanded={who} onClick={() => setWho((v) => !v)}>Who's managing <CaretDown weight="bold" /></button>}
        {role.businessPanel === "clients" && <button ref={whoRef} className="v3-ck-link" aria-expanded={who} onClick={() => setWho((v) => !v)}>Clients <CaretDown weight="bold" /></button>}
      </div>

      <Pop open={fc} anchorRef={fcRef} onClose={() => setFc(false)} align="end" width={320}><ForecastBody /></Pop>
      <Pop open={perf} anchorRef={perfRef} onClose={() => setPerf(false)} align="end" width={300}><PerformanceBody reduced={reduced} /></Pop>
      <Pop open={who} anchorRef={whoRef} onClose={() => setWho(false)} align="end" width={290}>
        {role.businessPanel === "clients" ? <ClientsBody fire={fire} onClose={() => setWho(false)} /> : <ServiceBody admin={roleKey === "admin"} />}
      </Pop>
    </section>
  );
}

function ForecastBody() {
  const [hi, setHi] = useState(HUB.forecast.findIndex((w) => w.current));
  const max = Math.max(...HUB.forecast.map((w) => w.count));
  const w = HUB.forecast[hi] ?? HUB.forecast[0];
  return (
    <div>
      <div className="v3-pop-h">Exchange forecast · next 5 weeks</div>
      <div className="v3-fc">
        {HUB.forecast.map((wk, i) => (
          <button key={wk.label} className={`v3-fc-col ${wk.current ? "cur" : ""} ${hi === i ? "hi" : ""}`} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} aria-label={`${wk.label}: ${wk.count} exchanges, £${wk.feesK}k`}>
            <span className="v3-fc-bar" style={{ height: `${18 + (wk.count / max) * 46}px` }}><b>{wk.count}</b></span>
            <span className="v3-fc-l">{wk.label.replace("This week", "This").replace("Next week", "Next").replace("In ", "").replace(" weeks", "w")}</span>
          </button>
        ))}
      </div>
      <div className="v3-fc-detail">
        <div className="v3-fc-detail-h">{w.label} · {w.count} exchanges · £{w.feesK}k</div>
        {w.files.map((f) => <div key={f.address} className="v3-pop-row"><span>{f.address}</span><b>£{f.feeK}k</b></div>)}
      </div>
    </div>
  );
}

function PerformanceBody({ reduced }: { reduced: boolean }) {
  const p = HUB.pipeline;
  return (
    <div>
      <div className="v3-pop-h">Performance · last 30 days</div>
      <div className="v3-perf-big"><strong>{p.exchLast30}</strong><span>exchanges <i className="v3-up"><TrendUp weight="bold" />{p.momentumPct}%</i></span><Spark data={p.spark} big /></div>
      <div className="v3-perf-slas"><span><b>{p.medianDays}d</b> median to exchange</span><span><b>{p.within12Pct}%</b> within 12 weeks</span></div>
      <div className="v3-perf-wins"><WinsCarousel reduced={reduced} /></div>
    </div>
  );
}

function ServiceBody({ admin }: { admin: boolean }) {
  return (
    <div>
      <div className="v3-pop-h">Who's managing</div>
      <div className="v3-split-bar"><span style={{ width: "62%" }} /></div>
      <div className="v3-split-legend"><span><i className="a" /> Self-managed 62%</span><span><i className="b" /> Outsourced 38%</span></div>
      {admin && <p className="v3-pop-note">Top agencies: Harpers Estates, Weston &amp; Co, Bridge Property</p>}
    </div>
  );
}
function ClientsBody({ fire, onClose }: { fire: (m: string) => void; onClose: () => void }) {
  return (
    <div>
      <div className="v3-pop-h">Your clients</div>
      <table className="v3-clients"><tbody>
        {CLIENTS.map((c) => (
          <tr key={c.name}><td>{c.name}</td><td>{c.active} active</td><td>£{c.pipelineM}m</td><td>{c.feeUnset ? <button className="v3-link" onClick={() => { onClose(); fire("Set fee (simulated)"); }}>Set fee</button> : `£${c.feeK}k`}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

function Spark({ data, big }: { data: number[]; big?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(" ");
  return <svg className={`v3-spark ${big ? "big" : ""}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke="var(--lg-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function WinsCarousel({ reduced }: { reduced: boolean }) {
  const slides = [
    { v: `${HUB.wins.exchanges}`, k: "exchanges this month" },
    { v: `${HUB.wins.completions}`, k: "completions this month" },
    { v: `${HUB.wins.fastestDays}d`, k: "fastest to exchange" },
    { v: `£${HUB.wins.biggestFeeK}k`, k: "biggest fee" },
    { v: `${HUB.wins.newBusiness}`, k: "new sales won" },
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  useEffect(() => { if (reduced || paused) return; const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000); return () => clearInterval(t); }, [reduced, paused, slides.length]);
  return (
    <div className="v3-wins" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) setI((x) => (x + (dx < 0 ? 1 : -1) + slides.length) % slides.length); touch.current = null; }}>
      <div className="v3-wins-h">This month</div>
      {reduced ? (
        <div className="v3-wins-row"><strong>{slides[0].v}</strong> <span>{slides[0].k}</span></div>
      ) : (
        <>
          <div className="v3-wins-slide" key={i} aria-live="polite"><strong>{slides[i].v}</strong> <span>{slides[i].k}</span></div>
          <div className="v3-wins-dots">{slides.map((s, x) => <button key={s.k} className={`v3-dot ${x === i ? "on" : ""}`} aria-label={`Win ${x + 1}`} onClick={() => setI(x)} />)}</div>
        </>
      )}
    </div>
  );
}

/* ─── the work: focus pane (+ recent activity) and complete index, one surface ─ */
function Work({ role, view, groups, escalatedGroups, focused, setFocusedId, escIndex, stepEscalated, scope, setScope, run, fire, reduced }: {
  role: typeof ROLES[RoleKey]; view: View; groups: PropertyGroup[]; escalatedGroups: PropertyGroup[]; focused: PropertyGroup | null;
  setFocusedId: (id: string) => void; escIndex: number; stepEscalated: () => void; scope: number; setScope: (n: number) => void;
  run: (i: WorkItem, a: WorkAction) => void; fire: (m: string) => void; reduced: boolean;
}) {
  const allClear = view === "clear" || groups.length === 0;
  return (
    <section className="v3-work">
      <div className="v3-work-left">
        {allClear ? <AllClearFocus /> : focused && <FocusPane g={focused} role={role} escCount={escalatedGroups.length} escIndex={escIndex} stepEscalated={stepEscalated} run={run} reduced={reduced} />}
        <RecentActivity fire={fire} />
      </div>
      <div className="v3-work-right">
        <div className="v3-index-head">
          <h2>{allClear ? "You're caught up" : `${groups.length} ${groups.length === 1 ? "sale needs" : "sales need"} you`}</h2>
          {role.showOwner && role.scopes.length > 0 && !allClear && (
            <ScopeControl scopes={role.scopes} value={scope} onChange={setScope} />
          )}
        </div>
        <div className="v3-index">
          {HUB.diary.map((d) => (
            <div key={d.id} className="v3-diary">
              <span className="v3-diary-ic" data-status={d.status}>{d.type === "exchange" ? <CheckCircle weight="fill" /> : <CalendarCheck weight="fill" />}</span>
              <div className="v3-diary-body"><strong>{d.type === "exchange" ? "Exchange" : "Completion"} today</strong><span>{d.address}</span></div>
              {d.status === "ready" ? <GlassButton size="sm" variant="primary" onClick={() => fire(`Confirm ${d.type} · ${d.address} (simulated)`)}>Confirm</GlassButton>
                : d.status === "not_ready" ? <span className="v3-diary-tag">Not ready</span> : <span className="v3-diary-tag done">Done</span>}
            </div>
          ))}
          {!allClear && <div className="v3-index-sep" />}
          {allClear ? (
            <p className="v3-index-clear">Nothing is waiting on you. We'll surface the next thing the moment it lands.</p>
          ) : groups.map((g) => (
            <IndexRow key={g.propertyId} g={g} selected={g.propertyId === focused?.propertyId} onSelect={() => setFocusedId(g.propertyId)} />
          ))}
        </div>
        {!allClear && <button className="v3-index-foot" onClick={() => fire("Open work queue (simulated)")}>Open the full work queue <ArrowRight weight="bold" /></button>}
      </div>
    </section>
  );
}

function ScopeControl({ scopes, value, onChange }: { scopes: string[]; value: number; onChange: (n: number) => void }) {
  return (
    <div className="v3-scope" role="tablist" aria-label="Scope">
      <span className="v3-scope-thumb" style={{ width: `calc((100% - 6px) / ${scopes.length})`, transform: `translateX(calc(${value} * 100%))` }} />
      {scopes.map((s, i) => <button key={s} role="tab" aria-selected={value === i} className="v3-scope-btn" data-on={value === i} onClick={() => onChange(i)}>{s}</button>)}
    </div>
  );
}

function IndexRow({ g, selected, onSelect }: { g: PropertyGroup; selected: boolean; onSelect: () => void }) {
  const top = g.items[0];
  const tone = URGENCY[top.urgency].tone;
  const showDot = top.urgency === "escalated" || top.urgency === "overdue";
  return (
    <button className="v3-ir" data-selected={selected || undefined} onClick={onSelect}>
      {showDot ? <span className="v3-ir-dot" data-tone={tone} /> : <span className="v3-ir-dot v3-ir-dot--none" />}
      <span className="v3-ir-body">
        <span className="v3-ir-addr">{g.address}</span>
        <span className="v3-ir-note">{g.items.length > 1 ? `${g.items.length} things need you` : top.indexNote}</span>
      </span>
      <CaretRight weight="bold" className="v3-ir-caret" />
    </button>
  );
}

function FocusPane({ g, role, escCount, escIndex, stepEscalated, run, reduced }: { g: PropertyGroup; role: typeof ROLES[RoleKey]; escCount: number; escIndex: number; stepEscalated: () => void; run: (i: WorkItem, a: WorkAction) => void; reduced: boolean }) {
  return (
    <GlassCard material="lens" radius={20} strength="soft" thickness={1.15} className="v3-focus" key={reduced ? undefined : g.propertyId}>
      <div className="v3-focus-top">
        <div>
          <div className="v3-focus-kicker">{CATEGORY_LABEL[g.items[0].category]} · {g.items[0].stage}{role.showOwner ? ` · ${g.items[0].assignee === "You" ? "you're handling it" : g.items[0].assignee}` : ""}</div>
          <h3>{g.address}<span className="v3-focus-town">{g.town}</span></h3>
        </div>
        {escCount > 1 && URGENCY[g.topUrgency].rank === 0 && (
          <button className="v3-focus-step" onClick={stepEscalated}>{Math.max(0, escIndex) + 1} of {escCount} escalated <CaretRight weight="bold" /></button>
        )}
      </div>
      <div className="v3-focus-needs">
        {g.items.map((w, i) => <FocusNeed key={w.id} w={w} role={role} first={i === 0} run={run} />)}
      </div>
    </GlassCard>
  );
}

function FocusNeed({ w, role, first, run }: { w: WorkItem; role: typeof ROLES[RoleKey]; first: boolean; run: (i: WorkItem, a: WorkAction) => void }) {
  const moreRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className={`v3-need ${first ? "first" : ""}`}>
      <div className="v3-need-read">
        <strong>{w.title}</strong>
        <span>{w.fact}</span>
      </div>
      <div className="v3-need-act">
        <GlassButton size="sm" variant={first ? "primary" : "secondary"} onClick={() => run(w, w.primary)}>{w.primary.label}</GlassButton>
        {w.menu.length > 0 && (
          <>
            <button ref={moreRef} className="v3-need-more" aria-haspopup="menu" aria-expanded={open} aria-label="More actions" onClick={() => setOpen((v) => !v)}><CaretDown weight="bold" /></button>
            <Menu open={open} anchorRef={moreRef} onClose={() => setOpen(false)} items={w.menu} onPick={(a) => { setOpen(false); run(w, a); }} />
          </>
        )}
      </div>
    </div>
  );
}

function AllClearFocus() {
  const next = HUB.forecast.find((w) => w.current)?.files[0];
  return (
    <GlassCard material="lens" radius={20} strength="soft" thickness={1.15} className="v3-focus v3-focus--clear">
      <span className="v3-clear-ic"><CheckCircle weight="fill" /></span>
      <h3>You're all clear</h3>
      <p>Nothing needs you right now. Everything in motion is on track.</p>
      {next && <div className="v3-clear-next">Next up: <strong>{next.address}</strong> is set to exchange this week.</div>}
    </GlassCard>
  );
}

function RecentActivity({ fire }: { fire: (m: string) => void }) {
  return (
    <div className="v3-recent">
      <div className="v3-recent-h">Latest on your sales</div>
      <div className="v3-recent-list">
        {HUB.activity.map((a) => (
          <button key={a.id} className="v3-recent-row" onClick={() => fire(`Open ${a.context} activity (simulated)`)}>
            <span className="v3-recent-ic" data-kind={a.kind}>{a.kind === "comm" ? <ArrowUDownLeft weight="bold" /> : <Check weight="bold" />}</span>
            <span className="v3-recent-body"><span className="v3-recent-text">{a.text}</span><span className="v3-recent-ctx">{a.context}</span></span>
            <time>{a.at}</time>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── drawer / modal / banner / empty ────────────────────────────────────── */
function ActionDrawer({ data, onClose, onSend }: { data: { kind: "chase" | "email"; item: WorkItem; label: string }; onClose: () => void; onSend: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLTextAreaElement>(null);
  const isChase = data.kind === "chase";
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,textarea,input,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const preview = isChase
    ? `Dear Sirs,\n\nWe act on ${data.item.address}. We should be grateful for an update on the outstanding enquiries at your earliest convenience.\n\nKind regards`
    : `Hi,\n\nA quick note on ${data.item.address} — we wanted to check in and keep you posted. Do let us know if there's anything you need from us.\n\nBest`;
  return (
    <Portal>
      <div className="v3-scrim" style={{ justifyContent: "flex-end" }} onClick={onClose}>
        <div ref={ref} className="v3-drawer" role="dialog" aria-modal="true" aria-label={`${data.label} — ${data.item.address}`} onClick={(e) => e.stopPropagation()}>
          <div className="v3-drawer-head">
            <div><span className="v3-eyebrow">{isChase ? "Chase" : "Send a note"}</span><strong>{data.item.address}</strong></div>
            <button className="v3-icon-btn" aria-label="Close" onClick={onClose}><X weight="bold" /></button>
          </div>
          <div className="v3-drawer-body">
            <p className="v3-drawer-ctx">{data.item.title} · {data.item.fact}</p>
            <label className="v3-drawer-label">{isChase ? "Message to the solicitor" : "Message to the client"}</label>
            <textarea ref={firstRef} className="v3-textarea" defaultValue={preview} rows={8} />
            <p className="v3-drawer-note">Nothing is sent — this is a prototype preview of the real {isChase ? "chase" : "note"} composer.</p>
          </div>
          <div className="v3-drawer-foot">
            <GlassButton variant="ghost" onClick={onClose}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={() => onSend(`${isChase ? "Chase sent" : "Note sent"} · ${data.item.address} (simulated)`)}><PaperPlaneTilt weight="fill" /> {isChase ? "Send chase" : "Send note"}</GlassButton>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function ConfirmDateModal({ data, onClose, onConfirm }: { data: { item: WorkItem; label: string }; onClose: () => void; onConfirm: (m: string) => void }) {
  const [date, setDate] = useState("");
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [onClose]);
  return (
    <Portal>
      <div className="v3-scrim" onClick={onClose}>
        <div className="v3-modal v3-glass" role="dialog" aria-modal="true" aria-label={`${data.label} — ${data.item.address}`} onClick={(e) => e.stopPropagation()}>
          <div className="v3-modal-head"><span className="v3-eyebrow">{data.label}</span><strong>{data.item.address}</strong></div>
          <p className="v3-modal-ctx">{data.item.fact}. Set the new date, or recalculate the estimate from the file's progress.</p>
          <label className="v3-drawer-label">New date</label>
          <input className="v3-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="v3-modal-foot">
            <button ref={firstRef} className="v3-link" onClick={() => onConfirm(`Recalculated estimate · ${data.item.address} (simulated)`)}>Recalculate instead</button>
            <div className="v3-modal-foot-actions">
              <GlassButton variant="ghost" onClick={onClose}>Cancel</GlassButton>
              <GlassButton variant="primary" disabled={!date} onClick={() => onConfirm(`Date set · ${data.item.address} (simulated)`)}>Set date</GlassButton>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Banner({ tone, title, body, cta, onCta }: { tone: "warn" | "accent"; title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="v3-banner" data-tone={tone}>
      <div><strong>{title}</strong><span>{body}</span></div>
      <GlassButton size="sm" variant="secondary" onClick={onCta}>{cta}</GlassButton>
    </div>
  );
}

function EmptyState({ role, onCta }: { role: RoleKey; onCta: (m: string) => void }) {
  const copy: Record<RoleKey, { h: string; p: string; cta?: string }> = {
    director: { h: "Your pipeline starts with one sale", p: "Add your first sale and we'll start tracking milestones, chasing solicitors and keeping everyone updated.", cta: "Add your first sale" },
    negotiator: { h: "Your pipeline starts with one sale", p: "Add your first sale and we'll start tracking it for you.", cta: "Add your first sale" },
    progressor: { h: "No assigned files yet", p: "Files assigned to you will appear here as your business takes on sales." },
    admin: { h: "No active files on the platform", p: "Confirmed sales across agencies will appear here as they come in." },
    owner: { h: "Add your first client", p: "Add an estate agent you work with, then add their first sale to get going.", cta: "Add your first client" },
  };
  const c = copy[role];
  return (
    <GlassCard material="lens" radius={24} strength="soft" thickness={1.15} className="v3-empty">
      <h2>{c.h}</h2>
      <p>{c.p}</p>
      {c.cta && <div className="v3-empty-cta"><GlassButton variant="primary" onClick={() => onCta(`${c.cta} (simulated)`)}>{c.cta} <ArrowRight weight="bold" /></GlassButton></div>}
      <div className="v3-empty-steps">
        {[["Solicitor replies, no chasing", "Replies land here the moment they arrive."], ["See every file's progress", "Each sale's stage and next step, at a glance."], ["Everyone kept updated", "Buyers and sellers get clear updates automatically."]].map(([t, b]) => (
          <div key={t} className="v3-empty-step"><strong>{t}</strong><span>{b}</span></div>
        ))}
      </div>
    </GlassCard>
  );
}

const CSS = `
.v3-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; }
.v3-scene{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(52% 38% at 8% 4%, rgba(56,225,255,0.06), transparent 70%), radial-gradient(48% 34% at 92% 96%, rgba(255,138,101,0.05), transparent 72%); }
.lg-ds[data-theme="light"] .v3-scene{ background:radial-gradient(40% 28% at 50% -6%, rgba(56,225,255,0.1), transparent 70%), radial-gradient(66% 48% at 5% 3%, rgba(255,188,168,0.18), transparent 72%), radial-gradient(58% 42% at 95% 7%, rgba(196,180,255,0.16), transparent 72%); }

.v3-dev{ position:relative; z-index:3; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 20px; border-bottom:1px solid var(--lg-line-2); flex-wrap:wrap; }
.v3-dev-tag{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--lg-accent-ink); } .v3-dev-tag svg{ width:14px; height:14px; }
.v3-dev-ctl{ display:flex; align-items:center; gap:10px; }
.v3-sel{ font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:6px 10px; cursor:pointer; }
.v3-seg3{ display:inline-flex; background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; overflow:hidden; } .v3-seg3 button{ font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; padding:6px 11px; cursor:pointer; } .v3-seg3 button.on{ background:var(--lg-accent); color:#fff; }
.v3-theme{ width:46px; height:26px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; } .v3-theme-knob{ position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; transition:transform .3s cubic-bezier(.3,1.35,.4,1); } .v3-theme-knob svg{ width:11px; height:11px; color:#33343c; } .v3-theme.on .v3-theme-knob{ transform:translateX(20px); }

.v3-wrap{ position:relative; z-index:2; max-width:1160px; margin:0 auto; padding:26px 24px 120px; }

.v3-banner{ display:flex; align-items:center; gap:14px; padding:13px 17px; border-radius:14px; margin-bottom:12px; border:1px solid var(--lg-line); background:var(--lg-hover); }
.v3-banner[data-tone="warn"]{ border-color:rgba(255,159,10,0.3); background:rgba(255,159,10,0.08); }
.v3-banner > div{ flex:1; } .v3-banner strong{ display:block; font-size:14px; font-weight:650; } .v3-banner span{ font-size:12.5px; color:var(--lg-ink-2); }

/* briefing */
.v3-brief{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin:4px 0 22px; flex-wrap:wrap; }
.v3-brief-text h1{ font-size:clamp(26px,3.3vw,34px); font-weight:800; letter-spacing:-.032em; line-height:1.04; }
.v3-brief-text p{ font-size:15.5px; color:var(--lg-ink-2); margin-top:9px; max-width:720px; line-height:1.4; }
.v3-brief-actions{ display:flex; gap:9px; flex-wrap:wrap; }
.v3-fact{ font:inherit; font-size:inherit; font-weight:650; color:var(--lg-ink); background:none; border:none; padding:0; cursor:pointer; border-bottom:1.5px dotted var(--lg-ink-3); transition:color .15s, border-color .15s; }
.v3-fact:hover{ color:var(--lg-accent-ink); border-color:var(--lg-accent); }
.v3-fact--alert{ color:var(--lg-danger-ink); border-bottom-color:var(--lg-danger-ink); } .v3-fact--alert:hover{ color:var(--lg-danger-ink); border-bottom-style:solid; }

/* book line */
.v3-book{ margin-bottom:20px; }
.v3-book-line{ display:flex; gap:6px; align-items:stretch; }
@media (max-width:560px){ .v3-book-line{ overflow-x:auto; padding-bottom:5px; scrollbar-width:none; } .v3-book-line::-webkit-scrollbar{ display:none; } .v3-seg{ min-width:92px; flex-grow:0 !important; } }
.v3-seg{ position:relative; flex-basis:0; min-width:62px; }
.v3-seg-btn{ width:100%; display:flex; flex-direction:column; gap:3px; align-items:flex-start; text-align:left; padding:13px 14px; border-radius:13px; cursor:pointer; background:var(--lg-fill); border:1px solid var(--lg-line-2); color:var(--lg-ink); transition:transform .25s cubic-bezier(.2,.8,.2,1), border-color .2s, background .2s; }
.v3-seg[data-reached="false"] .v3-seg-btn{ opacity:.5; }
.v3-seg:nth-last-child(2) .v3-seg-btn{ background:linear-gradient(135deg, var(--lg-accent-soft), var(--lg-fill)); }
.v3-seg-btn:hover{ transform:translateY(-3px); border-color:var(--lg-accent); }
.v3-seg-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.v3-seg-n{ font-size:22px; font-weight:800; letter-spacing:-.02em; } .v3-seg-l{ font-size:11.5px; font-weight:600; color:var(--lg-ink-2); white-space:nowrap; }

/* cockpit */
.v3-cockpit{ display:flex; align-items:center; gap:12px; margin-top:12px; padding:2px 2px; flex-wrap:wrap; }
.v3-ck{ font-size:12.5px; color:var(--lg-ink-2); display:inline-flex; align-items:center; gap:5px; } .v3-ck b{ font-size:14px; font-weight:750; color:var(--lg-ink); } .v3-ck i{ font-style:normal; color:var(--lg-ink-3); font-size:11.5px; }
.v3-up{ display:inline-flex; align-items:center; gap:2px; font-size:11.5px; font-weight:700; color:#5ce08a; } .v3-up svg{ width:12px; height:12px; } .lg-ds[data-theme="light"] .v3-up{ color:#1a9c45; }
.v3-ck-div{ width:1px; height:16px; background:var(--lg-line); }
.v3-ck-grow{ flex:1 1 20px; }
.v3-ck-link{ font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:6px 11px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:border-color .2s, color .2s; } .v3-ck-link svg{ width:12px; height:12px; transition:transform .2s; } .v3-ck-link[aria-expanded="true"]{ color:var(--lg-ink); border-color:var(--lg-ink-3); } .v3-ck-link[aria-expanded="true"] svg{ transform:rotate(180deg); } .v3-ck-link:hover{ border-color:var(--lg-ink-3); color:var(--lg-ink); }

/* work region — focus + index as one surface */
.v3-work{ display:grid; grid-template-columns:1.25fr 1fr; gap:0; background:color-mix(in srgb, var(--lg-base) 64%, transparent); border:1px solid var(--lg-line-2); border-radius:22px; overflow:hidden; }
.lg-ds[data-theme="light"] .v3-work{ background:rgba(255,255,255,.4); }
@media (max-width:900px){ .v3-work{ grid-template-columns:1fr; } }
.v3-work-left{ padding:16px; display:flex; flex-direction:column; gap:14px; border-right:1px solid var(--lg-line-2); }
@media (max-width:900px){ .v3-work-left{ border-right:none; border-bottom:1px solid var(--lg-line-2); } }
.v3-work-right{ padding:16px; display:flex; flex-direction:column; min-width:0; }

/* focus pane */
.v3-focus{ padding:20px; animation:v3focus .4s cubic-bezier(.2,.8,.2,1); } .v3-focus > *{ position:relative; z-index:1; }
@keyframes v3focus{ from{ opacity:0; transform:translateY(8px) scale(.99); } to{ opacity:1; transform:none; } }
.v3-focus-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.v3-focus-kicker{ font-size:12px; font-weight:600; color:var(--lg-ink-3); }
.v3-focus-top h3{ font-size:22px; font-weight:780; letter-spacing:-.025em; margin-top:3px; } .v3-focus-town{ font-size:13px; font-weight:500; color:var(--lg-ink-3); margin-left:9px; }
.v3-focus-step{ flex-shrink:0; font:inherit; font-size:11.5px; font-weight:650; color:var(--lg-danger-ink); background:rgba(255,69,58,.12); border:none; border-radius:999px; padding:5px 11px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:background .2s; } .v3-focus-step:hover{ background:rgba(255,69,58,.2); } .v3-focus-step svg{ width:11px; height:11px; }
.v3-focus-needs{ margin-top:16px; display:flex; flex-direction:column; gap:12px; }
.v3-need{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; }
.v3-need.first{ padding-bottom:12px; } .v3-need:not(.first){ padding-top:12px; border-top:1px solid var(--lg-line-2); }
.v3-need-read strong{ display:block; font-size:15px; font-weight:650; letter-spacing:-.01em; } .v3-need-read span{ display:block; font-size:12.5px; color:var(--lg-ink-2); margin-top:3px; }
.v3-need-act{ display:flex; align-items:stretch; flex-shrink:0; }
.v3-need-act .lgbtn{ border-top-right-radius:0; border-bottom-right-radius:0; }
.v3-need-more{ display:grid; place-items:center; width:30px; border:none; cursor:pointer; color:#fff; border-radius:0 8px 8px 0; border-left:1px solid rgba(255,255,255,.28); transition:filter .2s; } .v3-need.first .v3-need-more{ background:var(--lg-accent); } .v3-need:not(.first) .v3-need-more{ background:var(--lg-fill); color:var(--lg-ink-2); border-left:1px solid var(--lg-line); } .v3-need-more:hover{ filter:brightness(1.08); } .v3-need-more svg{ width:13px; height:13px; } .v3-need-more:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }

/* all clear focus */
.v3-focus--clear{ text-align:center; padding:34px 24px; } .v3-clear-ic{ display:inline-flex; } .v3-clear-ic svg{ width:40px; height:40px; color:#5ce08a; } .v3-focus--clear h3{ font-size:20px; font-weight:760; margin-top:10px; } .v3-focus--clear p{ font-size:13.5px; color:var(--lg-ink-2); margin-top:5px; } .v3-clear-next{ margin-top:16px; font-size:12.5px; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line-2); border-radius:11px; padding:10px 13px; } .v3-clear-next strong{ color:var(--lg-ink); }

/* recent activity */
.v3-recent{ flex:1; min-height:0; background:var(--lg-fill); border:1px solid var(--lg-line-2); border-radius:16px; padding:13px 15px; }
.v3-recent-h{ font-size:12px; font-weight:700; color:var(--lg-ink-2); margin-bottom:8px; }
.v3-recent-list{ display:flex; flex-direction:column; }
.v3-recent-row{ display:flex; align-items:center; gap:10px; padding:8px 0; background:none; border:none; border-top:1px solid var(--lg-line-2); cursor:pointer; text-align:left; transition:opacity .15s; } .v3-recent-row:first-child{ border-top:none; } .v3-recent-row:hover{ opacity:.72; }
.v3-recent-ic{ width:26px; height:26px; border-radius:7px; display:grid; place-items:center; background:var(--lg-hover); color:var(--lg-ink-3); flex-shrink:0; } .v3-recent-ic[data-kind="milestone"]{ color:#5ce08a; } .v3-recent-ic[data-kind="comm"]{ color:var(--lg-accent-ink); } .v3-recent-ic svg{ width:13px; height:13px; }
.v3-recent-body{ flex:1; min-width:0; display:flex; flex-direction:column; } .v3-recent-text{ font-size:12.5px; color:var(--lg-ink); } .v3-recent-ctx{ font-size:11px; color:var(--lg-ink-3); } .v3-recent-row time{ font-size:10.5px; color:var(--lg-ink-3); flex-shrink:0; }

/* index */
.v3-index-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
.v3-index-head h2{ font-size:15px; font-weight:750; }
.v3-index{ flex:1; display:flex; flex-direction:column; gap:3px; }
.v3-diary{ display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:12px; background:var(--lg-fill); border:1px solid var(--lg-line-2); margin-bottom:4px; }
.v3-diary-ic{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; background:var(--lg-accent-soft); color:var(--lg-accent-ink); flex-shrink:0; } .v3-diary-ic svg{ width:16px; height:16px; } .v3-diary-ic[data-status="done"]{ background:rgba(48,209,88,.16); color:#5ce08a; }
.v3-diary-body{ flex:1; min-width:0; } .v3-diary-body strong{ display:block; font-size:12.5px; font-weight:650; } .v3-diary-body span{ font-size:11px; color:var(--lg-ink-3); }
.v3-diary-tag{ font-size:10.5px; font-weight:650; color:var(--lg-ink-3); padding:4px 9px; border-radius:999px; background:var(--lg-hover); } .v3-diary-tag.done{ color:#5ce08a; }
.v3-index-sep{ height:1px; background:var(--lg-line-2); margin:8px 2px; }
.v3-ir{ display:flex; align-items:center; gap:10px; padding:10px 11px; border-radius:11px; background:none; border:1px solid transparent; cursor:pointer; text-align:left; transition:background .15s, border-color .15s; width:100%; }
.v3-ir:hover{ background:var(--lg-hover); } .v3-ir:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }
.v3-ir[data-selected]{ background:var(--lg-fill); border-color:var(--lg-line); }
.v3-ir-dot{ width:7px; height:7px; border-radius:50%; flex-shrink:0; } .v3-ir-dot[data-tone="danger"]{ background:var(--lg-danger); } .v3-ir-dot[data-tone="warn"]{ background:var(--lg-warn); } .v3-ir-dot--none{ background:var(--lg-line); }
.v3-ir-body{ flex:1; min-width:0; display:flex; flex-direction:column; } .v3-ir-addr{ font-size:13.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .v3-ir-note{ font-size:11.5px; color:var(--lg-ink-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.v3-ir-caret{ width:13px; height:13px; color:var(--lg-ink-3); flex-shrink:0; opacity:0; transition:opacity .15s; } .v3-ir:hover .v3-ir-caret, .v3-ir[data-selected] .v3-ir-caret{ opacity:1; }
.v3-index-clear{ font-size:13px; color:var(--lg-ink-2); padding:8px 2px; line-height:1.5; }
.v3-index-foot{ margin-top:12px; font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-accent-ink); background:none; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; align-self:flex-start; } .v3-index-foot svg{ width:13px; height:13px; }

/* scope control */
.v3-scope{ position:relative; display:inline-grid; grid-auto-flow:column; grid-auto-columns:1fr; padding:3px; border-radius:10px; background:rgba(0,0,0,.22); border:1px solid var(--lg-line); } .lg-ds[data-theme="light"] .v3-scope{ background:rgba(12,16,28,.05); }
.v3-scope-thumb{ position:absolute; top:3px; bottom:3px; border-radius:7px; background:var(--lg-fill); box-shadow:inset 0 1px 0 rgba(255,255,255,.4), 0 1px 3px rgba(20,30,60,.18); transition:transform .3s cubic-bezier(.3,1.35,.4,1), width .3s cubic-bezier(.3,1.35,.4,1); } .lg-ds[data-theme="light"] .v3-scope-thumb{ background:#fff; }
.v3-scope-btn{ position:relative; z-index:1; padding:5px 11px; font:inherit; font-size:11.5px; font-weight:550; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; transition:color .3s; white-space:nowrap; } .v3-scope-btn[data-on="true"]{ color:var(--lg-ink); } .v3-scope-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:1px; border-radius:6px; }

/* portalled overlays — frosted glass (blur, no displacement filter → never smears
   the content behind, unlike the slab lens which is reserved for the in-flow focus
   pane). Legible on any GPU. */
.v3-glass{ position:relative; border:1px solid var(--lg-line); background:color-mix(in srgb, var(--lg-base) 92%, transparent); -webkit-backdrop-filter:blur(18px) saturate(165%); backdrop-filter:blur(18px) saturate(165%); box-shadow:0 16px 40px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.16); animation:v3rise .16s ease; }
.lg-ds[data-theme="light"] .v3-glass{ background:color-mix(in srgb, #fff 92%, transparent); box-shadow:0 16px 36px rgba(20,30,60,.2), inset 0 1px 0 rgba(255,255,255,.8); }
@keyframes v3rise{ from{ opacity:0; transform:translateY(-5px) scale(.985); } to{ opacity:1; transform:none; } }
.v3-pop{ border-radius:16px; padding:12px 13px; min-width:200px; max-width:360px; } .v3-pop > *{ position:relative; z-index:1; }
.v3-pop--tip{ padding:10px 12px; border-radius:13px; }
.v3-menu{ min-width:204px; padding:6px; border-radius:14px; }
.v3-menu-item{ display:block; width:100%; text-align:left; font:inherit; font-size:13.5px; font-weight:500; color:var(--lg-ink); background:none; border:none; padding:9px 11px; border-radius:9px; cursor:pointer; transition:background .15s; }
.v3-menu-item:hover{ background:var(--lg-hover); } .v3-menu-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; } .v3-menu-item.danger{ color:var(--lg-danger-ink); }
.v3-pop-h{ font-size:11.5px; font-weight:700; color:var(--lg-ink); margin-bottom:8px; }
.v3-pop-row{ display:flex; justify-content:space-between; gap:12px; font-size:12px; color:var(--lg-ink-2); padding:3px 0; } .v3-pop-row b{ color:var(--lg-ink); }
.v3-pop-more{ font-size:11px; color:var(--lg-ink-3); margin-top:5px; }
.v3-pop-note{ font-size:11px; color:var(--lg-ink-3); margin-top:9px; line-height:1.4; }

/* forecast body */
.v3-fc{ display:flex; align-items:flex-end; gap:6px; height:72px; margin-bottom:10px; }
.v3-fc-col{ flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; justify-content:flex-end; background:none; border:none; cursor:pointer; padding:0; }
.v3-fc-bar{ width:100%; border-radius:6px 6px 3px 3px; background:var(--lg-fill); display:grid; place-items:center; transition:background .2s, filter .2s; } .v3-fc-col.cur .v3-fc-bar{ background:var(--lg-accent); } .v3-fc-col.hi .v3-fc-bar{ filter:brightness(1.15); outline:2px solid var(--lg-accent); outline-offset:1px; } .v3-fc-col:not(.cur).hi .v3-fc-bar{ background:var(--lg-accent-soft); }
.v3-fc-bar b{ font-size:11px; font-weight:750; color:var(--lg-ink-2); } .v3-fc-col.cur .v3-fc-bar b{ color:#fff; } .v3-fc-l{ font-size:9.5px; color:var(--lg-ink-3); }
.v3-fc-detail{ border-top:1px solid var(--lg-line-2); padding-top:9px; } .v3-fc-detail-h{ font-size:11px; font-weight:700; color:var(--lg-ink); margin-bottom:6px; }

/* performance body */
.v3-perf-big{ display:flex; align-items:center; gap:10px; margin-bottom:12px; } .v3-perf-big strong{ font-size:30px; font-weight:820; letter-spacing:-.03em; } .v3-perf-big span{ font-size:11.5px; color:var(--lg-ink-2); display:flex; flex-direction:column; } .v3-perf-big i{ font-style:normal; }
.v3-spark{ height:30px; width:80px; } .v3-spark.big{ flex:1; height:36px; width:auto; }
.v3-perf-slas{ display:flex; gap:16px; font-size:11.5px; color:var(--lg-ink-2); padding:10px 0; border-top:1px solid var(--lg-line-2); } .v3-perf-slas b{ color:var(--lg-ink); }
.v3-perf-wins{ border-top:1px solid var(--lg-line-2); padding-top:10px; }
.v3-wins-h{ font-size:11px; font-weight:700; color:var(--lg-ink-2); margin-bottom:6px; }
.v3-wins-slide, .v3-wins-row{ display:flex; align-items:baseline; gap:7px; min-height:30px; } .v3-wins-slide{ animation:v3fade .4s; } @keyframes v3fade{ from{ opacity:0; transform:translateY(4px);} to{ opacity:1; transform:none; } }
.v3-wins-slide strong, .v3-wins-row strong{ font-size:24px; font-weight:820; letter-spacing:-.02em; } .v3-wins-slide span, .v3-wins-row span{ font-size:11.5px; color:var(--lg-ink-2); }
.v3-wins-dots{ display:flex; gap:5px; margin-top:8px; align-items:center; } .v3-dot{ width:6px; height:6px; border-radius:999px; background:var(--lg-line); border:none; padding:0; cursor:pointer; transition:background .25s, width .25s; } .v3-dot.on{ background:var(--lg-accent); width:16px; }

/* service / clients body */
.v3-split-bar{ height:10px; border-radius:999px; background:#30c8a0; overflow:hidden; } .v3-split-bar > span{ display:block; height:100%; background:var(--lg-accent); } .v3-split-legend{ display:flex; gap:14px; margin-top:9px; font-size:11.5px; color:var(--lg-ink-2); flex-wrap:wrap; } .v3-split-legend i{ display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:5px; } .v3-split-legend i.a{ background:var(--lg-accent); } .v3-split-legend i.b{ background:#30c8a0; }
.v3-clients{ width:100%; border-collapse:collapse; } .v3-clients td{ padding:7px 5px; font-size:12px; border-bottom:1px solid var(--lg-line-2); } .v3-clients tr:last-child td{ border-bottom:none; } .v3-clients td:first-child{ font-weight:600; } .v3-clients td:not(:first-child){ color:var(--lg-ink-2); }
.v3-link{ font:inherit; font-size:inherit; font-weight:600; color:var(--lg-accent-ink); background:none; border:none; padding:0; cursor:pointer; }

/* drawer + modal (portalled) */
.v3-scrim{ position:fixed; inset:0; z-index:1650; background:rgba(0,0,0,.44); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; padding:0; animation:v3fadein .22s; } @keyframes v3fadein{ from{ opacity:0; } to{ opacity:1; } }
.v3-drawer{ width:min(440px,100%); height:100%; background:var(--lg-base); border-left:1px solid var(--lg-line); display:flex; flex-direction:column; animation:v3slide .4s cubic-bezier(.2,.8,.2,1); box-shadow:-20px 0 60px rgba(0,0,0,.3); }
@keyframes v3slide{ from{ transform:translateX(100%); } to{ transform:none; } }
.v3-drawer-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 20px; border-bottom:1px solid var(--lg-line-2); } .v3-eyebrow{ display:block; font-size:10.5px; font-weight:700; letter-spacing:.04em; color:var(--lg-accent-ink); margin-bottom:3px; } .v3-drawer-head strong{ font-size:16px; font-weight:700; }
.v3-icon-btn{ width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; transition:background .2s, color .2s; } .v3-icon-btn:hover{ background:var(--lg-hover); color:var(--lg-ink); } .v3-icon-btn svg{ width:15px; height:15px; } .v3-icon-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.v3-drawer-body{ flex:1; overflow:auto; padding:20px; } .v3-drawer-ctx{ font-size:12.5px; color:var(--lg-ink-2); margin-bottom:16px; }
.v3-drawer-label{ display:block; font-size:11.5px; font-weight:650; color:var(--lg-ink-2); margin-bottom:7px; }
.v3-textarea, .v3-input{ width:100%; background:var(--lg-field); border:1px solid var(--lg-line); border-radius:11px; padding:11px 13px; color:var(--lg-ink); font:inherit; font-size:13.5px; line-height:1.5; resize:vertical; transition:border-color .2s; } .v3-textarea:focus, .v3-input:focus{ outline:none; border-color:var(--lg-accent); }
.v3-drawer-note{ font-size:11px; color:var(--lg-ink-3); margin-top:10px; }
.v3-drawer-foot{ display:flex; justify-content:flex-end; gap:9px; padding:16px 20px; border-top:1px solid var(--lg-line-2); }
.v3-modal{ width:min(430px,100%); padding:24px; border-radius:20px; } .v3-modal > *{ position:relative; z-index:1; }
.v3-modal-head strong{ display:block; font-size:17px; font-weight:750; } .v3-modal-ctx{ font-size:13px; color:var(--lg-ink-2); margin:12px 0 16px; line-height:1.5; }
.v3-modal-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; flex-wrap:wrap; } .v3-modal-foot-actions{ display:flex; gap:9px; }

/* toast */
.v3-toast{ display:inline-flex; align-items:center; gap:9px; padding:11px 17px; border-radius:13px; font-size:13px; font-weight:550; } .v3-toast svg{ width:14px; height:14px; color:#5ce08a; }

/* empty */
.v3-empty{ padding:40px 32px; text-align:center; } .v3-empty > *{ position:relative; z-index:1; }
.v3-empty h2{ font-size:26px; font-weight:780; letter-spacing:-.025em; margin-bottom:10px; } .v3-empty > p{ font-size:14.5px; color:var(--lg-ink-2); max-width:440px; margin:0 auto; line-height:1.5; }
.v3-empty-cta{ margin-top:20px; }
.v3-empty-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin-top:30px; border-top:1px solid var(--lg-line-2); padding-top:6px; text-align:left; }
.v3-empty-step{ padding:18px 18px 6px; } .v3-empty-step + .v3-empty-step{ border-left:1px solid var(--lg-line-2); } .v3-empty-step strong{ display:block; font-size:13.5px; font-weight:650; margin-bottom:5px; } .v3-empty-step span{ font-size:12.5px; color:var(--lg-ink-2); line-height:1.45; }
@media (max-width:720px){ .v3-empty-steps{ grid-template-columns:1fr; } .v3-empty-step + .v3-empty-step{ border-left:none; border-top:1px solid var(--lg-line-2); } }

.v3-layer{ font-family:inherit; }
@media (prefers-reduced-motion: reduce){ .v3-root *, .v3-layer *{ animation:none !important; transition:none !important; } }
`;
