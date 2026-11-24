"use client";
// /dev/hub-glass — Hub redesign prototype. Dev-only (blocks in production).
// Presentation-only. Mock/read-only data (./mock). Every action is SIMULATED (toast;
// no writes, emails or chases). The production Hub, logic, permissions and queries
// are untouched. Dev controls (role / state / theme) are prototype-only.

import { useMemo, useRef, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, Sparkle, House, Bell, Warning, CalendarBlank, CurrencyGbp, EnvelopeSimple,
  ClipboardText, ChatCircle, MoonStars as Moon, ArrowRight, ArrowUpRight, Plus, NotePencil,
  PaperPlaneTilt, Check, CaretDown, DotsThree, TrendUp, Users, CheckCircle, ArrowClockwise,
} from "@phosphor-icons/react";
import { GlassCard, GlassButton, GlassBadge, StatusDot } from "@/components/liquid";
import {
  HUB, ROLES, CLIENTS, CATEGORY_META, URGENCY_META,
  type RoleKey, type WorkCategory, type Urgency, type WorkItem, type WorkAction,
} from "./mock";

type Theme = "dark" | "light";
const CAT_ICON: Record<WorkCategory, typeof Bell> = {
  reminder: Bell, at_risk: Warning, booking: CalendarBlank, mortgage: CurrencyGbp,
  filing: EnvelopeSimple, review: ClipboardText, quiet: Moon, enquiry: ChatCircle, exchange_passed: Warning,
};
const URGENCY_ORDER: Urgency[] = ["escalated", "overdue", "today", "week"];

export default function HubGlass() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [roleKey, setRoleKey] = useState<RoleKey>("director");
  const [populated, setPopulated] = useState(true);
  const role = ROLES[roleKey];

  // Today state
  const [filter, setFilter] = useState<WorkCategory | "all">("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = (m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2600); setMenuOpen(null); };

  const counts = useMemo(() => {
    const c = {} as Record<WorkCategory, number>;
    for (const w of HUB.work) c[w.category] = (c[w.category] ?? 0) + 1;
    return c;
  }, []);
  const visible = filter === "all" ? HUB.work : HUB.work.filter((w) => w.category === filter);
  const grouped = URGENCY_ORDER.map((u) => ({ u, items: visible.filter((w) => w.urgency === u) })).filter((g) => g.items.length);
  const totalNeeds = HUB.work.length;
  const escalated = HUB.work.filter((w) => w.urgency === "escalated").length;
  const overdue = HUB.work.filter((w) => w.urgency === "overdue").length;

  return (
    <div className="lg-ds hg-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hg-scene" aria-hidden />

      {/* prototype dev controls */}
      <div className="hg-dev">
        <span className="hg-dev-tag"><Sparkle weight="fill" /> Hub prototype · actions simulated</span>
        <div className="hg-dev-ctl">
          <select className="hg-sel" value={roleKey} onChange={(e) => setRoleKey(e.target.value as RoleKey)}>
            {Object.values(ROLES).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <div className="hg-seg">
            <button className={populated ? "on" : ""} onClick={() => setPopulated(true)}>Populated</button>
            <button className={!populated ? "on" : ""} onClick={() => setPopulated(false)}>Empty</button>
          </div>
          <button className={`hg-theme ${theme === "light" ? "on" : ""}`} aria-label="Theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="hg-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </div>
      </div>

      <main className="hg-wrap">
        {/* banners (role-gated, simulated) */}
        {role.banners.includes("card") && <Banner tone="warn" title="Add a payment card to keep adding sales" body="£5 per sale · £59 subscription · £39 per extra team member." cta="Add a card" onCta={() => fire("Open billing (simulated)")} />}
        {role.banners.includes("email") && <Banner tone="accent" title="Send emails from your own address" body="Verify your sender so clients see your agency, not ours." cta="Set up" onCta={() => fire("Email setup (simulated)")} />}

        {/* header */}
        <header className="hg-head">
          <div>
            <h1>Good morning, {role.name} 👋</h1>
            <p>{populated ? role.subtitle : "Your pipeline starts with one sale."}</p>
          </div>
          <div className="hg-head-actions">
            <GlassButton variant="subtle" onClick={() => fire("New note (simulated)")}><NotePencil weight="regular" /> Add note</GlassButton>
            <GlassButton variant="subtle" onClick={() => fire("New email (simulated)")}><PaperPlaneTilt weight="regular" /> New email</GlassButton>
            {role.canCreateSale && <GlassButton variant="primary" onClick={() => fire("Add a sale (simulated)")}><Plus weight="bold" /> Add a sale</GlassButton>}
          </div>
        </header>

        {!populated ? (
          <EmptyState role={roleKey} onCta={fire} />
        ) : (
          <>
            {/* ───────────── TODAY — the work surface ───────────── */}
            <GlassCard material="lens" radius={22} strength="soft" thickness={1.15} className="hg-today">
              <div className="hg-today-head">
                <div>
                  <h2>Today</h2>
                  <p>{totalNeeds} need you{escalated ? ` · ${escalated} escalated` : ""}{overdue ? ` · ${overdue} overdue` : ""}</p>
                </div>
                <a className="hg-link" onClick={() => fire("Open work queue (simulated)")}>Work queue <ArrowRight weight="bold" /></a>
              </div>

              {/* diary strip — today's time-critical events, kept distinct */}
              {HUB.diary.length > 0 && (
                <div className="hg-diary">
                  {HUB.diary.map((d) => (
                    <div key={d.id} className="hg-diary-ev" data-status={d.status}>
                      <span className="hg-diary-ic">{d.type === "exchange" ? <CheckCircle weight="fill" /> : <CalendarBlank weight="fill" />}</span>
                      <div><strong>{d.type === "exchange" ? "Exchange" : "Completion"} today</strong><span>{d.address}</span></div>
                      {d.status === "ready" ? <GlassButton size="sm" variant="primary" onClick={() => fire("Confirm exchange (simulated)")}>Confirm</GlassButton>
                        : d.status === "not_ready" ? <span className="hg-diary-tag">Not ready</span>
                          : <span className="hg-diary-tag done">Done</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* workload bar — every category's load, always visible, click to focus */}
              <div className="hg-load" role="tablist">
                <button className={`hg-load-pill ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All <b>{totalNeeds}</b></button>
                {(Object.keys(CATEGORY_META) as WorkCategory[]).filter((c) => counts[c]).map((c) => {
                  const Icon = CAT_ICON[c];
                  return (
                    <button key={c} className={`hg-load-pill ${filter === c ? "on" : ""}`} data-tone={CATEGORY_META[c].tone} onClick={() => setFilter(c)}>
                      <Icon weight="fill" />{CATEGORY_META[c].label} <b>{counts[c]}</b>
                    </button>
                  );
                })}
              </div>

              {/* ranked worklist — grouped by urgency so priorities are obvious */}
              <div className="hg-worklist">
                {grouped.map(({ u, items }) => (
                  <div key={u} className="hg-tier">
                    <div className="hg-tier-head"><span className="hg-tier-dot" data-tone={URGENCY_META[u].tone} />{URGENCY_META[u].label}<span className="hg-tier-n">{items.length}</span></div>
                    {items.map((w) => <WorkRow key={w.id} w={w} menuOpen={menuOpen} setMenuOpen={setMenuOpen} fire={fire} />)}
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* ───────────── PIPELINE — the know section ───────────── */}
            <h2 className="hg-section-h">Pipeline</h2>
            <GlassCard material="lens" radius={20} strength="soft" thickness={1.1} className="hg-pipe">
              <div className="hg-stats">
                {[
                  { k: "Active files", v: HUB.pipeline.activeFiles, sub: `+${HUB.pipeline.newThisMonth} this month`, to: "Files" },
                  { k: "Exchanging soon", v: HUB.pipeline.exchangingSoon, sub: `${HUB.forecast[0].count} this week`, to: "Exchanging" },
                  { k: "Needs attention", v: HUB.pipeline.needsAttention, sub: HUB.pipeline.escalated ? `${HUB.pipeline.escalated} escalated` : "all clear", to: "Today", tone: "danger" as const },
                  { k: "Pipeline value", v: `£${HUB.pipeline.pipelineValueM}m`, sub: role.moneyLabel, to: "Value" },
                ].map((s) => (
                  <button key={s.k} className="hg-stat" onClick={() => fire(`${s.to} (simulated)`)}>
                    <span className="hg-stat-k">{s.k}</span>
                    <strong className="hg-stat-v" data-tone={s.tone}>{s.v}</strong>
                    <span className="hg-stat-sub">{s.sub}</span>
                  </button>
                ))}
              </div>

              <div className="hg-stages">
                {HUB.pipeline.stages.map((st, i) => (
                  <div key={st.key} className="hg-stage" data-reached={i < 5}>
                    <span className="hg-stage-n">{st.count}</span>
                    <span className="hg-stage-l">{st.label}</span>
                    {st.sample && <span className="hg-stage-s">{st.sample}</span>}
                  </div>
                ))}
              </div>

              <div className="hg-trend">
                <div className="hg-trend-main">
                  <span className="hg-trend-k">Exchanges · last 30 days</span>
                  <span className="hg-trend-v">{HUB.pipeline.exchLast30}<span className="hg-trend-up"><TrendUp weight="bold" /> {HUB.pipeline.momentumPct}%</span></span>
                </div>
                <Spark data={HUB.pipeline.spark} />
                <div className="hg-trend-slas">
                  <span><b>{HUB.pipeline.medianDays}d</b> median to exchange</span>
                  <span><b>{HUB.pipeline.within12Pct}%</b> within 12 weeks</span>
                </div>
              </div>
            </GlassCard>

            <div className="hg-grid2">
              {/* Wins — static, numbers at rest */}
              <GlassCard material="solid" radius={18} className="hg-sub">
                <div className="hg-sub-h">Wins this month</div>
                <div className="hg-wins">
                  {[["Exchanges", HUB.wins.exchanges], ["Completions", HUB.wins.completions], ["Fastest", `${HUB.wins.fastestDays}d`], ["Biggest fee", `£${HUB.wins.biggestFeeK}k`], ["New business", HUB.wins.newBusiness]].map(([k, v]) => (
                    <div key={k as string} className="hg-win"><strong>{v}</strong><span>{k}</span></div>
                  ))}
                </div>
              </GlassCard>

              {/* Forecast — the 5-week horizon */}
              <GlassCard material="solid" radius={18} className="hg-sub">
                <div className="hg-sub-h">Exchange forecast</div>
                <div className="hg-fc">
                  {HUB.forecast.map((w) => {
                    const max = Math.max(...HUB.forecast.map((x) => x.count));
                    return (
                      <div key={w.label} className={`hg-fc-col ${w.current ? "cur" : ""}`}>
                        <span className="hg-fc-bar" style={{ height: `${20 + (w.count / max) * 60}px` }}><b>{w.count}</b></span>
                        <span className="hg-fc-l">{w.label}</span>
                        <span className="hg-fc-f">£{w.feesK}k</span>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            <div className="hg-grid2">
              {/* Service split or Your clients (role) */}
              {role.lowerRight === "clients" ? (
                <GlassCard material="solid" radius={18} className="hg-sub">
                  <div className="hg-sub-h">Your clients</div>
                  <table className="hg-clients"><tbody>
                    {CLIENTS.map((c) => (
                      <tr key={c.name}><td>{c.name}</td><td>{c.active} active</td><td>£{c.pipelineM}m</td><td>{c.feeUnset ? <a className="hg-link" onClick={() => fire("Set fee (simulated)")}>Set fee</a> : `£${c.feeK}k`}</td></tr>
                    ))}
                  </tbody></table>
                </GlassCard>
              ) : role.lowerRight === "service" ? (
                <GlassCard material="solid" radius={18} className="hg-sub">
                  <div className="hg-sub-h">Who's managing</div>
                  <div className="hg-split">
                    <div className="hg-split-bar"><span style={{ width: "62%" }} /></div>
                    <div className="hg-split-legend"><span><i className="a" /> Self-managed 62%</span><span><i className="b" /> Outsourced 38%</span></div>
                    {roleKey === "admin" && <p className="hg-split-note">Top: Harpers Estates, Weston & Co, Bridge Property</p>}
                  </div>
                </GlassCard>
              ) : <div className="hg-sub-empty" />}

              {/* Recent activity */}
              <GlassCard material="solid" radius={18} className="hg-sub">
                <div className="hg-sub-h">Recent activity</div>
                <div className="hg-acts">
                  {HUB.activity.map((a) => (
                    <button key={a.id} className="hg-act" onClick={() => fire("Open activity (simulated)")}>
                      <span className="hg-act-ic">{a.kind === "comm" ? <ChatCircle weight="fill" /> : <Check weight="bold" />}</span>
                      <div><strong>{a.description}</strong><span>{a.context}</span></div>
                      <time>{a.at}</time>
                    </button>
                  ))}
                </div>
              </GlassCard>
            </div>
          </>
        )}
      </main>

      {toast && <GlassCard material="lens" radius={13} strength="strong" thickness={1.4} className="hg-toast"><Check weight="bold" /><span>{toast}</span></GlassCard>}
    </div>
  );
}

function WorkRow({ w, menuOpen, setMenuOpen, fire }: { w: WorkItem; menuOpen: string | null; setMenuOpen: (v: string | null) => void; fire: (m: string) => void }) {
  const Icon = CAT_ICON[w.category];
  const primary = w.actions.find((a) => a.primary) ?? w.actions[0];
  const hasMenu = w.actions.some((a) => a.menu) || w.actions.length > 1;
  return (
    <div className="hg-row" data-tone={CATEGORY_META[w.category].tone}>
      <span className="hg-row-ic"><Icon weight="fill" /></span>
      <div className="hg-row-body">
        <div className="hg-row-top"><strong>{w.address}</strong><span className="hg-row-town">{w.town}</span><span className="hg-row-cat">{CATEGORY_META[w.category].label}</span></div>
        <p className="hg-row-need">{w.need}</p>
        {w.meta && <p className="hg-row-meta">{w.meta}</p>}
      </div>
      <div className="hg-row-act">
        <GlassButton size="sm" variant={primary.danger ? "danger" : "primary"} onClick={() => fire(`${primary.label} (simulated)`)}>{primary.label}</GlassButton>
        {hasMenu && (
          <div className="hg-row-menu-wrap">
            <button className="hg-row-more" aria-label="More" onClick={() => setMenuOpen(menuOpen === w.id ? null : w.id)}><DotsThree weight="bold" /></button>
            {menuOpen === w.id && (
              <GlassCard material="lens" radius={12} strength="strong" thickness={1.4} className="hg-menu">
                {(primary.menu ?? w.actions.filter((a) => a !== primary).map((a) => a.label)).map((m) => (
                  <button key={m} className="hg-menu-item" onClick={() => fire(`${m} (simulated)`)}>{m}</button>
                ))}
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Banner({ tone, title, body, cta, onCta }: { tone: "warn" | "accent"; title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="hg-banner" data-tone={tone}>
      <div><strong>{title}</strong><span>{body}</span></div>
      <GlassButton size="sm" variant="secondary" onClick={onCta}>{cta}</GlassButton>
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(" ");
  return (
    <svg className="hg-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--lg-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyState({ role, onCta }: { role: RoleKey; onCta: (m: string) => void }) {
  const copy: Record<RoleKey, { pill: string; h: string; p: string; cta?: string }> = {
    director: { pill: "Nothing here yet", h: "Your pipeline starts with one sale", p: "Add your first sale and we'll start tracking milestones, chasing solicitors and keeping everyone updated.", cta: "Add your first sale" },
    negotiator: { pill: "Nothing here yet", h: "Your pipeline starts with one sale", p: "Add your first sale and we'll start tracking it for you.", cta: "Add your first sale" },
    progressor: { pill: "Nothing assigned", h: "No assigned files yet", p: "Files assigned to you will appear here as your business takes on sales." },
    admin: { pill: "Nothing here yet", h: "No active files on the platform", p: "Confirmed sales across agencies will appear here as they come in." },
    owner: { pill: "Nothing here yet", h: "Add your first client", p: "Add an estate agent you work with, then add their first sale to get going.", cta: "Add your first client" },
  };
  const c = copy[role];
  return (
    <GlassCard material="lens" radius={24} strength="soft" thickness={1.15} className="hg-empty">
      <span className="hg-empty-pill">{c.pill}</span>
      <h2>{c.h}</h2>
      <p>{c.p}</p>
      {c.cta && <div className="hg-empty-cta"><GlassButton variant="primary" onClick={() => onCta(`${c.cta} (simulated)`)}>{c.cta} <ArrowRight weight="bold" /></GlassButton></div>}
      <div className="hg-empty-steps">
        {[["Solicitor replies, no chasing", "Replies land here the moment they arrive."], ["See every file's progress", "Each sale's stage and next step, at a glance."], ["Everyone kept updated", "Buyers and sellers get clear updates automatically."]].map(([t, b]) => (
          <div key={t} className="hg-empty-step"><strong>{t}</strong><span>{b}</span></div>
        ))}
      </div>
    </GlassCard>
  );
}

const CSS = `
.hg-root{ --danger:var(--lg-danger); position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); color:var(--lg-ink);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; }
.hg-scene{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(55% 40% at 12% 8%, rgba(56,225,255,0.07), transparent 70%), radial-gradient(50% 35% at 88% 92%, rgba(168,255,96,0.045), transparent 70%); }
.lg-ds[data-theme="light"] .hg-scene{ background:radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.12), transparent 70%), radial-gradient(70% 50% at 8% 6%, rgba(255,188,168,0.22), transparent 72%), radial-gradient(60% 45% at 92% 10%, rgba(196,180,255,0.2), transparent 72%); }

.hg-dev{ position:relative; z-index:3; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 20px; border-bottom:1px solid var(--lg-line-2); flex-wrap:wrap; }
.hg-dev-tag{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--lg-accent-ink); } .hg-dev-tag svg{ width:14px; height:14px; }
.hg-dev-ctl{ display:flex; align-items:center; gap:10px; }
.hg-sel{ font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:6px 10px; cursor:pointer; }
.hg-seg{ display:inline-flex; background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; overflow:hidden; } .hg-seg button{ font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; padding:6px 11px; cursor:pointer; } .hg-seg button.on{ background:var(--lg-accent); color:#fff; }
.hg-theme{ width:46px; height:26px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; } .hg-theme-knob{ position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; } .hg-theme-knob svg{ width:11px; height:11px; color:#33343c; } .hg-theme.on .hg-theme-knob{ transform:translateX(20px); }

.hg-wrap{ position:relative; z-index:2; max-width:1080px; margin:0 auto; padding:28px 24px 120px; }
.hg-banner{ display:flex; align-items:center; gap:14px; padding:14px 18px; border-radius:14px; margin-bottom:14px; border:1px solid var(--lg-line); background:var(--lg-hover); }
.hg-banner[data-tone="warn"]{ border-color:rgba(255,159,10,0.3); background:rgba(255,159,10,0.08); }
.hg-banner > div{ flex:1; } .hg-banner strong{ display:block; font-size:14px; font-weight:650; } .hg-banner span{ font-size:12.5px; color:var(--lg-ink-2); }

.hg-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin:8px 0 22px; flex-wrap:wrap; }
.hg-head h1{ font-size:clamp(26px,3.4vw,36px); font-weight:780; letter-spacing:-.03em; line-height:1.05; }
.hg-head p{ font-size:15px; color:var(--lg-ink-2); margin-top:7px; }
.hg-head-actions{ display:flex; gap:10px; flex-wrap:wrap; }

h2.hg-section-h{ font-size:18px; font-weight:750; letter-spacing:-.02em; margin:26px 0 12px; }
.hg-link{ display:inline-flex; align-items:center; gap:5px; font-size:12.5px; font-weight:600; color:var(--lg-accent-ink); cursor:pointer; } .hg-link svg{ width:13px; height:13px; }

/* TODAY */
.hg-today{ padding:20px 22px; } .hg-today > *{ position:relative; z-index:1; }
.hg-today-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.hg-today-head h2{ font-size:20px; font-weight:760; letter-spacing:-.02em; } .hg-today-head p{ font-size:13px; color:var(--lg-ink-2); margin-top:3px; }
.hg-diary{ display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; }
.hg-diary-ev{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; background:var(--lg-fill); border:1px solid var(--lg-line); min-width:260px; flex:1; }
.hg-diary-ic{ width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:var(--lg-accent-soft); color:var(--lg-accent-ink); flex-shrink:0; } .hg-diary-ev[data-status="done"] .hg-diary-ic{ background:rgba(48,209,88,0.16); color:#5ce08a; } .hg-diary-ic svg{ width:18px; height:18px; }
.hg-diary-ev > div{ flex:1; min-width:0; } .hg-diary-ev strong{ display:block; font-size:13px; font-weight:650; } .hg-diary-ev span{ font-size:12px; color:var(--lg-ink-3); }
.hg-diary-tag{ font-size:11px !important; font-weight:650; color:var(--lg-ink-3) !important; padding:4px 10px; border-radius:999px; background:var(--lg-fill); } .hg-diary-tag.done{ color:#5ce08a !important; }

.hg-load{ display:flex; gap:7px; margin-top:18px; flex-wrap:wrap; }
.hg-load-pill{ display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:999px; padding:6px 12px; cursor:pointer; transition:background .2s, border-color .2s, color .2s; }
.hg-load-pill svg{ width:13px; height:13px; }
.hg-load-pill b{ font-weight:750; color:var(--lg-ink); }
.hg-load-pill[data-tone="danger"] svg{ color:var(--lg-danger-ink); } .hg-load-pill[data-tone="warn"] svg{ color:#ffb84d; } .hg-load-pill[data-tone="accent"] svg{ color:var(--lg-accent-ink); }
.hg-load-pill:hover{ border-color:var(--lg-ink-3); }
.hg-load-pill.on{ background:var(--lg-accent); border-color:var(--lg-accent); color:#fff; } .hg-load-pill.on svg, .hg-load-pill.on b{ color:#fff; }

.hg-worklist{ margin-top:16px; display:flex; flex-direction:column; gap:14px; }
.hg-tier-head{ display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lg-ink-3); margin-bottom:8px; }
.hg-tier-dot{ width:7px; height:7px; border-radius:50%; } .hg-tier-dot[data-tone="danger"]{ background:var(--lg-danger); } .hg-tier-dot[data-tone="warn"]{ background:var(--lg-warn); } .hg-tier-dot[data-tone="accent"]{ background:var(--lg-accent); }
.hg-tier-n{ color:var(--lg-ink-3); }
.hg-row{ display:flex; align-items:center; gap:13px; padding:12px 14px; border-radius:13px; background:var(--lg-hover); border:1px solid var(--lg-line-2); position:relative; overflow:hidden; margin-bottom:8px; transition:background .2s; }
.hg-row:hover{ background:var(--lg-fill); }
.hg-row::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--lg-ink-3); }
.hg-row[data-tone="danger"]::before{ background:var(--lg-danger); } .hg-row[data-tone="warn"]::before{ background:var(--lg-warn); } .hg-row[data-tone="accent"]::before{ background:var(--lg-accent); }
.hg-row-ic{ width:38px; height:38px; border-radius:10px; display:grid; place-items:center; background:var(--lg-fill); color:var(--lg-ink-2); flex-shrink:0; } .hg-row-ic svg{ width:18px; height:18px; }
.hg-row-body{ flex:1; min-width:0; }
.hg-row-top{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; } .hg-row-top strong{ font-size:14px; font-weight:650; } .hg-row-town{ font-size:12px; color:var(--lg-ink-3); } .hg-row-cat{ margin-left:auto; font-size:10.5px; font-weight:650; color:var(--lg-ink-3); background:var(--lg-fill); padding:2px 8px; border-radius:999px; }
.hg-row-need{ font-size:13px; color:var(--lg-ink); margin-top:3px; } .hg-row-meta{ font-size:11.5px; color:var(--lg-ink-3); margin-top:2px; }
.hg-row-act{ display:flex; align-items:center; gap:6px; flex-shrink:0; }
.hg-row-menu-wrap{ position:relative; }
.hg-row-more{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; } .hg-row-more svg{ width:16px; height:16px; }
.hg-menu{ position:absolute; top:calc(100% + 6px); right:0; z-index:20; min-width:200px; padding:6px; } .hg-menu > *{ position:relative; z-index:1; }
.hg-menu-item{ display:block; width:100%; text-align:left; font:inherit; font-size:13.5px; font-weight:500; color:var(--lg-ink); background:none; border:none; padding:9px 11px; border-radius:9px; cursor:pointer; } .hg-menu-item:hover{ background:var(--lg-hover); }
@media (max-width:620px){ .hg-row{ flex-wrap:wrap; } .hg-row-act{ width:100%; justify-content:flex-end; } .hg-row-cat{ margin-left:0; } }

/* PIPELINE */
.hg-pipe{ padding:20px 22px; } .hg-pipe > *{ position:relative; z-index:1; }
.hg-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
@media (max-width:720px){ .hg-stats{ grid-template-columns:repeat(2,1fr); } }
.hg-stat{ text-align:left; background:var(--lg-fill); border:1px solid var(--lg-line-2); border-radius:13px; padding:14px; cursor:pointer; transition:border-color .2s, transform .2s; } .hg-stat:hover{ border-color:var(--lg-ink-3); transform:translateY(-2px); }
.hg-stat-k{ display:block; font-size:12px; color:var(--lg-ink-2); font-weight:600; } .hg-stat-v{ display:block; font-size:26px; font-weight:780; letter-spacing:-.02em; margin:3px 0 2px; } .hg-stat-v[data-tone="danger"]{ color:var(--lg-danger-ink); } .hg-stat-sub{ font-size:11.5px; color:var(--lg-ink-3); }
.hg-stages{ display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-top:16px; }
@media (max-width:720px){ .hg-stages{ grid-template-columns:repeat(3,1fr); } }
.hg-stage{ border-radius:11px; padding:12px; background:var(--lg-hover); border:1px solid var(--lg-line-2); } .hg-stage[data-reached="false"]{ opacity:.5; }
.hg-stage-n{ display:block; font-size:20px; font-weight:750; } .hg-stage-l{ display:block; font-size:11.5px; font-weight:600; color:var(--lg-ink-2); margin-top:1px; } .hg-stage-s{ display:block; font-size:10.5px; color:var(--lg-ink-3); margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hg-trend{ display:flex; align-items:center; gap:20px; margin-top:16px; padding-top:16px; border-top:1px solid var(--lg-line-2); flex-wrap:wrap; }
.hg-trend-k{ font-size:12px; color:var(--lg-ink-2); } .hg-trend-v{ display:flex; align-items:baseline; gap:10px; font-size:28px; font-weight:780; } .hg-trend-up{ display:inline-flex; align-items:center; gap:3px; font-size:12.5px; font-weight:700; color:#5ce08a; } .hg-trend-up svg{ width:13px; height:13px; }
.hg-spark{ flex:1; min-width:120px; height:34px; }
.hg-trend-slas{ display:flex; gap:18px; font-size:12px; color:var(--lg-ink-2); } .hg-trend-slas b{ color:var(--lg-ink); }

.hg-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; }
@media (max-width:820px){ .hg-grid2{ grid-template-columns:1fr; } }
.hg-sub{ padding:16px 18px; } .hg-sub-empty{ display:none; }
.hg-sub-h{ font-size:13px; font-weight:700; margin-bottom:14px; }
.hg-wins{ display:flex; gap:10px; flex-wrap:wrap; } .hg-win{ flex:1; min-width:78px; background:var(--lg-hover); border:1px solid var(--lg-line-2); border-radius:11px; padding:12px; } .hg-win strong{ display:block; font-size:22px; font-weight:780; } .hg-win span{ font-size:11px; color:var(--lg-ink-3); }
.hg-fc{ display:flex; align-items:flex-end; gap:8px; height:120px; } .hg-fc-col{ flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; justify-content:flex-end; } .hg-fc-bar{ width:100%; border-radius:7px 7px 3px 3px; background:var(--lg-fill); display:grid; place-items:center; } .hg-fc-col.cur .hg-fc-bar{ background:var(--lg-accent); } .hg-fc-bar b{ font-size:12px; font-weight:750; color:var(--lg-ink-2); } .hg-fc-col.cur .hg-fc-bar b{ color:#fff; } .hg-fc-l{ font-size:10.5px; color:var(--lg-ink-2); } .hg-fc-f{ font-size:10px; color:var(--lg-ink-3); }
.hg-clients{ width:100%; border-collapse:collapse; } .hg-clients td{ padding:9px 6px; font-size:13px; border-bottom:1px solid var(--lg-line-2); } .hg-clients tr:last-child td{ border-bottom:none; } .hg-clients td:first-child{ font-weight:600; } .hg-clients td:not(:first-child){ color:var(--lg-ink-2); }
.hg-split-bar{ height:12px; border-radius:999px; background:#30c8a0; overflow:hidden; } .hg-split-bar > span{ display:block; height:100%; background:var(--lg-accent); } .hg-split-legend{ display:flex; gap:16px; margin-top:10px; font-size:12px; color:var(--lg-ink-2); } .hg-split-legend i{ display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:5px; } .hg-split-legend i.a{ background:var(--lg-accent); } .hg-split-legend i.b{ background:#30c8a0; } .hg-split-note{ font-size:11.5px; color:var(--lg-ink-3); margin-top:10px; }
.hg-acts{ display:flex; flex-direction:column; } .hg-act{ display:flex; align-items:center; gap:11px; padding:9px 0; background:none; border:none; border-top:1px solid var(--lg-line-2); cursor:pointer; text-align:left; } .hg-act:first-child{ border-top:none; } .hg-act-ic{ width:30px; height:30px; border-radius:8px; display:grid; place-items:center; background:var(--lg-fill); color:var(--lg-ink-2); flex-shrink:0; } .hg-act-ic svg{ width:15px; height:15px; } .hg-act > div{ flex:1; min-width:0; } .hg-act strong{ display:block; font-size:13px; font-weight:550; } .hg-act span{ font-size:11.5px; color:var(--lg-ink-3); } .hg-act time{ font-size:11px; color:var(--lg-ink-3); flex-shrink:0; }

/* EMPTY */
.hg-empty{ padding:36px 32px; text-align:center; margin-top:8px; } .hg-empty > *{ position:relative; z-index:1; }
.hg-empty-pill{ display:inline-block; font-size:11.5px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); padding:5px 13px; border-radius:999px; }
.hg-empty h2{ font-size:26px; font-weight:780; letter-spacing:-.025em; margin:16px 0 10px; } .hg-empty > p{ font-size:14.5px; color:var(--lg-ink-2); max-width:440px; margin:0 auto; line-height:1.5; }
.hg-empty-cta{ margin-top:20px; }
.hg-empty-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin-top:30px; border-top:1px solid var(--lg-line-2); padding-top:6px; text-align:left; }
.hg-empty-step{ padding:18px 18px 6px; } .hg-empty-step + .hg-empty-step{ border-left:1px solid var(--lg-line-2); } .hg-empty-step strong{ display:block; font-size:13.5px; font-weight:650; margin-bottom:5px; } .hg-empty-step span{ font-size:12.5px; color:var(--lg-ink-2); line-height:1.45; }
@media (max-width:720px){ .hg-empty-steps{ grid-template-columns:1fr; } .hg-empty-step + .hg-empty-step{ border-left:none; border-top:1px solid var(--lg-line-2); } }

.hg-toast{ position:fixed; z-index:70; bottom:26px; left:50%; transform:translateX(-50%); display:inline-flex; align-items:center; gap:9px; padding:11px 17px; font-size:13px; font-weight:550; } .hg-toast > *{ position:relative; z-index:1; } .hg-toast svg{ width:14px; height:14px; color:#5ce08a; }

@media (prefers-reduced-motion: reduce){ .hg-root *{ transition:none !important; } }
`;
