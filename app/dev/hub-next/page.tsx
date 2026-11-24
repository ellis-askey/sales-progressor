"use client";
// /dev/hub-next — a Liquid-Glass reimagining of the TSP Agent Hub. EXPERIMENT ONLY.
// Sample data, no live reads/writes. Reuses the approved optical engine (LiquidLens)
// + the candidate components in components/liquid/ui (read-only). Dev-only route.

import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, PaperPlaneTilt, ArrowRight, X, CaretRight, Clock, CheckCircle,
  CalendarCheck, ChatCircle, House, DotsThree, Note,
} from "@phosphor-icons/react";
import {
  GLASS_CSS, cn, ThemeCtx, type Theme, Surface, TravellingSelection,
  Button, Dialog, Drawer, DropdownMenu, EmptyState, ToastProvider, useToast,
} from "@/components/liquid/ui";
import { LiquidLens } from "@/components/liquid/LiquidLens";
import { extractFirstName } from "@/lib/contacts/displayName";
import "@/app/styles/liquid-glass.css";
import { FILES, STAGES, FORECAST, ACTIVITY, ATTENTION_IDS, fmtFee, pipelineValuePence, activeCount, exchangingCount, type FileItem, type Tone, type Stage } from "./data";
import { HUB_CSS } from "./styles";

type Filter = "all" | "needs" | "exchanging" | "completing";

export default function HubNext() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  return (
    <ThemeCtx.Provider value={theme}>
      <ToastProvider>
        <div className="lg-ds hub-root" data-theme={theme}>
          <style dangerouslySetInnerHTML={{ __html: GLASS_CSS + HUB_CSS }} />
          <div className="hub-aurora" aria-hidden />
          <Hub theme={theme} setTheme={setTheme} />
        </div>
      </ToastProvider>
    </ThemeCtx.Provider>
  );
}

function Hub({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("needs");
  const [stage, setStage] = useState<Stage | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const [compose, setCompose] = useState(false);

  const list = useMemo(() => {
    let l = FILES;
    if (filter === "needs") l = FILES.filter((f) => ATTENTION_IDS.includes(f.id));
    else if (filter === "exchanging") l = FILES.filter((f) => f.stage === "Exchange");
    else if (filter === "completing") l = FILES.filter((f) => f.stage === "Completion");
    if (stage) l = l.filter((f) => f.stage === stage);
    return l;
  }, [filter, stage]);

  const selFile = FILES.find((f) => f.id === sel) ?? null;
  const needsCount = ATTENTION_IDS.length;

  return (
    <div className="hub-wrap">
      {/* hero */}
      <header className="hub-hero">
        <div>
          <p className="hub-greet">Good morning, Ellis</p>
          <h1>{needsCount} sales need you today<span className="hub-dim"> — two exchanges land this week.</span></h1>
        </div>
        <div className="hub-hero-r">
          <span className="hub-asof"><Clock weight="regular" /> As of 09:12</span>
          <button className={cn("hub-theme", theme === "light" && "on")} aria-label="Toggle light and dark" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <span className="hub-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </div>
      </header>

      {/* pulse — frosted glass bar over the aurora */}
      <Surface material="frost" radius={18} className="hub-pulse">
        <Stat n={String(activeCount)} label="Active sales" />
        <Stat n={String(needsCount)} label="Need you" accent />
        <Stat n={String(exchangingCount)} label="Exchanging soon" />
        <Stat n={fmtFee(pipelineValuePence)} label="Pipeline value" />
      </Surface>

      {/* pipeline stage band */}
      <div className="hub-stages">
        {STAGES.map((s) => (
          <button key={s.stage} className={cn("hub-stage", stage === s.stage && "on")} onClick={() => setStage(stage === s.stage ? null : s.stage)}>
            <span className="hub-stage-n">{s.count}</span><span className="hub-stage-l">{s.stage}</span>
          </button>
        ))}
      </div>

      {/* filter + list */}
      <div className="hub-main">
        <div className="hub-mainhead">
          <TravellingSelection variant="segmented" ariaLabel="View" value={filter} onChange={(v) => { setFilter(v as Filter); setStage(null); }} items={[{ value: "all", label: "All" }, { value: "needs", label: needsCount > 0 ? `Needs you · ${needsCount}` : "Needs you" }, { value: "exchanging", label: "Exchanging" }, { value: "completing", label: "Completing" }]} />
          {stage && <button className="hub-clear" onClick={() => setStage(null)}>{stage} <X weight="bold" /></button>}
        </div>

        {list.length === 0 ? (
          <Surface material="solid" radius={16}><EmptyState title="Nothing here" body="No sales match this view right now." /></Surface>
        ) : (
          <div className="hub-rows">
            {list.map((f) => <FileRow key={f.id} f={f} selected={sel === f.id} onSelect={() => setSel(sel === f.id ? null : f.id)} needs={filter === "needs" || ATTENTION_IDS.includes(f.id)} onOpen={() => { setSel(f.id); setDetail(true); }} />)}
          </div>
        )}
      </div>

      {/* lower: forecast + activity */}
      <div className="hub-lower">
        <Surface material="solid" radius={18} className="hub-panel">
          <h3>Exchange forecast</h3>
          <p className="hub-panel-sub">Expected exchanges over the next six weeks.</p>
          <Forecast />
          <div className="hub-fc-sum"><strong>{FORECAST.reduce((s, w) => s + w.n, 0)}</strong> exchanges forecast · two land this week</div>
        </Surface>
        <Surface material="solid" radius={18} className="hub-panel">
          <h3>Recent activity</h3>
          <div className="hub-feed">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="hub-event">
                <span className={cn("hub-ava", `hub-ava-${a.role}`)}>{a.who === "You" ? "Y" : a.who.slice(0, 1)}</span>
                <div><p>{a.text}</p><span>{a.file} · {a.at}</span></div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      {/* floating refractive action bar — the one genuine-glass hero moment */}
      {selFile && !detail && (
        <div className="hub-actionwrap">
          <LiquidLens radius={16} strength="strong" thickness={1.5} tint="rgba(14,18,28,0.52)" className="hub-actionbar">
            <span className="hub-ab-name">{selFile.line}</span>
            <span className="hub-ab-sep" />
            <button className="hub-ab-btn" onClick={() => setCompose(true)}><PaperPlaneTilt weight="fill" /> Chase</button>
            <button className="hub-ab-btn" onClick={() => setCompose(true)}><ChatCircle weight="fill" /> Compose</button>
            <button className="hub-ab-btn" onClick={() => setDetail(true)}>Details <ArrowRight weight="bold" /></button>
            <button className="hub-ab-x" aria-label="Clear" onClick={() => setSel(null)}><X weight="bold" /></button>
          </LiquidLens>
        </div>
      )}

      {/* detail drawer */}
      <Drawer open={detail} onClose={() => setDetail(false)} eyebrow={selFile?.stage} title={selFile?.line ?? ""}
        footer={<><Button variant="ghost" onClick={() => setDetail(false)}>Close</Button><Button variant="primary" onClick={() => setCompose(true)}><PaperPlaneTilt weight="fill" /> Chase</Button></>}>
        {selFile && <FileDetail f={selFile} onAct={(m) => toast({ text: m, tone: "info" })} />}
      </Drawer>

      {/* compose modal (sample — no send) */}
      <Dialog open={compose} onClose={() => setCompose(false)} eyebrow="Compose" title={selFile ? `Email · ${selFile.line}` : "Email"}
        footer={<><Button variant="ghost" onClick={() => setCompose(false)}>Cancel</Button><Button variant="primary" onClick={() => { setCompose(false); toast({ title: "Preview only", body: "This experiment doesn't send mail.", tone: "warn" }); }}><PaperPlaneTilt weight="fill" /> Send</Button></>}>
        <div className="hub-compose">
          <label>To</label><div className="hub-cfield">{selFile?.party[0]?.name ?? "Recipient"}</div>
          <label>Subject</label><div className="hub-cfield">Update on {selFile?.line}</div>
          <label>Message</label><div className="hub-cbody">Dear {selFile?.party[0] ? extractFirstName(selFile.party[0].name) : "all"},<br /><br />A quick update on your sale…</div>
          <p className="hub-cnote">Sample composer — no email is sent in this experiment.</p>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ n, label, accent }: { n: string; label: string; accent?: boolean }) {
  return <div className="hub-stat"><span className={cn("hub-stat-n", accent && "accent")}>{n}</span><span className="hub-stat-l">{label}</span></div>;
}

const toneClass = (t: Tone) => `hub-t-${t}`;
function FileRow({ f, selected, onSelect, needs, onOpen }: { f: FileItem; selected: boolean; onSelect: () => void; needs: boolean; onOpen: () => void }) {
  return (
    <div className={cn("hub-row", selected && "sel")} onClick={onSelect}>
      <span className="hub-thumb" style={{ background: f.photo }} />
      <div className="hub-row-main">
        <div className="hub-row-top"><p className="hub-row-line">{f.line}</p><span className="hub-row-loc">{f.loc}</span></div>
        {needs ? <p className={cn("hub-row-reason", toneClass(f.dueTone))}>{f.next}</p> : <p className="hub-row-status"><span className={cn("hub-dot", toneClass(f.statusTone))} />{f.status}</p>}
      </div>
      <div className="hub-row-right" onClick={(e) => e.stopPropagation()}>
        {f.due && <span className={cn("hub-due", toneClass(f.dueTone))}>{f.due}</span>}
        <DropdownMenu align="end" label={<span className="hub-rowmenu"><DotsThree weight="bold" /></span>} items={[{ label: "Chase", icon: <PaperPlaneTilt weight="regular" /> }, { label: "Add a note", icon: <Note weight="regular" /> }, { label: "Open file", icon: <House weight="regular" /> }]} />
        <button className="hub-open" aria-label="Open" onClick={onOpen}><CaretRight weight="bold" /></button>
      </div>
    </div>
  );
}

function FileDetail({ f, onAct }: { f: FileItem; onAct: (m: string) => void }) {
  return (
    <div className="hub-detail">
      <div className="hub-detail-hero" style={{ background: f.photo }}><div className="hub-detail-heroi"><strong>{f.line}</strong><span>{f.loc}</span></div></div>
      <div className="hub-detail-meta">
        <div><span className="hub-meta-l">Stage</span><span className="hub-meta-v">{f.stage}</span></div>
        <div><span className="hub-meta-l">Fee</span><span className="hub-meta-v">{fmtFee(f.feePence)}</span></div>
        <div><span className="hub-meta-l">Chain</span><span className="hub-meta-v">{f.chain} {f.chain === 1 ? "party" : "parties"}</span></div>
      </div>
      <div className="hub-detail-sec">
        <h4>Progress</h4>
        <div className="hub-prog"><span className="hub-prog-bar" style={{ width: `${f.progressPct}%` }} /></div>
        <ol className="hub-ms">
          {f.milestones.map((m, i) => (
            <li key={i} className={cn(m.done && "done", m.current && "current")}>
              {m.done ? <CheckCircle weight="fill" /> : m.current ? <CalendarCheck weight="fill" /> : <span className="hub-ms-dot" />}
              {m.label}
            </li>
          ))}
        </ol>
      </div>
      <div className="hub-detail-sec">
        <h4>People</h4>
        <div className="hub-people">{f.party.map((p, i) => <div key={i} className="hub-person"><span className="hub-ava hub-ava-sol">{p.name.slice(0, 1)}</span><div><b>{p.name}</b><span>{p.role}</span></div></div>)}</div>
      </div>
      <div className="hub-detail-actions">
        <Button variant="secondary" full onClick={() => onAct("Added a note (sample)")}><Note weight="regular" /> Add a note</Button>
        <Button variant="secondary" full onClick={() => onAct("Opened file (sample)")}><House weight="regular" /> Open file</Button>
      </div>
    </div>
  );
}

function Forecast() {
  const max = Math.max(...FORECAST.map((w) => w.n), 1);
  return (
    <div className="hub-forecast">
      {FORECAST.map((w, i) => (
        <div key={i} className="hub-fc-col">
          <div className="hub-fc-bar-wrap"><span className="hub-fc-bar" style={{ height: `${(w.n / max) * 100}%` }}><em>{w.n}</em></span></div>
          <span className="hub-fc-lab">{w.wk}</span>
        </div>
      ))}
    </div>
  );
}
