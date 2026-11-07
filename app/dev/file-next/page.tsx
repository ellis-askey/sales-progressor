"use client";
// File Next — isolated /dev prototype of the agent file/transaction page in the
// bench + glass language (light pearl / dark Liquid Glass). Hero, milestone strip,
// tabs, an overview with the enquiry tracker + mortgage, an activity feed, chain
// and documents, beside a rich sidebar of people, key dates and chain. Local state
// only; would-be actions surface as prototype toasts. No DB, no production code.

import { useCallback, useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Sun, MoonStars, PaperPlaneTilt, Check, SealCheck, ChatCircleDots,
  NotePencil, FileText, BellSimple, PhoneCall, Buildings,
} from "@/components/icons/ph";
import { FILE_CSS } from "./styles";
import { FILE, TABS, type TabKey, type Enquiry, type Party, type Activity } from "./mock";

const TONE: Record<string, string> = {
  coral: "var(--t-coral)", amber: "var(--t-amber)", blue: "var(--t-blue)", green: "var(--t-green)", slate: "var(--t-slate)",
};
const ACT_ICON = { note: NotePencil, reply: ChatCircleDots, doc: FileText, step: Check, alert: BellSimple, call: PhoneCall };

export default function FileNextPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FileView />;
}

function FileView() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);
  const [tab, setTab] = useState<TabKey>("overview");
  const [openEnq, setOpenEnq] = useState<string | null>("e1");
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const openEnqCount = FILE.enquiries.filter((e) => e.state !== "resolved").length;
  const counts: Record<TabKey, number | null> = { overview: openEnqCount, activity: FILE.activity.length, chain: FILE.chain.links.length, documents: FILE.documents.length };

  return (
    <div className="fn-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: FILE_CSS }} />
      <div className="fn-shell">
        <nav className="fn-dock" aria-label="Navigation">
          <div className="fn-mark" aria-hidden>s</div>
          <div className="fn-dock-rule" />
          <button className="fn-back" onClick={() => say("Prototype. Back to your files")} aria-label="Back to files"><ArrowLeft weight="bold" /></button>
          <div className="fn-dock-sp" />
          <button className="fn-theme-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} aria-label="Toggle theme">
            {theme === "dark" ? <Sun weight="fill" /> : <MoonStars weight="fill" />}
          </button>
          <button className="fn-me" onClick={() => say("Prototype. Your account")} aria-label="Account">EA</button>
        </nav>

        <div className="fn-bench">
          <Hero />
          <div className="fn-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} className="fn-tab" data-on={tab === t.key || undefined} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}{counts[t.key] != null && <span className="fn-tab-count">{counts[t.key]}</span>}
              </button>
            ))}
          </div>

          <div className="fn-body">
            <main className="fn-main" key={tab}>
              {tab === "overview" && <Overview openEnq={openEnq} onEnq={(id) => setOpenEnq((v) => (v === id ? null : id))} say={say} />}
              {tab === "activity" && <ActivityFeed />}
              {tab === "chain" && <ChainPanel />}
              {tab === "documents" && <DocumentsPanel say={say} />}
            </main>
            <div className="fn-seam" aria-hidden />
            <Sidebar say={say} />
          </div>
        </div>
      </div>

      {toast && <div className="fn-toast" role="status"><SealCheck weight="fill" />{toast}</div>}
    </div>
  );
}

function Hero() {
  return (
    <header className="fn-hero">
      <div className="fn-hero-top">
        <div style={{ minWidth: 0 }}>
          <p className="fn-crumb">Your files &rsaquo; {FILE.town}</p>
          <h1 className="fn-addr">{FILE.address}</h1>
          <p className="fn-sub">
            <span>{FILE.town} {FILE.postcode}</span><i className="fn-sub-dot" />
            <span>{FILE.service}</span><i className="fn-sub-dot" />
            <span className="fn-num">{FILE.ref}</span>
          </p>
        </div>
        <div className="fn-price"><b>{FILE.price}</b><span>{FILE.tenure}</span></div>
      </div>

      <div className="fn-plate">
        <img src={FILE.photo} alt={FILE.address} />
        <span className="fn-plate-cap" style={{ ["--tc" as string]: TONE.amber }}><i />{FILE.stage}</span>
        <span className="fn-plate-eta">{FILE.daysToExchange}</span>
      </div>

      <div className="fn-strip">
        {FILE.stages.map((s) => (
          <div key={s.key} className="fn-step" data-done={s.state === "done" || undefined} data-current={s.state === "current" || undefined}>
            <span className="fn-node" />
            <span className="fn-step-l">{s.label}</span>
            {s.when && <span className="fn-step-w">{s.when}</span>}
          </div>
        ))}
      </div>
    </header>
  );
}

function Overview({ openEnq, onEnq, say }: { openEnq: string | null; onEnq: (id: string) => void; say: (m: string) => void }) {
  return (
    <>
      <p className="fn-summary">Everything is moving, but the contract pack is held up by one enquiry. <b>Clearing it is the single thing that keeps exchange on track.</b></p>
      <div className="fn-next">
        <div className="fn-next-txt"><b>{FILE.nextAction.label}</b><span>{FILE.nextAction.context}</span></div>
        <button className="fn-primary" onClick={() => say("Prototype. A reply to the solicitor would open")}><PaperPlaneTilt weight="fill" />{FILE.nextAction.label}</button>
      </div>

      <div className="fn-sec-h"><h3>Enquiries</h3><span>{FILE.enquiries.filter((e) => e.state !== "resolved").length} open of {FILE.enquiries.length}</span></div>
      <div className="fn-enq">
        {FILE.enquiries.map((e) => <EnquiryRow key={e.id} e={e} open={openEnq === e.id} onToggle={() => onEnq(e.id)} say={say} />)}
      </div>

      <div className="fn-mortgage">
        <span className="fn-mortgage-ic"><Buildings weight="regular" /></span>
        <div><b>Mortgage · {FILE.mortgage.lender}</b><div className="fn-mortgage-sub">{FILE.mortgage.note}</div></div>
        <div className="fn-mortgage-amt"><b className="fn-num">{FILE.mortgage.amount}</b><span>{FILE.mortgage.status}</span></div>
      </div>
    </>
  );
}

function EnquiryRow({ e, open, onToggle, say }: { e: Enquiry; open: boolean; onToggle: () => void; say: (m: string) => void }) {
  const tag = e.state === "raised" ? e.waiting : e.state === "replied" ? "Replied" : "Resolved";
  return (
    <div className="fn-enq-row" data-open={open || undefined} onClick={onToggle}>
      <div className="fn-enq-head">
        <span className="fn-enq-state" data-s={e.state} />
        <div style={{ minWidth: 0 }}>
          <div className="fn-enq-title">{e.title}</div>
          <div className="fn-enq-meta">{e.detail}</div>
        </div>
        <span className="fn-enq-tag" data-s={e.state}>{tag}</span>
      </div>
      <div className="fn-enq-exp">
        <div className="fn-enq-exp-in">
          {e.thread.map((n, i) => (
            <div key={i} className="fn-note" data-side={n.side}>
              <div className="fn-note-av">{n.side === "you" ? "You" : initials(n.from)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="fn-note-h"><span className="fn-note-from">{n.from}</span><span className="fn-note-when">{n.when}</span></div>
                <div className="fn-note-body">{n.body}</div>
              </div>
            </div>
          ))}
          {e.state !== "resolved" && (
            <div className="fn-note-acts">
              <button className="fn-note-act" onClick={(ev) => { ev.stopPropagation(); say("Prototype. Reply would open"); }}>Reply</button>
              <button className="fn-note-act" onClick={(ev) => { ev.stopPropagation(); say("Prototype. Marked resolved"); }}>Mark resolved</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityFeed() {
  return (
    <>
      <div className="fn-sec-h"><h3>Activity</h3><span>Across this file</span></div>
      <div className="fn-feed">
        {FILE.activity.map((a: Activity) => {
          const Icon = ACT_ICON[a.icon];
          return (
            <div key={a.id} className="fn-fitem">
              <span className="fn-fico" data-k={a.icon}><Icon weight="regular" /></span>
              <div><div className="fn-ftext">{a.text}</div>{a.sub && <div className="fn-fsub">{a.sub}</div>}</div>
              <div className="fn-fmeta"><b>{a.who}</b>{a.when}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ChainPanel() {
  return (
    <>
      <div className="fn-sec-h"><h3>Chain</h3><span>{FILE.chain.links.length} in the chain</span></div>
      <p className="fn-chain-lede"><b>{FILE.chain.position}.</b> One sale ahead is ready; the onward purchase is still in searches.</p>
      {FILE.chain.links.map((l, i) => (
        <div key={i} className="fn-link" data-s={l.state}>
          <span className="fn-link-node">{l.state === "ok" ? <Check weight="bold" style={{ width: 12, height: 12, color: "#fff" }} /> : null}</span>
          <div><div className="fn-link-addr">{l.address}</div><div className="fn-link-role">{l.role} · {l.town}</div></div>
          <span className="fn-link-stage">{l.stage}</span>
        </div>
      ))}
    </>
  );
}

function DocumentsPanel({ say }: { say: (m: string) => void }) {
  return (
    <>
      <div className="fn-sec-h"><h3>Documents</h3><span>{FILE.documents.length} on file</span></div>
      {FILE.documents.map((d, i) => (
        <div key={i} className="fn-doc" onClick={() => say(`Prototype. Open ${d.name}`)}>
          <span className="fn-doc-ic"><FileText weight="regular" /></span>
          <div><div className="fn-doc-name">{d.name}</div><div className="fn-doc-kind">{d.kind}</div></div>
          <span className="fn-doc-when">{d.when}</span>
        </div>
      ))}
    </>
  );
}

function Sidebar({ say }: { say: (m: string) => void }) {
  return (
    <aside className="fn-side" aria-label="File details">
      <div className="fn-block">
        <p className="fn-block-h">People</p>
        {FILE.people.map((p) => <PartyRow key={p.name} p={p} say={say} />)}
      </div>

      <div className="fn-block">
        <p className="fn-block-h">Key dates</p>
        {FILE.keyDates.map((d) => (
          <div key={d.label} className="fn-date" data-emph={(d as { emphasis?: boolean }).emphasis || undefined}>
            <span className="fn-date-l">{d.label}</span><span className="fn-date-v">{d.value}</span>
          </div>
        ))}
      </div>

      <div className="fn-block">
        <p className="fn-block-h">Chain</p>
        <p className="fn-chainmini-pos"><b>{FILE.chain.position}.</b></p>
        <div className="fn-chainmini">
          {FILE.chain.links.map((l, i) => (
            <div key={i} className="fn-cm" data-s={l.state}><i /><b>{l.town}</b><span>{l.stage}</span></div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function PartyRow({ p, say }: { p: Party; say: (m: string) => void }) {
  return (
    <div className="fn-party">
      <div className="fn-party-av" style={{ background: `linear-gradient(150deg, hsl(${p.hue} 42% 93%), hsl(${p.hue} 40% 86%))`, color: `hsl(${p.hue} 46% 34%)` }}>{p.initials}</div>
      <div style={{ minWidth: 0 }}>
        <div className="fn-party-role">{p.role}{p.firm ? ` · ${p.firm}` : ""}</div>
        <div className="fn-party-name">{p.name}</div>
        <div className={`fn-party-rec fn-rc-${p.state}`}><i />{p.recency}</div>
      </div>
      <button className="fn-party-do" onClick={() => say(`Prototype. Message ${first(p.name)}`)} aria-label={`Message ${first(p.name)}`}><ChatCircleDots weight="regular" /></button>
    </div>
  );
}

function initials(name: string): string {
  const core = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((core[0]?.[0] ?? "") + (core[1]?.[0] ?? "")).toUpperCase() || "–";
}
function first(name: string): string {
  return name.replace(/\(.*?\)/g, "").trim().split(/[\s&]+/)[0] || name;
}
