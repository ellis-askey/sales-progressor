"use client";
// /dev/hub-glass-v2 — Hub redesign prototype (A+C hybrid). Dev-only (blocks in
// production). Presentation-only. Mock/read-only data (./mock). Every action is
// SIMULATED (drawer/modal/toast; no writes, emails or chases). The production Hub,
// its logic, permissions and queries are untouched. Dev controls are prototype-only.
//
// The rethink vs /dev/hub-glass:
//  · The pipeline is the HERO — a single flowing line of the whole book, not a grid
//    of stat cards. Hovering a stage reveals the sales behind the number.
//  · "Needs you" groups by PROPERTY. Escalated properties lead ("Start here") because
//    they are escalated in the data — not a new ranking. A lens reslices the same
//    items by property / type / urgency so individual tasks + categories are never lost.
//  · Glass is selective (slab lens on the hero line, focal cards, popovers, menus,
//    drawers). Dense panels are solid so numbers stay crisp.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, Sparkle, Bell, Warning, CalendarBlank, CurrencyGbp, EnvelopeSimple,
  ClipboardText, ChatCircle, MoonStars as Moon, ArrowRight, Plus, NotePencil, PaperPlaneTilt,
  Check, CaretDown, TrendUp, CheckCircle, X,
} from "@phosphor-icons/react";
import { GlassCard, GlassButton } from "@/components/liquid";
import {
  HUB, ROLES, CLIENTS, CATEGORY_META, URGENCY_META, groupByProperty,
  type RoleKey, type WorkCategory, type Urgency, type WorkItem, type WorkAction, type PropertyGroup,
} from "./mock";

type Theme = "dark" | "light";
const CAT_ICON: Record<WorkCategory, typeof Bell> = {
  reminder: Bell, at_risk: Warning, booking: CalendarBlank, mortgage: CurrencyGbp,
  filing: EnvelopeSimple, review: ClipboardText, quiet: Moon, enquiry: ChatCircle, exchange_passed: Warning,
};
const URGENCY_ORDER: Urgency[] = ["escalated", "overdue", "today", "week"];
type Lens = "property" | "type" | "urgency";

function usePrefersReducedMotion() {
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

export default function HubGlassV2() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [roleKey, setRoleKey] = useState<RoleKey>("director");
  const [populated, setPopulated] = useState(true);
  const [lens, setLens] = useState<Lens>("property");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ kind: "chase" | "email"; item: WorkItem; label: string } | null>(null);
  const [modal, setModal] = useState<{ item: WorkItem; label: string } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = usePrefersReducedMotion();
  const role = ROLES[roleKey];

  const fire = useCallback((m: string) => {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 2500);
    setMenuOpen(null);
  }, []);

  // route an inline action to the way the real Hub surfaces it: a drawer (chase /
  // email), a modal (confirm a date), a nav, or a plain simulated write (toast).
  const run = useCallback((item: WorkItem, a: WorkAction) => {
    setMenuOpen(null);
    if (a.kind === "chase") setDrawer({ kind: "chase", item, label: a.label });
    else if (a.kind === "email") setDrawer({ kind: "email", item, label: a.label });
    else if (a.kind === "confirm_date") setModal({ item, label: a.label });
    else fire(`${a.label} · ${item.address} (simulated)`);
  }, [fire]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(null); } };
    const onClick = () => setMenuOpen(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, []);

  const groups = useMemo(() => groupByProperty(HUB.work), []);
  const escalatedGroups = groups.filter((g) => g.topUrgency === "escalated");
  const restGroups = groups.filter((g) => g.topUrgency !== "escalated");
  const totalNeeds = HUB.work.length;
  const escalated = HUB.work.filter((w) => w.urgency === "escalated").length;
  const overdue = HUB.work.filter((w) => w.urgency === "overdue").length;

  // the overview (pipeline line + figures) leads for oversight/own roles; the
  // execution role (progressor) leads with the work their files need.
  const workFirst = role.emphasis === "execution";

  const overviewBlock = (
    <Overview role={role} roleKey={roleKey} reduced={reduced} fire={fire} />
  );
  const needsBlock = (
    <NeedsYou
      role={role} lens={lens} setLens={setLens}
      escalatedGroups={escalatedGroups} restGroups={restGroups}
      totalNeeds={totalNeeds} escalated={escalated} overdue={overdue}
      menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} fire={fire}
    />
  );

  return (
    <div className="lg-ds h2-root" data-theme={theme} data-reduced={reduced || undefined}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="h2-scene" aria-hidden />

      {/* prototype dev controls */}
      <div className="h2-dev">
        <span className="h2-dev-tag"><Sparkle weight="fill" /> Hub prototype v2 · actions simulated</span>
        <div className="h2-dev-ctl">
          <select className="h2-sel" value={roleKey} aria-label="Role" onChange={(e) => setRoleKey(e.target.value as RoleKey)}>
            {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <div className="h2-seg2">
            <button className={populated ? "on" : ""} onClick={() => setPopulated(true)}>Populated</button>
            <button className={!populated ? "on" : ""} onClick={() => setPopulated(false)}>Empty</button>
          </div>
          <button className={`h2-theme ${theme === "light" ? "on" : ""}`} aria-label="Theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="h2-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </div>
      </div>

      <main className="h2-wrap">
        {role.banners.includes("card") && <Banner tone="warn" title="Add a payment card to keep adding sales" body="£5 per sale · £59 subscription · £39 per extra team member." cta="Add a card" onCta={() => fire("Open billing (simulated)")} />}
        {role.banners.includes("email") && <Banner tone="accent" title="Send emails from your own address" body="Verify your sender so clients see your agency, not ours." cta="Set up" onCta={() => fire("Email setup (simulated)")} />}

        <Header role={role} populated={populated} reduced={reduced} fire={fire} />

        {!populated ? (
          <EmptyState role={roleKey} reduced={reduced} onCta={fire} />
        ) : workFirst ? (
          <>
            <Reveal order={0}>{needsBlock}</Reveal>
            <Reveal order={1}>{overviewBlock}</Reveal>
          </>
        ) : (
          <>
            <Reveal order={0}>{overviewBlock}</Reveal>
            <Reveal order={1}>{needsBlock}</Reveal>
          </>
        )}
      </main>

      {drawer && <ActionDrawer data={drawer} onClose={() => setDrawer(null)} onSend={(m) => { setDrawer(null); fire(m); }} reduced={reduced} />}
      {modal && <ConfirmDateModal data={modal} onClose={() => setModal(null)} onConfirm={(m) => { setModal(null); fire(m); }} />}

      {toast && (
        <GlassCard material="lens" radius={13} strength="strong" thickness={1.4} className="h2-toast">
          <Check weight="bold" /><span>{toast}</span>
        </GlassCard>
      )}
    </div>
  );
}

/* ── Entrance cascade (SectionReveal equivalent) ───────────────────────────── */
function Reveal({ order = 0, children }: { order?: number; children: ReactNode }) {
  return <div className="h2-reveal" style={{ animationDelay: `${order * 90}ms` }}>{children}</div>;
}

/* ── Typewriter (TypedText equivalent) ─────────────────────────────────────── */
function Typed({ text, reduced }: { text: string; reduced: boolean }) {
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, [text, reduced]);
  return <span>{text.slice(0, n)}<span className="h2-caret" data-done={n >= text.length || undefined} /></span>;
}

/* ── Header + pulse ────────────────────────────────────────────────────────── */
function Header({ role, populated, reduced, fire }: { role: typeof ROLES[RoleKey]; populated: boolean; reduced: boolean; fire: (m: string) => void }) {
  const p = HUB.pipeline;
  const pulse = [
    { k: "Active files", v: `${p.activeFiles}`, sub: `+${p.newThisMonth} this month`, to: "Files" },
    { k: "Exchanging soon", v: `${p.exchangingSoon}`, sub: `${HUB.forecast[0].count} this week`, to: "Exchanging" },
    { k: "Needs attention", v: `${p.needsAttention}`, sub: p.escalated ? `${p.escalated} escalated` : "all clear", to: "Attention", tone: "danger" as const },
    { k: "Pipeline value", v: `£${p.pipelineValueM}m`, sub: role.moneyLabel, to: "Value" },
  ];
  return (
    <header className="h2-head">
      <div className="h2-head-top">
        <div className="h2-greet">
          <h1>Good morning, {role.name}</h1>
          <p>{populated ? <Typed text={role.subtitle} reduced={reduced} /> : "Your pipeline starts with one sale."}</p>
        </div>
        <div className="h2-head-actions">
          <GlassButton variant="subtle" onClick={() => fire("New note (simulated)")}><NotePencil weight="regular" /> Note</GlassButton>
          <GlassButton variant="subtle" onClick={() => fire("New email (simulated)")}><PaperPlaneTilt weight="regular" /> Email</GlassButton>
          {role.canCreateSale && <GlassButton variant="primary" onClick={() => fire("Add a sale (simulated)")}><Plus weight="bold" /> Add a sale</GlassButton>}
        </div>
      </div>
      {populated && (
        <div className="h2-pulse">
          {pulse.map((s) => (
            <button key={s.k} className="h2-pulse-cell" onClick={() => fire(`${s.to} (simulated)`)}>
              <span className="h2-pulse-v" data-tone={s.tone}>{s.v}</span>
              <span className="h2-pulse-k">{s.k}</span>
              <span className="h2-pulse-sub">{s.sub}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

/* ── Overview: the pipeline LINE (hero) + performance ──────────────────────── */
function Overview({ role, roleKey, reduced, fire }: { role: typeof ROLES[RoleKey]; roleKey: RoleKey; reduced: boolean; fire: (m: string) => void }) {
  const p = HUB.pipeline;
  const total = p.stages.reduce((s, st) => s + st.count, 0);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="h2-ov">
      {/* the whole book as one flowing line; hover a stage to see the sales behind it */}
      <GlassCard material="lens" radius={20} strength="soft" thickness={1.1} className="h2-line-card">
        <div className="h2-line-head">
          <h2>The book</h2>
          <span className="h2-line-sub">{p.activeFiles} active sales, left to right by stage</span>
        </div>
        <div className="h2-line" role="list">
          {p.stages.map((st, i) => {
            const pct = Math.max(7, (st.count / total) * 100);
            const reached = i < 5;
            return (
              <div
                key={st.key} role="listitem"
                className="h2-seg" data-reached={reached} data-last={i >= 4 || undefined}
                style={{ flexGrow: pct }}
                onMouseEnter={() => setHover(st.key)} onMouseLeave={() => setHover((h) => (h === st.key ? null : h))}
              >
                <button className="h2-seg-btn" onFocus={() => setHover(st.key)} onBlur={() => setHover((h) => (h === st.key ? null : h))} onClick={() => fire(`Filter to ${st.label} (simulated)`)}>
                  <span className="h2-seg-n">{st.count}</span>
                  <span className="h2-seg-l">{st.label}</span>
                </button>
                {hover === st.key && (
                  <GlassCard material="lens" radius={14} strength="strong" thickness={1.4} className="h2-pop" role="tooltip">
                    <div className="h2-pop-h">{st.label} · {st.count}</div>
                    {st.files.slice(0, 6).map((f) => <div key={f} className="h2-pop-row">{f}</div>)}
                    {st.files.length > 6 && <div className="h2-pop-more">+{st.files.length - 6} more</div>}
                  </GlassCard>
                )}
              </div>
            );
          })}
        </div>

        {/* performance — visible + scannable, a thin strip, not its own card wall */}
        <div className="h2-perf">
          <div className="h2-perf-main">
            <span className="h2-perf-k">Exchanges · last 30 days</span>
            <span className="h2-perf-v">{p.exchLast30}<span className="h2-perf-up"><TrendUp weight="bold" /> {p.momentumPct}%</span></span>
          </div>
          <Spark data={p.spark} />
          <div className="h2-perf-slas">
            <span><b>{p.medianDays}d</b> median to exchange</span>
            <span><b>{p.within12Pct}%</b> within 12 weeks</span>
          </div>
        </div>
      </GlassCard>

      {/* quiet overview band: wins (carousel) · forecast (hover popovers) · activity · role panel */}
      <div className="h2-band">
        <WinsCarousel reduced={reduced} />
        <ForecastPanel />
        {role.emphasis !== "execution" && <RolePanel role={role} roleKey={roleKey} fire={fire} />}
        <ActivityPanel fire={fire} />
      </div>
    </section>
  );
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(" ");
  return (
    <svg className="h2-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--lg-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Wins carousel (restores the real Hub's auto-rotating, swipeable, pausable
      carousel; reduced-motion shows it static) ──────────────────────────────── */
function WinsCarousel({ reduced }: { reduced: boolean }) {
  const slides = [
    { v: `${HUB.wins.exchanges}`, k: "Exchanges this month" },
    { v: `${HUB.wins.completions}`, k: "Completions this month" },
    { v: `${HUB.wins.fastestDays}d`, k: "Fastest to exchange" },
    { v: `£${HUB.wins.biggestFeeK}k`, k: "Biggest fee" },
    { v: `${HUB.wins.newBusiness}`, k: "New sales won" },
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    if (reduced || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000); // matches the real Wins card (ROTATE_MS)
    return () => clearInterval(t);
  }, [reduced, paused, slides.length]);
  const go = (d: number) => setI((x) => (x + d + slides.length) % slides.length);
  return (
    <div
      className="h2-panel h2-wins"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}
    >
      <div className="h2-panel-h">Wins this month</div>
      {reduced ? (
        <div className="h2-wins-grid">
          {slides.map((s) => <div key={s.k} className="h2-wins-mini"><strong>{s.v}</strong><span>{s.k}</span></div>)}
        </div>
      ) : (
        <>
          <div className="h2-wins-stage" aria-live="polite">
            <div key={i} className="h2-wins-slide"><strong>{slides[i].v}</strong><span>{slides[i].k}</span></div>
          </div>
          <div className="h2-wins-dots">
            {slides.map((s, x) => <button key={s.k} className={`h2-dot ${x === i ? "on" : ""}`} aria-label={`Win ${x + 1}`} onClick={() => setI(x)} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Forecast (restores week-cell hover popovers → the files exchanging then) ── */
function ForecastPanel() {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...HUB.forecast.map((x) => x.count));
  return (
    <div className="h2-panel h2-fc-panel">
      <div className="h2-panel-h">Exchange forecast</div>
      <div className="h2-fc">
        {HUB.forecast.map((w) => (
          <div
            key={w.label} className={`h2-fc-col ${w.current ? "cur" : ""}`}
            onMouseEnter={() => setHover(w.label)} onMouseLeave={() => setHover((h) => (h === w.label ? null : h))}
          >
            <button className="h2-fc-btn" onFocus={() => setHover(w.label)} onBlur={() => setHover((h) => (h === w.label ? null : h))} aria-label={`${w.label}: ${w.count} exchanges, £${w.feesK}k`}>
              <span className="h2-fc-bar" style={{ height: `${20 + (w.count / max) * 54}px` }}><b>{w.count}</b></span>
              <span className="h2-fc-l">{w.label}</span>
              <span className="h2-fc-f">£{w.feesK}k</span>
            </button>
            {hover === w.label && (
              <GlassCard material="lens" radius={13} strength="strong" thickness={1.4} className="h2-pop h2-pop-up" role="tooltip">
                <div className="h2-pop-h">{w.label} · £{w.feesK}k</div>
                {w.files.slice(0, 3).map((f) => <div key={f.address} className="h2-pop-row"><span>{f.address}</span><b>£{f.feeK}k</b></div>)}
                {w.files.length > 3 && <div className="h2-pop-more">+{w.files.length - 3} more</div>}
              </GlassCard>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RolePanel({ role, roleKey, fire }: { role: typeof ROLES[RoleKey]; roleKey: RoleKey; fire: (m: string) => void }) {
  if (role.lowerPanel === "clients") {
    return (
      <div className="h2-panel">
        <div className="h2-panel-h">Your clients</div>
        <table className="h2-clients"><tbody>
          {CLIENTS.map((c) => (
            <tr key={c.name}><td>{c.name}</td><td>{c.active} active</td><td>£{c.pipelineM}m</td><td>{c.feeUnset ? <button className="h2-link" onClick={() => fire("Set fee (simulated)")}>Set fee</button> : `£${c.feeK}k`}</td></tr>
          ))}
        </tbody></table>
      </div>
    );
  }
  if (role.lowerPanel === "service") {
    return (
      <div className="h2-panel">
        <div className="h2-panel-h">Who's managing</div>
        <div className="h2-split-bar"><span style={{ width: "62%" }} /></div>
        <div className="h2-split-legend"><span><i className="a" /> Self-managed 62%</span><span><i className="b" /> Outsourced 38%</span></div>
        {roleKey === "admin" && <p className="h2-split-note">Top: Harpers Estates, Weston & Co, Bridge Property</p>}
      </div>
    );
  }
  return null;
}

function ActivityPanel({ fire }: { fire: (m: string) => void }) {
  return (
    <div className="h2-panel">
      <div className="h2-panel-h">Recent activity</div>
      <div className="h2-acts">
        {HUB.activity.map((a) => (
          <button key={a.id} className="h2-act" onClick={() => fire(`Open activity · ${a.context} (simulated)`)}>
            <span className="h2-act-ic" data-kind={a.kind}>{a.kind === "comm" ? <ChatCircle weight="fill" /> : <Check weight="bold" />}</span>
            <div><strong>{a.description}</strong><span>{a.context}</span></div>
            <time>{a.at}</time>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Needs you: diary + escalated "start here" + property situations + lens ──── */
function NeedsYou({
  role, lens, setLens, escalatedGroups, restGroups, totalNeeds, escalated, overdue, menuOpen, setMenuOpen, run, fire,
}: {
  role: typeof ROLES[RoleKey]; lens: Lens; setLens: (l: Lens) => void;
  escalatedGroups: PropertyGroup[]; restGroups: PropertyGroup[];
  totalNeeds: number; escalated: number; overdue: number;
  menuOpen: string | null; setMenuOpen: (v: string | null) => void;
  run: (i: WorkItem, a: WorkAction) => void; fire: (m: string) => void;
}) {
  const allGroups = [...escalatedGroups, ...restGroups];
  return (
    <section className="h2-needs">
      <div className="h2-needs-head">
        <div>
          <h2>Needs you</h2>
          <p>{totalNeeds} across your sales{escalated ? ` · ${escalated} escalated` : ""}{overdue ? ` · ${overdue} overdue` : ""}</p>
        </div>
        <div className="h2-needs-tools">
          <Lenses lens={lens} setLens={setLens} />
          <button className="h2-link" onClick={() => fire("Open work queue (simulated)")}>Work queue <ArrowRight weight="bold" /></button>
        </div>
      </div>

      {/* today's time-critical diary events — distinct from work */}
      {HUB.diary.length > 0 && (
        <div className="h2-diary">
          {HUB.diary.map((d) => (
            <div key={d.id} className="h2-diary-ev" data-status={d.status}>
              <span className="h2-diary-ic">{d.type === "exchange" ? <CheckCircle weight="fill" /> : <CalendarBlank weight="fill" />}</span>
              <div><strong>{d.type === "exchange" ? "Exchange" : "Completion"} today</strong><span>{d.address}</span></div>
              {d.status === "ready" ? <GlassButton size="sm" variant="primary" onClick={() => fire(`Confirm ${d.type} · ${d.address} (simulated)`)}>Confirm</GlassButton>
                : d.status === "not_ready" ? <span className="h2-diary-tag">Not ready</span>
                  : <span className="h2-diary-tag done">Done</span>}
            </div>
          ))}
        </div>
      )}

      {lens === "property" ? (
        <>
          {escalatedGroups.length > 0 && (
            <div className="h2-start">
              <div className="h2-start-label"><span className="h2-tier-dot" data-tone="danger" />Start here · escalated</div>
              <div className="h2-group-list">
                {escalatedGroups.map((g) => <Situation key={g.propertyId} g={g} role={role} focal menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />)}
              </div>
            </div>
          )}
          {restGroups.length > 0 && (
            <div className="h2-group-list">
              {restGroups.map((g) => <Situation key={g.propertyId} g={g} role={role} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />)}
            </div>
          )}
        </>
      ) : lens === "urgency" ? (
        <div className="h2-flat">
          {URGENCY_ORDER.map((u) => {
            const items = HUB.work.filter((w) => w.urgency === u);
            if (!items.length) return null;
            return (
              <div key={u} className="h2-tier">
                <div className="h2-tier-head"><span className="h2-tier-dot" data-tone={URGENCY_META[u].tone} />{URGENCY_META[u].label}<span className="h2-tier-n">{items.length}</span></div>
                {items.map((w) => <WorkRow key={w.id} w={w} role={role} showUrg={false} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h2-flat">
          {(Object.keys(CATEGORY_META) as WorkCategory[]).map((c) => {
            const items = HUB.work.filter((w) => w.category === c);
            if (!items.length) return null;
            return (
              <div key={c} className="h2-tier">
                <div className="h2-tier-head"><span className="h2-tier-dot" data-tone={CATEGORY_META[c].tone} />{CATEGORY_META[c].label}<span className="h2-tier-n">{items.length}</span></div>
                {items.map((w) => <WorkRow key={w.id} w={w} role={role} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* once nothing is left (not reachable with this mock, but the state is real) */}
      {allGroups.length === 0 && (
        <div className="h2-clear"><CheckCircle weight="fill" /><strong>You're all clear</strong><span>Nothing needs you right now. We'll surface the next thing the moment it lands.</span></div>
      )}
    </section>
  );
}

function Lenses({ lens, setLens }: { lens: Lens; setLens: (l: Lens) => void }) {
  const opts: { v: Lens; l: string }[] = [{ v: "property", l: "By property" }, { v: "type", l: "By type" }, { v: "urgency", l: "By urgency" }];
  const idx = opts.findIndex((o) => o.v === lens);
  return (
    <div className="h2-lens" role="tablist" aria-label="Group work by">
      <span className="h2-lens-thumb" style={{ width: `calc((100% - 6px) / ${opts.length})`, transform: `translateX(calc(${idx} * 100%))` }} />
      {opts.map((o) => (
        <button key={o.v} role="tab" aria-selected={lens === o.v} className="h2-lens-btn" data-on={lens === o.v} onClick={() => setLens(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

/* A property "situation". A property with ONE open need is a single clean row
   (no card chrome). A property with several needs becomes a bracketed group so you
   see — and can clear — the whole property's pile in one place. This is a grouped
   list, deliberately not a grid of rectangular cards. */
function Situation({ g, role, focal, menuOpen, setMenuOpen, run }: { g: PropertyGroup; role: typeof ROLES[RoleKey]; focal?: boolean; menuOpen: string | null; setMenuOpen: (v: string | null) => void; run: (i: WorkItem, a: WorkAction) => void }) {
  if (g.items.length === 1) {
    return <WorkRow w={g.items[0]} role={role} focal={focal} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />;
  }
  return (
    <div className={`h2-group ${focal ? "focal" : ""}`} data-tone={CATEGORY_META[g.items[0].category].tone}>
      <div className="h2-group-head">
        <strong>{g.address}</strong><span className="h2-group-town">{g.town}</span>
        <span className="h2-group-count">{g.items.length} things</span>
      </div>
      <div className="h2-group-rows">
        {g.items.map((w) => <NeedLine key={w.id} w={w} role={role} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />)}
      </div>
    </div>
  );
}

/* One need within a situation (property grouping) */
function NeedLine({ w, role, menuOpen, setMenuOpen, run }: { w: WorkItem; role: typeof ROLES[RoleKey]; menuOpen: string | null; setMenuOpen: (v: string | null) => void; run: (i: WorkItem, a: WorkAction) => void }) {
  const Icon = CAT_ICON[w.category];
  const primary = w.actions.find((a) => a.primary) ?? w.actions[0];
  const menu = primary.menu ?? w.actions.filter((a) => a !== primary).map((a) => a.label);
  return (
    <div className="h2-need" data-tone={CATEGORY_META[w.category].tone}>
      <span className="h2-need-ic"><Icon weight="fill" /></span>
      <div className="h2-need-body">
        <div className="h2-need-top">
          <span className="h2-need-cat">{CATEGORY_META[w.category].label}</span>
          <span className="h2-need-urg" data-tone={URGENCY_META[w.urgency].tone}>{URGENCY_META[w.urgency].label}</span>
          {role.showOwner && w.owner && <span className="h2-need-owner">{w.owner}</span>}
        </div>
        <p className="h2-need-need">{w.need}</p>
        {w.meta && <p className="h2-need-meta">{w.meta}</p>}
      </div>
      <RowActions w={w} primary={primary} menu={menu} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />
    </div>
  );
}

/* A flat work row — the single-need property in By-property, and every item in
   By-type / By-urgency (keeps individual tasks + categories accessible). */
function WorkRow({ w, role, focal, showUrg = true, menuOpen, setMenuOpen, run }: { w: WorkItem; role: typeof ROLES[RoleKey]; focal?: boolean; showUrg?: boolean; menuOpen: string | null; setMenuOpen: (v: string | null) => void; run: (i: WorkItem, a: WorkAction) => void }) {
  const Icon = CAT_ICON[w.category];
  const primary = w.actions.find((a) => a.primary) ?? w.actions[0];
  const menu = primary.menu ?? w.actions.filter((a) => a !== primary).map((a) => a.label);
  return (
    <div className="h2-row" data-tone={CATEGORY_META[w.category].tone} data-focal={focal || undefined}>
      <span className="h2-row-ic"><Icon weight="fill" /></span>
      <div className="h2-row-body">
        <div className="h2-row-top"><strong>{w.address}</strong><span className="h2-row-town">{w.town}</span>{showUrg && <span className="h2-need-urg" data-tone={URGENCY_META[w.urgency].tone}>{URGENCY_META[w.urgency].label}</span>}{role.showOwner && w.owner && <span className="h2-row-owner">{w.owner}</span>}</div>
        <p className="h2-row-need">{w.need}</p>
        {w.meta && <p className="h2-row-meta">{w.meta}</p>}
      </div>
      <RowActions w={w} primary={primary} menu={menu} menuOpen={menuOpen} setMenuOpen={setMenuOpen} run={run} />
    </div>
  );
}

/* Split primary action + overflow menu (restores the chevron row-action menu) */
function RowActions({ w, primary, menu, menuOpen, setMenuOpen, run }: { w: WorkItem; primary: WorkAction; menu: string[]; menuOpen: string | null; setMenuOpen: (v: string | null) => void; run: (i: WorkItem, a: WorkAction) => void }) {
  const open = menuOpen === w.id;
  return (
    <div className="h2-act-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="h2-split">
        <GlassButton size="sm" variant={primary.danger ? "danger" : "primary"} onClick={() => run(w, primary)}>{primary.label}</GlassButton>
        {menu.length > 0 && (
          <button className="h2-split-more" aria-haspopup="menu" aria-expanded={open} aria-label="More actions" onClick={() => setMenuOpen(open ? null : w.id)}>
            <CaretDown weight="bold" />
          </button>
        )}
      </div>
      {open && (
        <GlassCard material="lens" radius={12} strength="strong" thickness={1.4} className="h2-menu" role="menu">
          {menu.map((m) => (
            <button key={m} role="menuitem" className="h2-menu-item" onClick={() => run(w, { label: m, kind: m.toLowerCase().includes("chase") ? "chase" : m.toLowerCase().includes("date") || m.toLowerCase().includes("recalc") ? "confirm_date" : "toast" })}>{m}</button>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

/* ── Action drawer (chase / email) — side sheet, focus-trapped, Esc to close ── */
function ActionDrawer({ data, onClose, onSend, reduced }: { data: { kind: "chase" | "email"; item: WorkItem; label: string }; onClose: () => void; onSend: (m: string) => void; reduced: boolean }) {
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
    ? `Dear Sirs,\n\nWe act for the other party on ${data.item.address}. We should be grateful for an update on the outstanding enquiries at your earliest convenience.\n\nKind regards`
    : `Hi,\n\nJust a quick note on ${data.item.address} — we wanted to check in and keep you posted. Do let us know if there's anything you need from us.\n\nBest`;
  return (
    <div className={`h2-drawer-scrim ${reduced ? "noanim" : ""}`} onClick={onClose}>
      <div ref={ref} className="h2-drawer" role="dialog" aria-modal="true" aria-label={`${data.label} — ${data.item.address}`} onClick={(e) => e.stopPropagation()}>
        <div className="h2-drawer-head">
          <div><span className="h2-drawer-eyebrow">{isChase ? "Chase" : "Send a note"}</span><strong>{data.item.address}</strong></div>
          <button className="h2-icon-btn" aria-label="Close" onClick={onClose}><X weight="bold" /></button>
        </div>
        <div className="h2-drawer-body">
          <p className="h2-drawer-ctx">{data.item.need}{data.item.meta ? ` · ${data.item.meta}` : ""}</p>
          <label className="h2-drawer-label">{isChase ? "Message to the solicitor" : "Message to the client"}</label>
          <textarea ref={firstRef} className="h2-textarea" defaultValue={preview} rows={8} />
          <p className="h2-drawer-note">Nothing is sent — this is a prototype preview of the real {isChase ? "chase" : "note"} composer.</p>
        </div>
        <div className="h2-drawer-foot">
          <GlassButton variant="ghost" onClick={onClose}>Cancel</GlassButton>
          <GlassButton variant="primary" onClick={() => onSend(`${isChase ? "Chase sent" : "Note sent"} · ${data.item.address} (simulated)`)}><PaperPlaneTilt weight="fill" /> {isChase ? "Send chase" : "Send note"}</GlassButton>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm-date modal (centred dialog) ──────────────────────────────────── */
function ConfirmDateModal({ data, onClose, onConfirm }: { data: { item: WorkItem; label: string }; onClose: () => void; onConfirm: (m: string) => void }) {
  const [date, setDate] = useState("");
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="lg-ds-overlay" onClick={onClose}>
      <GlassCard material="lens" radius={20} strength="strong" thickness={1.5} className="h2-modal" role="dialog" aria-modal="true" aria-label={`Exchange date — ${data.item.address}`} onClick={(e) => e.stopPropagation()}>
        <div className="h2-modal-head"><span className="h2-drawer-eyebrow">Exchange date passed</span><strong>{data.item.address}</strong></div>
        <p className="h2-modal-ctx">{data.item.meta}. Set the new expected exchange date, or recalculate the estimate from the file's progress.</p>
        <label className="h2-drawer-label">New exchange date</label>
        <input className="h2-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="h2-modal-foot">
          <button ref={firstRef} className="h2-link" onClick={() => onConfirm(`Recalculated estimate · ${data.item.address} (simulated)`)}>Recalculate instead</button>
          <div className="h2-modal-foot-actions">
            <GlassButton variant="ghost" onClick={onClose}>Cancel</GlassButton>
            <GlassButton variant="primary" disabled={!date} onClick={() => onConfirm(`New date set · ${data.item.address} (simulated)`)}>Set date</GlassButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function Banner({ tone, title, body, cta, onCta }: { tone: "warn" | "accent"; title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="h2-banner" data-tone={tone}>
      <div><strong>{title}</strong><span>{body}</span></div>
      <GlassButton size="sm" variant="secondary" onClick={onCta}>{cta}</GlassButton>
    </div>
  );
}

function EmptyState({ role, reduced, onCta }: { role: RoleKey; reduced: boolean; onCta: (m: string) => void }) {
  const copy: Record<RoleKey, { pill: string; h: string; p: string; cta?: string }> = {
    director: { pill: "Nothing here yet", h: "Your pipeline starts with one sale", p: "Add your first sale and we'll start tracking milestones, chasing solicitors and keeping everyone updated.", cta: "Add your first sale" },
    negotiator: { pill: "Nothing here yet", h: "Your pipeline starts with one sale", p: "Add your first sale and we'll start tracking it for you.", cta: "Add your first sale" },
    progressor: { pill: "Nothing assigned", h: "No assigned files yet", p: "Files assigned to you will appear here as your business takes on sales." },
    admin: { pill: "Nothing here yet", h: "No active files on the platform", p: "Confirmed sales across agencies will appear here as they come in." },
    owner: { pill: "Nothing here yet", h: "Add your first client", p: "Add an estate agent you work with, then add their first sale to get going.", cta: "Add your first client" },
  };
  const c = copy[role];
  return (
    <Reveal>
      <GlassCard material="lens" radius={24} strength="soft" thickness={1.15} className="h2-empty">
        <span className="h2-empty-pill">{c.pill}</span>
        <h2>{c.h}</h2>
        <p>{c.p}</p>
        {c.cta && <div className="h2-empty-cta"><GlassButton variant="primary" onClick={() => onCta(`${c.cta} (simulated)`)}>{c.cta} <ArrowRight weight="bold" /></GlassButton></div>}
        <div className="h2-empty-steps">
          {[["Solicitor replies, no chasing", "Replies land here the moment they arrive."], ["See every file's progress", "Each sale's stage and next step, at a glance."], ["Everyone kept updated", "Buyers and sellers get clear updates automatically."]].map(([t, b]) => (
            <div key={t} className="h2-empty-step"><strong>{t}</strong><span>{b}</span></div>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

const CSS = `
.h2-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); color:var(--lg-ink);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; }
.h2-scene{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(55% 40% at 10% 6%, rgba(56,225,255,0.06), transparent 70%), radial-gradient(50% 35% at 90% 94%, rgba(255,138,101,0.05), transparent 72%); }
.lg-ds[data-theme="light"] .h2-scene{ background:radial-gradient(42% 30% at 50% -6%, rgba(56,225,255,0.12), transparent 70%), radial-gradient(70% 50% at 6% 4%, rgba(255,188,168,0.2), transparent 72%), radial-gradient(60% 45% at 94% 8%, rgba(196,180,255,0.18), transparent 72%); }

.h2-dev{ position:relative; z-index:3; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 20px; border-bottom:1px solid var(--lg-line-2); flex-wrap:wrap; }
.h2-dev-tag{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--lg-accent-ink); } .h2-dev-tag svg{ width:14px; height:14px; }
.h2-dev-ctl{ display:flex; align-items:center; gap:10px; }
.h2-sel{ font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:6px 10px; cursor:pointer; }
.h2-seg2{ display:inline-flex; background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; overflow:hidden; } .h2-seg2 button{ font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; padding:6px 11px; cursor:pointer; } .h2-seg2 button.on{ background:var(--lg-accent); color:#fff; }
.h2-theme{ width:46px; height:26px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; } .h2-theme-knob{ position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; transition:transform .3s cubic-bezier(.3,1.35,.4,1); } .h2-theme-knob svg{ width:11px; height:11px; color:#33343c; } .h2-theme.on .h2-theme-knob{ transform:translateX(20px); }

.h2-wrap{ position:relative; z-index:2; max-width:1120px; margin:0 auto; padding:26px 24px 140px; }

/* entrance cascade */
.h2-reveal{ animation:h2rise .55s cubic-bezier(.2,.8,.2,1) both; }
@keyframes h2rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }

/* banners */
.h2-banner{ display:flex; align-items:center; gap:14px; padding:13px 17px; border-radius:14px; margin-bottom:12px; border:1px solid var(--lg-line); background:var(--lg-hover); }
.h2-banner[data-tone="warn"]{ border-color:rgba(255,159,10,0.3); background:rgba(255,159,10,0.08); }
.h2-banner > div{ flex:1; } .h2-banner strong{ display:block; font-size:14px; font-weight:650; } .h2-banner span{ font-size:12.5px; color:var(--lg-ink-2); }

/* header + pulse */
.h2-head{ margin:6px 0 20px; }
.h2-head-top{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; }
.h2-greet h1{ font-size:clamp(27px,3.6vw,38px); font-weight:800; letter-spacing:-.032em; line-height:1.03; }
.h2-greet p{ font-size:15px; color:var(--lg-ink-2); margin-top:7px; min-height:20px; }
.h2-caret{ display:inline-block; width:2px; height:1em; background:var(--lg-accent); margin-left:1px; vertical-align:-2px; animation:h2blink 1s step-end infinite; } .h2-caret[data-done]{ animation:none; opacity:0; }
@keyframes h2blink{ 50%{ opacity:0; } }
.h2-head-actions{ display:flex; gap:9px; flex-wrap:wrap; }

.h2-pulse{ display:grid; grid-template-columns:repeat(4,1fr); gap:1px; margin-top:20px; background:var(--lg-line-2); border:1px solid var(--lg-line-2); border-radius:14px; overflow:hidden; }
@media (max-width:640px){ .h2-pulse{ grid-template-columns:repeat(2,1fr); } }
.h2-pulse-cell{ display:flex; flex-direction:column; gap:2px; align-items:flex-start; text-align:left; padding:14px 16px; background:var(--lg-base); border:none; cursor:pointer; transition:background .2s; }
.h2-pulse-cell:hover{ background:var(--lg-hover); }
.h2-pulse-cell:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }
.h2-pulse-v{ font-size:25px; font-weight:800; letter-spacing:-.025em; } .h2-pulse-v[data-tone="danger"]{ color:var(--lg-danger-ink); }
.h2-pulse-k{ font-size:12.5px; font-weight:600; color:var(--lg-ink-2); } .h2-pulse-sub{ font-size:11px; color:var(--lg-ink-3); }

h2{ letter-spacing:-.02em; }
.h2-link{ display:inline-flex; align-items:center; gap:5px; font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-accent-ink); cursor:pointer; background:none; border:none; padding:0; } .h2-link svg{ width:13px; height:13px; }

/* ── overview: pipeline line ──────────────────────────────────────────────── */
.h2-ov{ margin-top:22px; }
.h2-line-card{ padding:20px 22px; } .h2-line-card > *{ position:relative; z-index:1; }
.h2-line-head{ display:flex; align-items:baseline; gap:10px; margin-bottom:16px; } .h2-line-head h2{ font-size:19px; font-weight:760; } .h2-line-sub{ font-size:12.5px; color:var(--lg-ink-3); }
.h2-line{ display:flex; gap:6px; align-items:stretch; }
.h2-seg{ position:relative; flex-basis:0; min-width:64px; }
.h2-seg-btn{ width:100%; display:flex; flex-direction:column; gap:3px; align-items:flex-start; text-align:left; padding:13px 14px; border-radius:12px; cursor:pointer; background:var(--lg-fill); border:1px solid var(--lg-line-2); color:var(--lg-ink); transition:transform .25s cubic-bezier(.2,.8,.2,1), border-color .2s, background .2s; }
.h2-seg[data-reached="false"] .h2-seg-btn{ opacity:.5; }
.h2-seg[data-last] .h2-seg-btn{ background:linear-gradient(135deg, var(--lg-accent-soft), var(--lg-fill)); }
.h2-seg-btn:hover{ transform:translateY(-3px); border-color:var(--lg-accent); }
.h2-seg-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.h2-seg-n{ font-size:22px; font-weight:800; letter-spacing:-.02em; } .h2-seg-l{ font-size:11.5px; font-weight:600; color:var(--lg-ink-2); white-space:nowrap; }

/* popover (pipeline stage → the sales behind it) */
.h2-pop{ position:absolute; z-index:40; top:calc(100% + 8px); left:0; min-width:200px; padding:10px 12px; }
.h2-pop.h2-pop-up{ top:auto; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); }
.h2-pop > *{ position:relative; z-index:1; }
.h2-pop-h{ font-size:11.5px; font-weight:700; color:var(--lg-ink); margin-bottom:7px; }
.h2-pop-row{ display:flex; justify-content:space-between; gap:12px; font-size:12px; color:var(--lg-ink-2); padding:3px 0; } .h2-pop-row b{ color:var(--lg-ink); }
.h2-pop-more{ font-size:11px; color:var(--lg-ink-3); margin-top:5px; }

/* performance strip */
.h2-perf{ display:flex; align-items:center; gap:20px; margin-top:16px; padding-top:16px; border-top:1px solid var(--lg-line-2); flex-wrap:wrap; }
.h2-perf-k{ font-size:12px; color:var(--lg-ink-2); } .h2-perf-v{ display:flex; align-items:baseline; gap:9px; font-size:26px; font-weight:800; } .h2-perf-up{ display:inline-flex; align-items:center; gap:3px; font-size:12px; font-weight:700; color:#5ce08a; } .h2-perf-up svg{ width:13px; height:13px; }
.lg-ds[data-theme="light"] .h2-perf-up{ color:#1a9c45; }
.h2-spark{ flex:1; min-width:120px; height:32px; }
.h2-perf-slas{ display:flex; gap:18px; font-size:12px; color:var(--lg-ink-2); } .h2-perf-slas b{ color:var(--lg-ink); }

/* overview band */
.h2-band{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:12px; align-items:start; }
@media (max-width:980px){ .h2-band{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px){ .h2-band{ grid-template-columns:1fr; } }
.h2-panel{ position:relative; background:color-mix(in srgb, var(--lg-base) 70%, transparent); border:1px solid var(--lg-line-2); border-radius:16px; padding:15px 16px; }
.h2-panel-h{ font-size:12.5px; font-weight:700; margin-bottom:12px; color:var(--lg-ink); }

/* wins carousel */
.h2-wins-stage{ min-height:72px; display:flex; align-items:center; }
.h2-wins-slide{ animation:h2fade .45s cubic-bezier(.2,.8,.2,1); } @keyframes h2fade{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
.h2-wins-slide strong{ display:block; font-size:34px; font-weight:820; letter-spacing:-.03em; line-height:1; } .h2-wins-slide span{ font-size:12px; color:var(--lg-ink-2); display:block; margin-top:6px; }
.h2-wins-dots{ display:flex; gap:6px; margin-top:12px; align-items:center; } .h2-dot{ width:7px; height:7px; border-radius:999px; background:var(--lg-line); border:none; padding:0; cursor:pointer; transition:background .25s, width .25s cubic-bezier(.2,.8,.2,1), transform .2s; } .h2-dot:hover{ transform:scale(1.25); } .h2-dot.on{ background:var(--lg-accent); width:18px; }
.h2-wins-grid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; } .h2-wins-mini strong{ display:block; font-size:19px; font-weight:780; } .h2-wins-mini span{ font-size:10.5px; color:var(--lg-ink-3); }

/* forecast */
.h2-fc{ display:flex; align-items:flex-end; gap:7px; height:104px; }
.h2-fc-col{ position:relative; flex:1; }
.h2-fc-btn{ width:100%; display:flex; flex-direction:column; align-items:center; gap:4px; justify-content:flex-end; background:none; border:none; cursor:pointer; padding:0; }
.h2-fc-bar{ width:100%; border-radius:7px 7px 3px 3px; background:var(--lg-fill); display:grid; place-items:center; transition:background .2s, filter .2s; } .h2-fc-col.cur .h2-fc-bar{ background:var(--lg-accent); }
.h2-fc-btn:hover .h2-fc-bar{ filter:brightness(1.12); } .h2-fc-col:not(.cur) .h2-fc-btn:hover .h2-fc-bar{ background:var(--lg-accent-soft); }
.h2-fc-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; border-radius:6px; }
.h2-fc-bar b{ font-size:11.5px; font-weight:750; color:var(--lg-ink-2); } .h2-fc-col.cur .h2-fc-bar b{ color:#fff; } .h2-fc-l{ font-size:10px; color:var(--lg-ink-2); } .h2-fc-f{ font-size:9.5px; color:var(--lg-ink-3); }

/* role panels */
.h2-clients{ width:100%; border-collapse:collapse; } .h2-clients td{ padding:7px 5px; font-size:12.5px; border-bottom:1px solid var(--lg-line-2); } .h2-clients tr:last-child td{ border-bottom:none; } .h2-clients td:first-child{ font-weight:600; } .h2-clients td:not(:first-child){ color:var(--lg-ink-2); }
.h2-split-bar{ height:11px; border-radius:999px; background:#30c8a0; overflow:hidden; } .h2-split-bar > span{ display:block; height:100%; background:var(--lg-accent); } .h2-split-legend{ display:flex; gap:14px; margin-top:10px; font-size:11.5px; color:var(--lg-ink-2); flex-wrap:wrap; } .h2-split-legend i{ display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:5px; } .h2-split-legend i.a{ background:var(--lg-accent); } .h2-split-legend i.b{ background:#30c8a0; } .h2-split-note{ font-size:11px; color:var(--lg-ink-3); margin-top:9px; }

/* activity */
.h2-acts{ display:flex; flex-direction:column; } .h2-act{ display:flex; align-items:center; gap:10px; padding:8px 0; background:none; border:none; border-top:1px solid var(--lg-line-2); cursor:pointer; text-align:left; transition:opacity .2s; } .h2-act:first-child{ border-top:none; } .h2-act:hover{ opacity:.74; } .h2-act-ic{ width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background:var(--lg-fill); color:var(--lg-ink-2); flex-shrink:0; } .h2-act-ic[data-kind="milestone"]{ color:#5ce08a; } .h2-act-ic svg{ width:14px; height:14px; } .h2-act > div{ flex:1; min-width:0; } .h2-act strong{ display:block; font-size:12.5px; font-weight:550; } .h2-act span{ font-size:11px; color:var(--lg-ink-3); } .h2-act time{ font-size:10.5px; color:var(--lg-ink-3); flex-shrink:0; }

/* ── needs you ────────────────────────────────────────────────────────────── */
.h2-needs{ margin-top:30px; }
.h2-needs-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
.h2-needs-head h2{ font-size:21px; font-weight:780; } .h2-needs-head p{ font-size:13px; color:var(--lg-ink-2); margin-top:3px; }
.h2-needs-tools{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }

/* lens control */
.h2-lens{ position:relative; display:inline-grid; grid-auto-flow:column; grid-auto-columns:1fr; padding:3px; border-radius:11px; background:rgba(0,0,0,0.22); border:1px solid var(--lg-line); } .lg-ds[data-theme="light"] .h2-lens{ background:rgba(12,16,28,0.05); }
.h2-lens-thumb{ position:absolute; top:3px; bottom:3px; border-radius:8px; background:var(--lg-fill); box-shadow:inset 0 1px 0 rgba(255,255,255,.4), 0 1px 3px rgba(20,30,60,.18); transition:transform .32s cubic-bezier(.3,1.35,.4,1), width .32s cubic-bezier(.3,1.35,.4,1); } .lg-ds[data-theme="light"] .h2-lens-thumb{ background:#fff; }
.h2-lens-btn{ position:relative; z-index:1; padding:6px 13px; font:inherit; font-size:12px; font-weight:550; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; transition:color .3s; white-space:nowrap; } .h2-lens-btn[data-on="true"]{ color:var(--lg-ink); } .h2-lens-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; border-radius:7px; }

/* diary */
.h2-diary{ display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
.h2-diary-ev{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; background:var(--lg-fill); border:1px solid var(--lg-line); min-width:255px; flex:1; }
.h2-diary-ic{ width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:var(--lg-accent-soft); color:var(--lg-accent-ink); flex-shrink:0; } .h2-diary-ev[data-status="done"] .h2-diary-ic{ background:rgba(48,209,88,.16); color:#5ce08a; } .h2-diary-ic svg{ width:18px; height:18px; }
.h2-diary-ev > div{ flex:1; min-width:0; } .h2-diary-ev strong{ display:block; font-size:13px; font-weight:650; } .h2-diary-ev span{ font-size:12px; color:var(--lg-ink-3); }
.h2-diary-tag{ font-size:11px; font-weight:650; color:var(--lg-ink-3); padding:4px 10px; border-radius:999px; background:var(--lg-fill); } .h2-diary-tag.done{ color:#5ce08a; }

/* start here (escalated) */
.h2-start{ margin-bottom:18px; }
.h2-start-label{ display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--lg-danger-ink); margin-bottom:10px; }

/* grouped list (property grouped) — a list, not a card grid */
.h2-group-list{ display:flex; flex-direction:column; gap:10px; }
.h2-group-list + .h2-group-list{ margin-top:10px; }
.h2-group{ position:relative; border:1px solid var(--lg-line-2); border-radius:14px; padding:12px 14px 13px; background:var(--lg-hover); overflow:visible; }
.h2-group::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:3px 0 0 3px; background:var(--lg-ink-3); }
.h2-group[data-tone="danger"]::before{ background:var(--lg-danger); } .h2-group[data-tone="warn"]::before{ background:var(--lg-warn); } .h2-group[data-tone="accent"]::before{ background:var(--lg-accent); }
.h2-group.focal{ background:rgba(255,69,58,.06); border-color:rgba(255,69,58,.22); }
.h2-group-head{ display:flex; align-items:baseline; gap:8px; margin-bottom:10px; } .h2-group-head strong{ font-size:14.5px; font-weight:700; } .h2-group-town{ font-size:11.5px; color:var(--lg-ink-3); } .h2-group-count{ margin-left:auto; font-size:10.5px; font-weight:700; color:var(--lg-accent-ink); background:var(--lg-accent-soft); padding:3px 9px; border-radius:999px; white-space:nowrap; }
.h2-group-rows{ display:flex; flex-direction:column; gap:8px; }

/* one need line (inside a multi-need group) */
.h2-need{ display:flex; align-items:flex-start; gap:11px; padding:10px 11px; border-radius:11px; background:var(--lg-base); border:1px solid var(--lg-line-2); position:relative; overflow:visible; transition:background .2s; }
.lg-ds[data-theme="light"] .h2-need{ background:rgba(255,255,255,.5); }
.h2-need:hover{ background:var(--lg-fill); }
.h2-need-ic{ width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:var(--lg-fill); color:var(--lg-ink-2); flex-shrink:0; } .h2-need-ic svg{ width:16px; height:16px; }
.h2-need[data-tone="danger"] .h2-need-ic{ background:rgba(255,69,58,.14); color:var(--lg-danger-ink); } .h2-need[data-tone="warn"] .h2-need-ic{ background:rgba(255,159,10,.14); color:#ffb84d; } .h2-need[data-tone="accent"] .h2-need-ic{ background:var(--lg-accent-soft); color:var(--lg-accent-ink); }
.h2-need-body{ flex:1; min-width:0; }
.h2-need-top{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.h2-need-cat{ font-size:10.5px; font-weight:650; color:var(--lg-ink-3); }
.h2-need-urg{ font-size:10px; font-weight:700; padding:1px 7px; border-radius:999px; } .h2-need-urg[data-tone="danger"]{ color:var(--lg-danger-ink); background:rgba(255,69,58,.14); } .h2-need-urg[data-tone="warn"]{ color:#ffb84d; background:rgba(255,159,10,.14); } .h2-need-urg[data-tone="accent"]{ color:var(--lg-accent-ink); background:var(--lg-accent-soft); }
.h2-need-owner{ margin-left:auto; font-size:10.5px; font-weight:600; color:var(--lg-ink-3); }
.h2-need-need{ font-size:13px; color:var(--lg-ink); margin-top:4px; font-weight:500; } .h2-need-meta{ font-size:11.5px; color:var(--lg-ink-3); margin-top:2px; }

/* flat rows (by type / urgency) */
.h2-flat{ display:flex; flex-direction:column; gap:16px; }
.h2-tier-head{ display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lg-ink-3); margin-bottom:9px; }
.h2-tier-dot{ width:7px; height:7px; border-radius:50%; } .h2-tier-dot[data-tone="danger"]{ background:var(--lg-danger); } .h2-tier-dot[data-tone="warn"]{ background:var(--lg-warn); } .h2-tier-dot[data-tone="accent"]{ background:var(--lg-accent); } .h2-tier-dot[data-tone="neutral"]{ background:var(--lg-ink-3); }
.h2-tier-n{ color:var(--lg-ink-3); }
.h2-row{ display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:13px; background:var(--lg-hover); border:1px solid var(--lg-line-2); position:relative; overflow:visible; margin-bottom:8px; transition:background .2s, transform .2s; }
.h2-row:hover{ background:var(--lg-fill); transform:translateY(-1px); }
.h2-group-list > .h2-row{ margin-bottom:0; }
.h2-row[data-focal]{ background:rgba(255,69,58,.06); border-color:rgba(255,69,58,.22); }
.h2-row[data-focal]:hover{ background:rgba(255,69,58,.1); }
.h2-row::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:3px 0 0 3px; background:var(--lg-ink-3); }
.h2-row[data-tone="danger"]::before{ background:var(--lg-danger); } .h2-row[data-tone="warn"]::before{ background:var(--lg-warn); } .h2-row[data-tone="accent"]::before{ background:var(--lg-accent); }
.h2-row-ic{ width:38px; height:38px; border-radius:10px; display:grid; place-items:center; background:var(--lg-fill); color:var(--lg-ink-2); flex-shrink:0; } .h2-row-ic svg{ width:18px; height:18px; }
.h2-row-body{ flex:1; min-width:0; }
.h2-row-top{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; } .h2-row-top strong{ font-size:14px; font-weight:650; } .h2-row-town{ font-size:12px; color:var(--lg-ink-3); } .h2-row-owner{ margin-left:auto; font-size:11px; font-weight:600; color:var(--lg-ink-3); }
.h2-row-need{ font-size:13px; color:var(--lg-ink); margin-top:3px; } .h2-row-meta{ font-size:11.5px; color:var(--lg-ink-3); margin-top:2px; }

/* row actions (split + menu) */
.h2-act-wrap{ position:relative; flex-shrink:0; }
.h2-split{ display:inline-flex; align-items:stretch; }
.h2-split .lgbtn{ border-top-right-radius:0; border-bottom-right-radius:0; }
.h2-split-more{ display:grid; place-items:center; width:30px; border:none; cursor:pointer; background:var(--lg-accent); color:#fff; border-radius:0 8px 8px 0; border-left:1px solid rgba(255,255,255,.28); transition:filter .2s; } .h2-split-more:hover{ filter:brightness(1.08); } .h2-split-more svg{ width:13px; height:13px; transition:transform .2s ease; } .h2-split-more[aria-expanded="true"] svg{ transform:rotate(180deg); } .h2-split-more:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.h2-menu{ position:absolute; top:calc(100% + 6px); right:0; z-index:45; min-width:190px; padding:6px; } .h2-menu > *{ position:relative; z-index:1; }
.h2-menu-item{ display:block; width:100%; text-align:left; font:inherit; font-size:13px; font-weight:500; color:var(--lg-ink); background:none; border:none; padding:9px 11px; border-radius:9px; cursor:pointer; transition:background .15s; } .h2-menu-item:hover{ background:var(--lg-hover); } .h2-menu-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

@media (max-width:620px){ .h2-row, .h2-need{ flex-wrap:wrap; } .h2-act-wrap{ width:100%; } .h2-need .h2-act-wrap{ margin-top:9px; } .h2-split{ width:100%; } .h2-split .lgbtn{ flex:1; } .h2-need-owner, .h2-row-owner{ margin-left:0; } }

/* all clear */
.h2-clear{ text-align:center; padding:48px 20px; } .h2-clear svg{ width:44px; height:44px; color:#5ce08a; } .h2-clear strong{ display:block; font-size:19px; font-weight:750; margin-top:12px; } .h2-clear span{ display:block; font-size:13.5px; color:var(--lg-ink-2); margin-top:5px; }

/* ── drawer ──────────────────────────────────────────────────────────────── */
.h2-drawer-scrim{ position:fixed; inset:0; z-index:80; background:rgba(0,0,0,.42); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); display:flex; justify-content:flex-end; animation:h2fadein .25s; } @keyframes h2fadein{ from{ opacity:0; } to{ opacity:1; } }
.h2-drawer{ width:min(440px,100%); height:100%; background:var(--lg-base); border-left:1px solid var(--lg-line); display:flex; flex-direction:column; animation:h2slide .4s cubic-bezier(.2,.8,.2,1); box-shadow:-20px 0 60px rgba(0,0,0,.3); }
.h2-drawer-scrim.noanim, .h2-drawer-scrim.noanim .h2-drawer{ animation:none; }
@keyframes h2slide{ from{ transform:translateX(100%); } to{ transform:none; } }
.h2-drawer-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 20px; border-bottom:1px solid var(--lg-line-2); } .h2-drawer-eyebrow{ display:block; font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--lg-accent-ink); margin-bottom:3px; } .h2-drawer-head strong{ font-size:16px; font-weight:700; }
.h2-icon-btn{ width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; transition:background .2s, color .2s; } .h2-icon-btn:hover{ background:var(--lg-hover); color:var(--lg-ink); } .h2-icon-btn svg{ width:15px; height:15px; } .h2-icon-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.h2-drawer-body{ flex:1; overflow:auto; padding:20px; } .h2-drawer-ctx{ font-size:12.5px; color:var(--lg-ink-2); margin-bottom:16px; }
.h2-drawer-label{ display:block; font-size:11.5px; font-weight:650; color:var(--lg-ink-2); margin-bottom:7px; }
.h2-textarea, .h2-input{ width:100%; background:var(--lg-field); border:1px solid var(--lg-line); border-radius:11px; padding:11px 13px; color:var(--lg-ink); font:inherit; font-size:13.5px; line-height:1.5; resize:vertical; transition:border-color .2s; } .h2-textarea:focus, .h2-input:focus{ outline:none; border-color:var(--lg-accent); }
.h2-drawer-note{ font-size:11px; color:var(--lg-ink-3); margin-top:10px; }
.h2-drawer-foot{ display:flex; justify-content:flex-end; gap:9px; padding:16px 20px; border-top:1px solid var(--lg-line-2); }

/* modal */
.h2-modal{ width:min(440px,100%); padding:24px; } .h2-modal > *{ position:relative; z-index:1; }
.h2-modal-head strong{ display:block; font-size:17px; font-weight:750; } .h2-modal-ctx{ font-size:13px; color:var(--lg-ink-2); margin:12px 0 16px; line-height:1.5; }
.h2-modal-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; flex-wrap:wrap; } .h2-modal-foot-actions{ display:flex; gap:9px; }

/* toast */
.h2-toast{ position:fixed; z-index:90; bottom:26px; left:50%; transform:translateX(-50%); display:inline-flex; align-items:center; gap:9px; padding:11px 17px; font-size:13px; font-weight:550; } .h2-toast > *{ position:relative; z-index:1; } .h2-toast svg{ width:14px; height:14px; color:#5ce08a; }

/* empty */
.h2-empty{ padding:36px 32px; text-align:center; margin-top:8px; } .h2-empty > *{ position:relative; z-index:1; }
.h2-empty-pill{ display:inline-block; font-size:11.5px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); padding:5px 13px; border-radius:999px; }
.h2-empty h2{ font-size:26px; font-weight:780; margin:16px 0 10px; } .h2-empty > p{ font-size:14.5px; color:var(--lg-ink-2); max-width:440px; margin:0 auto; line-height:1.5; }
.h2-empty-cta{ margin-top:20px; }
.h2-empty-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin-top:30px; border-top:1px solid var(--lg-line-2); padding-top:6px; text-align:left; }
.h2-empty-step{ padding:18px 18px 6px; } .h2-empty-step + .h2-empty-step{ border-left:1px solid var(--lg-line-2); } .h2-empty-step strong{ display:block; font-size:13.5px; font-weight:650; margin-bottom:5px; } .h2-empty-step span{ font-size:12.5px; color:var(--lg-ink-2); line-height:1.45; }
@media (max-width:720px){ .h2-empty-steps{ grid-template-columns:1fr; } .h2-empty-step + .h2-empty-step{ border-left:none; border-top:1px solid var(--lg-line-2); } }

@media (prefers-reduced-motion: reduce){ .h2-root *{ animation:none !important; transition:none !important; } }
`;
