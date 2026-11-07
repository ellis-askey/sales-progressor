"use client";
// File Next — the real file page's density, re-skinned in the bench + glass
// language. Nothing stripped: app nav, top bar, full hero meta, 7-step strip,
// contacts with actions, sale-health scoring, chain cards, key dates, agent, fees,
// enquiries, activity, property data. Local state only; actions surface as toasts.

import { useCallback, useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import {
  Plus, House, Target, BellSimple, ChatCircleDots, CheckCircle, ListChecks, ArrowsClockwise,
  EnvelopeSimple, FolderOpen, LinkSimple, ChartBar, Gear, Handshake, Coins, Key, CalendarBlank,
  MagnifyingGlass, CaretDown, Sun, MoonStars, ArrowLeft, Warning, PhoneCall, PaperPlaneTilt,
  NotePencil, FileText, Check, SealCheck, Heartbeat,
} from "@/components/icons/ph";
import { FILE_CSS } from "./styles";
import { FILE, NAV, TABS, type TabKey, type Enquiry, type Contact, type Activity } from "./mock";

const NAV_ICON: Record<string, typeof House> = {
  plus: Plus, house: House, target: Target, bell: BellSimple, chat: ChatCircleDots, check: CheckCircle,
  list: ListChecks, refresh: ArrowsClockwise, mail: EnvelopeSimple, folder: FolderOpen, link: LinkSimple,
  chart: ChartBar, gear: Gear, handshake: Handshake,
};
const META_ICON: Record<string, typeof House> = { coins: Coins, key: Key, house: House, calendar: CalendarBlank };
const ACT_ICON = { note: NotePencil, reply: ChatCircleDots, doc: FileText, step: Check, alert: BellSimple, call: PhoneCall };

export default function FileNextPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FileView />;
}

function FileView() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => { if (typeof window !== "undefined" && window.matchMedia) setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }, []);
  const [tab, setTab] = useState<TabKey>("overview");
  const [openEnq, setOpenEnq] = useState<string | null>("e1");
  const [cside, setCside] = useState<"clients" | "pros">("clients");
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((m: string) => { setToast(m); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 3400); }, []);

  const openEnqCount = FILE.enquiries.filter((e) => e.state !== "resolved").length;
  const counts: Record<TabKey, number | null> = { overview: openEnqCount, chain: FILE.chain.cards.length, activity: FILE.activity.length, property: null };

  return (
    <div className="fn-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: FILE_CSS }} />
      <div className="fn-app">
        <nav className="fn-nav" aria-label="Main">
          <div className="fn-brand"><span className="fn-brand-mark"><CheckCircle weight="fill" /></span><b>Sales Progressor</b></div>
          <button className="fn-navnew" onClick={() => say("Prototype. New sale")}><Plus weight="bold" />New sale</button>
          {NAV.filter((n) => !("primary" in n && n.primary)).map((n) => {
            const Icon = NAV_ICON[n.icon];
            return (
              <button key={n.key} className="fn-navitem" data-on={("active" in n && n.active) || undefined} onClick={() => say(`Prototype. ${n.label}`)}>
                <Icon weight="regular" />{n.label}
                {"count" in n && n.count ? <span className="fn-navitem-count">{n.count}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="fn-content">
          <div className="fn-topbar">
            <label className="fn-search"><MagnifyingGlass weight="regular" /><input placeholder="Search" /><kbd>⌘K</kbd></label>
            <div className="fn-topsp" />
            <span className="fn-asof">As of 16:55</span>
            <button className="fn-iconbtn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} aria-label="Theme">{theme === "dark" ? <Sun weight="fill" /> : <MoonStars weight="fill" />}</button>
            <button className="fn-iconbtn" onClick={() => say("Prototype. Notifications")} aria-label="Notifications"><BellSimple weight="regular" /></button>
            <button className="fn-user" onClick={() => say("Prototype. Account")}><span className="fn-user-av">EA</span><span>Ellis Askey</span><CaretDown weight="bold" /></button>
          </div>

          <div className="fn-bench">
            <Hero say={say} />
            <div className="fn-banner"><Warning weight="fill" /><div><b>{FILE.banner.title}</b><span>{FILE.banner.body}</span></div></div>
            <div className="fn-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} className="fn-tab" data-on={tab === t.key || undefined} role="tab" onClick={() => setTab(t.key)}>
                  {t.label}{counts[t.key] != null && <span className="fn-tab-count">{counts[t.key]}</span>}
                </button>
              ))}
            </div>

            <div className="fn-body">
              <main className="fn-main" key={tab}>
                {tab === "overview" && <Overview openEnq={openEnq} onEnq={(id) => setOpenEnq((v) => (v === id ? null : id))} cside={cside} setCside={setCside} say={say} />}
                {tab === "chain" && <ChainPanel say={say} />}
                {tab === "activity" && <ActivityPanel say={say} />}
                {tab === "property" && <PropertyPanel />}
              </main>
              <div className="fn-seam" aria-hidden />
              <Sidebar say={say} />
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="fn-toast" role="status"><SealCheck weight="fill" />{toast}</div>}
    </div>
  );
}

function Hero({ say }: { say: (m: string) => void }) {
  return (
    <header className="fn-hero">
      <div className="fn-hero-grid">
        <div className="fn-photo">
          <img src={FILE.photo} alt={FILE.address} />
          <button className="fn-photo-back" onClick={() => say("Prototype. Back to files")}><ArrowLeft weight="bold" />Back to files</button>
        </div>
        <div className="fn-hero-info">
          <div className="fn-hero-top">
            <span className="fn-status"><i />{FILE.status}</span>
            <div className="fn-pct"><b className="fn-num">{FILE.pct}% complete</b><div className="fn-pct-bar"><i style={{ width: `${FILE.pct}%` }} /></div></div>
          </div>
          <h1 className="fn-addr">{FILE.address}</h1>
          <p className="fn-addr-sub">{FILE.town}, {FILE.postcode}</p>
          <div className="fn-meta">
            {FILE.meta.map((m) => {
              const Icon = META_ICON[m.icon];
              return <div key={m.label} className="fn-meta-item"><span className="fn-meta-ic"><Icon weight="regular" /></span><div><div className="fn-meta-l">{m.label}</div><div className="fn-meta-v">{m.value}</div></div></div>;
            })}
          </div>
          <div className="fn-hero-foot">
            <div className="fn-managing"><span className="fn-managing-av">EA</span><div><b>{FILE.managing.name}</b><span>{FILE.managing.sub}</span></div></div>
            <div className="fn-onfile"><b>{FILE.onFile.weeks}</b> · {FILE.onFile.added}</div>
            <span className="fn-managedby">{FILE.managedBy}</span>
          </div>
        </div>
      </div>

      <div className="fn-strip">
        {FILE.stages.map((s) => (
          <div key={s.key} className="fn-step" data-done={s.state === "done" || undefined} data-current={s.state === "current" || undefined}>
            <span className="fn-stepnode">{s.state === "done" ? <Check weight="bold" /> : s.n}</span>
            <span className="fn-step-l">{s.label}</span>
            {s.when && <span className="fn-step-w">{s.when}</span>}
          </div>
        ))}
      </div>
    </header>
  );
}

function Overview({ openEnq, onEnq, cside, setCside, say }: {
  openEnq: string | null; onEnq: (id: string) => void; cside: "clients" | "pros"; setCside: (v: "clients" | "pros") => void; say: (m: string) => void;
}) {
  return (
    <>
      <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55, margin: "0 0 18px", maxWidth: "60ch" }}>{FILE.summary} <b style={{ color: "var(--ink)", fontWeight: 650 }}>Clearing the FENSA enquiry is the single thing that keeps exchange on track.</b></p>
      <div className="fn-next">
        <div className="fn-next-txt"><b>{FILE.nextAction.label}</b><span>{FILE.nextAction.context}</span></div>
        <button className="fn-primary" onClick={() => say("Prototype. Reply would open")}><PaperPlaneTilt weight="fill" />{FILE.nextAction.label}</button>
      </div>

      <div className="fn-sec-h"><h3>Contacts</h3><span>{FILE.contacts.length + FILE.professionals.length} people on this file</span></div>
      <div className="fn-ctoggle">
        <button data-on={cside === "clients" || undefined} onClick={() => setCside("clients")}>Clients</button>
        <button data-on={cside === "pros" || undefined} onClick={() => setCside("pros")}>Professionals</button>
      </div>
      {cside === "clients"
        ? FILE.contacts.map((c) => <ContactRow key={c.name} c={c} say={say} />)
        : FILE.professionals.map((p) => <ContactRow key={p.name} c={{ name: p.name, role: p.role as unknown as Contact["role"], initials: p.initials, hue: p.hue, state: p.state as Contact["state"] }} sub={p.firm} say={say} />)}

      <div className="fn-sp24" />
      <div className="fn-sec-h"><h3>Enquiries</h3><span>{FILE.enquiries.filter((e) => e.state !== "resolved").length} open of {FILE.enquiries.length}</span></div>
      {FILE.enquiries.map((e) => <EnquiryRow key={e.id} e={e} open={openEnq === e.id} onToggle={() => onEnq(e.id)} say={say} />)}
    </>
  );
}

function ContactRow({ c, sub, say }: { c: Contact; sub?: string; say: (m: string) => void }) {
  return (
    <div className="fn-contact">
      <div className="fn-contact-av" style={{ background: `linear-gradient(150deg, hsl(${c.hue} 42% 93%), hsl(${c.hue} 40% 86%))`, color: `hsl(${c.hue} 46% 34%)` }}>
        {c.initials}<i className={`fn-rc-${c.state}`} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="fn-contact-role">{sub ? `${c.role} · ${sub}` : c.role}</div>
        <div className="fn-contact-name">{c.name}</div>
        {c.phone && <div className="fn-contact-phone fn-num">{c.phone}</div>}
      </div>
      <div className="fn-contact-acts">
        <button className="fn-cact" onClick={() => say(`Prototype. Call ${c.name}`)} aria-label="Call"><PhoneCall weight="regular" /></button>
        <button className="fn-cact" onClick={() => say(`Prototype. Message ${c.name}`)} aria-label="Message"><ChatCircleDots weight="regular" /></button>
        <button className="fn-cact" onClick={() => say(`Prototype. Email ${c.name}`)} aria-label="Email"><EnvelopeSimple weight="regular" /></button>
      </div>
    </div>
  );
}

function EnquiryRow({ e, open, onToggle, say }: { e: Enquiry; open: boolean; onToggle: () => void; say: (m: string) => void }) {
  const tag = e.state === "raised" ? e.waiting : e.state === "replied" ? "Replied" : "Resolved";
  return (
    <div className="fn-enq-row" data-open={open || undefined} onClick={onToggle}>
      <div className="fn-enq-head">
        <span className="fn-enq-state" data-s={e.state} />
        <div style={{ minWidth: 0 }}><div className="fn-enq-title">{e.title}</div><div className="fn-enq-meta">{e.detail}</div></div>
        <span className="fn-enq-tag" data-s={e.state}>{tag}</span>
      </div>
      <div className="fn-enq-exp"><div className="fn-enq-exp-in">
        {e.thread.map((n, i) => (
          <div key={i} className="fn-note" data-side={n.side}>
            <div className="fn-note-av">{n.side === "you" ? "You" : initials(n.from)}</div>
            <div style={{ minWidth: 0 }}><div className="fn-note-h"><span className="fn-note-from">{n.from}</span><span className="fn-note-when">{n.when}</span></div><div className="fn-note-body">{n.body}</div></div>
          </div>
        ))}
        {e.state !== "resolved" && <div className="fn-note-acts"><button className="fn-note-act" onClick={(ev) => { ev.stopPropagation(); say("Prototype. Reply"); }}>Reply</button><button className="fn-note-act" onClick={(ev) => { ev.stopPropagation(); say("Prototype. Marked resolved"); }}>Mark resolved</button></div>}
      </div></div>
    </div>
  );
}

function ChainPanel({ say }: { say: (m: string) => void }) {
  return (
    <>
      <div className="fn-sec-h"><h3>Property chain</h3><span className="fn-link-act" onClick={() => say("Prototype. Open chain")}>Open chain</span></div>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 16px" }}><b style={{ color: "var(--ink)", fontWeight: 650 }}>{FILE.chain.position}.</b> One sale ahead is ready to exchange; the onward purchase is still in searches.</p>
      <div className="fn-chaincards">
        {FILE.chain.cards.map((c, i) => (
          <div key={i} className="fn-cc" data-s={c.state} onClick={() => say(`Prototype. Open ${c.address}`)}>
            <img src={c.photo} alt="" /><span className="fn-cc-tag">{c.tag}</span><span className="fn-cc-pct fn-num">{c.pct}%</span>
            <div className="fn-cc-in"><div className="fn-cc-addr">{c.address}</div><div className="fn-cc-sub">{c.sub}</div></div>
          </div>
        ))}
      </div>
    </>
  );
}

function ActivityPanel({ say }: { say: (m: string) => void }) {
  return (
    <>
      <div className="fn-sec-h"><h3>Activity &amp; notes</h3><span className="fn-link-act" onClick={() => say("Prototype. Log an update")}>Log an update</span></div>
      <div className="fn-feed">
        {FILE.activity.map((a: Activity) => { const Icon = ACT_ICON[a.icon]; return (
          <div key={a.id} className="fn-fitem"><span className="fn-fico" data-k={a.icon}><Icon weight="regular" /></span>
            <div><div className="fn-ftext">{a.text}</div>{a.sub && <div className="fn-fsub">{a.sub}</div>}</div>
            <div className="fn-fmeta"><b>{a.who}</b>{a.when}</div>
          </div>
        ); })}
      </div>
    </>
  );
}

function PropertyPanel() {
  const p = FILE.property;
  return (
    <>
      <div className="fn-sec-h"><h3>Property</h3><span>{FILE.address}</span></div>
      <div className="fn-pdata">
        <div className="fn-prow"><span>Floor area</span><b>{p.floorArea}</b></div>
        <div className="fn-prow"><span>Local authority</span><b>{p.localAuthority}</b></div>
        <div className="fn-prow"><span>Council tax</span><b>{p.councilTax}</b></div>
        <div className="fn-psource">Sources: {p.sources}</div>
      </div>
    </>
  );
}

function Sidebar({ say }: { say: (m: string) => void }) {
  const h = FILE.saleHealth;
  return (
    <aside className="fn-side" aria-label="File details">
      <div className="fn-block">
        <p className="fn-block-h"><Heartbeat weight="regular" />Sale health<span className="fn-health-status">{h.status}</span></p>
        {h.metrics.map((m) => <div key={m.label} className="fn-metric"><span>{m.label}</span><b>{m.value}</b></div>)}
        <div className="fn-scorebar"><i className="s-coral" style={{ width: "72%" }} /><i className="s-amber" style={{ width: "28%" }} /></div>
        {h.score.map((s) => <div key={s.label} className="fn-scoreitem"><i className={`s-${s.tone}`} /><div><b>{s.label}</b><span>{s.sub}</span></div><em>{s.points}</em></div>)}
      </div>

      <div className="fn-block">
        <p className="fn-block-h"><CalendarBlank weight="regular" />Key dates</p>
        {FILE.keyDates.map((d) => <div key={d.label} className="fn-date" data-emph={d.emph || undefined}><span className="fn-date-l">{d.label}</span><span className="fn-date-v">{d.value}</span></div>)}
        <p className="fn-note-sm">{FILE.keyDatesNote}</p>
      </div>

      <div className="fn-block">
        <p className="fn-block-h"><Handshake weight="regular" />Agent</p>
        <div className="fn-agent"><span className="fn-agent-av">{initials(FILE.agent.name)}</span><div><b>{FILE.agent.name}</b><span>{FILE.agent.firm}</span></div></div>
        <div className="fn-agent-email">{FILE.agent.email}</div>
        <button className="fn-msgbtn" onClick={() => say("Prototype. Message agent")}><EnvelopeSimple weight="regular" />Message agent</button>
      </div>

      <div className="fn-block">
        <p className="fn-block-h"><Coins weight="regular" />Fees</p>
        {FILE.fees.map((f) => <div key={f.label} className="fn-date"><span className="fn-date-l">{f.label}</span><span className="fn-date-v fn-num">{f.value}</span></div>)}
      </div>
    </aside>
  );
}

function initials(name: string): string {
  const core = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((core[0]?.[0] ?? "") + (core[1]?.[0] ?? "")).toUpperCase() || "–";
}
