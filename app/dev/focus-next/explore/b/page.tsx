"use client";
// Direction B — "Command Surface". The whole book at a glance as a packed pressure
// grid: cell size + tint = urgency. Scan everything in one view; click to expand a
// focused panel. Cool, dense, premium. Spatial, not a list or master-detail.
import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { EnvelopeSimple, PhoneCall, X, Check } from "@/components/icons/ph";
import { SALES, type Sale, type Side, rel, sideCovered, attentionScore } from "../../mock";
import { who, first, sideStatus, headline, CH, STATE_LABEL, dirWord } from "../../common";

type Size = "xl" | "lg" | "md" | "sm";
const sizeOf = (score: number): Size => score >= 120 ? "xl" : score >= 60 ? "lg" : score > 0 ? "md" : "sm";

export default function CommandB() {
  if (process.env.NODE_ENV === "production") notFound();
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(JSON.stringify(SALES)));
  const [open, setOpen] = useState<string | null>(null);
  const cov = useMemo(() => { let t = 0, d = 0; for (const s of sales) for (const p of [s.vendor, s.purchaser]) { if (!p) continue; t++; if (sideCovered(p)) d++; } return { t, d, pct: t ? Math.round(d / t * 100) : 0 }; }, [sales]);
  const cells = useMemo(() => sales.map((s) => ({ s, score: attentionScore(s) })).sort((a, b) => b.score - a.score), [sales]);
  const sel = sales.find((s) => s.id === open) ?? null;

  const mark = (sale: Sale, side: Side) => setSales((cur) => cur.map((s) => s.id !== sale.id ? s : { ...s, [side.kind === "vendor" ? "vendor" : "purchaser"]: { ...side, touchedThisWeek: true, parked: false } }));

  return (
    <div className="cb-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="cb-top">
        <div className="cb-brand"><span className="cb-dot" />Focus <em>command</em></div>
        <div className="cb-cov">
          <div className="cb-cov-bar"><i style={{ width: `${cov.pct}%` }} /></div>
          <span className="cb-cov-t"><b>{cov.d}</b> of {cov.t} contacted this week</span>
        </div>
        <div className="cb-legend"><span><i className="cb-l-d" />urgent</span><span><i className="cb-l-w" />waiting</span><span><i className="cb-l-o" />healthy</span></div>
      </header>

      <div className="cb-grid">
        {cells.map(({ s, score }) => <Cell key={s.id} sale={s} size={sizeOf(score)} onClick={() => setOpen(s.id)} />)}
      </div>

      {sel && <Panel sale={sel} onClose={() => setOpen(null)} onMark={mark} />}
    </div>
  );
}

function Cell({ sale, size, onClick }: { sale: Sale; size: Size; onClick: () => void }) {
  const h = headline(sale);
  const tone = h?.tone ?? "ok";
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  return (
    <button className={`cb-cell cb-${size} cb-t-${tone}`} onClick={onClick}>
      <div className="cb-cell-top">
        <span className="cb-addr">{sale.line1}</span>
        <span className="cb-town">{sale.town}</span>
      </div>
      {(size === "xl" || size === "lg") && h && <span className="cb-issue">{h.text}</span>}
      <div className="cb-pips">
        {sides.map((s) => { const st = sideStatus(s); return <span key={s.kind} className={`cb-pip cb-p-${sideCovered(s) ? "ok" : st.tone}`}>{s.kind === "vendor" ? "S" : "B"}</span>; })}
        {size !== "sm" && <span className="cb-when">{sides.map((s) => sideStatus(s).short).join(" · ")}</span>}
      </div>
    </button>
  );
}

function Panel({ sale, onClose, onMark }: { sale: Sale; onClose: () => void; onMark: (s: Sale, side: Side) => void }) {
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  return (
    <div className="cb-scrim" onClick={onClose}>
      <div className="cb-panel" onClick={(e) => e.stopPropagation()}>
        <button className="cb-close" onClick={onClose} aria-label="Close"><X weight="bold" /></button>
        <h2 className="cb-p-addr">{sale.line1}</h2>
        <p className="cb-p-meta">{sale.town} {sale.postcode} · {sale.stage}</p>
        {sale.concerns.map((c, i) => <p key={i} className={`cb-p-con cb-t-${c.tone}`}>{c.title} <span>{c.detail}</span></p>)}
        <div className="cb-p-sides">
          {sides.map((s) => { const st = sideStatus(s); const comms = [...s.comms].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 3); return (
            <div key={s.kind} className="cb-p-side">
              <div className="cb-p-sh"><span className="cb-p-role">{who(s)}</span><span className="cb-p-name">{s.names}</span></div>
              <p className={`cb-p-st cb-t-${st.tone}`}>{st.text}</p>
              <div className="cb-p-thread">{comms.length ? comms.map((m, i) => { const I = CH[m.channel]; return (
                <div key={i} className="cb-p-te"><I weight="regular" /><span className="cb-p-tt">{m.subject ?? m.preview}</span><span className="cb-p-tw">{dirWord(m)} · {STATE_LABEL[m.state]} · {rel(m.daysAgo)}</span></div>
              ); }) : <p className="cb-p-none">No contact yet.</p>}</div>
              {sideCovered(s) ? <p className="cb-p-done"><Check weight="bold" /> {s.parked ? "Set aside" : "Contacted"} this week</p> : (
                <div className="cb-p-acts"><button className="cb-p-prim" onClick={() => onMark(sale, s)}><EnvelopeSimple weight="fill" /> Email {first(s.names)}</button><button className="cb-p-sec" onClick={() => onMark(sale, s)}><PhoneCall weight="regular" /> Log call</button></div>
              )}
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cb-root { min-height: 100vh; background: radial-gradient(130% 100% at 50% -10%, #11162a, #080a12 60%); color: #e7ebf5; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; padding: 22px; }
.cb-root ::selection { background: rgba(110,160,255,0.3); }
.cb-top { display: flex; align-items: center; gap: 32px; max-width: 1500px; margin: 0 auto 20px; }
.cb-brand { font-size: 15px; font-weight: 650; letter-spacing: -0.01em; display: flex; align-items: center; gap: 10px; } .cb-brand em { color: #7d8aa8; font-style: normal; font-weight: 500; }
.cb-dot { width: 9px; height: 9px; border-radius: 50%; background: #6ea0ff; box-shadow: 0 0 14px #6ea0ff; }
.cb-cov { flex: 1; max-width: 420px; }
.cb-cov-bar { height: 4px; border-radius: 99px; background: rgba(255,255,255,0.08); overflow: hidden; margin-bottom: 7px; }
.cb-cov-bar i { display: block; height: 100%; background: linear-gradient(90deg, #6ea0ff, #9b8cff); border-radius: 99px; transition: width 0.6s; }
.cb-cov-t { font-size: 12px; color: #8793ad; } .cb-cov-t b { color: #e7ebf5; font-variant-numeric: tabular-nums; }
.cb-legend { margin-left: auto; display: flex; gap: 16px; font-size: 11.5px; color: #8793ad; }
.cb-legend span { display: inline-flex; align-items: center; gap: 6px; }
.cb-legend i { width: 9px; height: 9px; border-radius: 3px; } .cb-l-d { background: #ff7a59; } .cb-l-w { background: #f0b14e; } .cb-l-o { background: #4a6a8f; }
.cb-grid { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: 118px; grid-auto-flow: dense; gap: 12px; }
.cb-cell { text-align: left; border: none; cursor: pointer; border-radius: 16px; padding: 15px 16px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; position: relative; color: inherit;
  background: #141a2b; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05); transition: transform 0.18s cubic-bezier(0.3,1,0.4,1), box-shadow 0.18s, filter 0.18s; }
.cb-cell:hover { transform: translateY(-3px); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1), 0 16px 40px rgba(0,0,0,0.5); filter: brightness(1.08); }
.cb-xl { grid-column: span 3; grid-row: span 2; } .cb-lg { grid-column: span 2; grid-row: span 2; } .cb-md { grid-column: span 2; grid-row: span 1; } .cb-sm { grid-column: span 1; grid-row: span 1; }
.cb-t-danger { background: linear-gradient(150deg, #37201c, #1a1620); box-shadow: inset 0 0 0 1px rgba(255,122,89,0.3); }
.cb-t-warn { background: linear-gradient(150deg, #2e271a, #18151e); box-shadow: inset 0 0 0 1px rgba(240,177,78,0.26); }
.cb-t-info { background: linear-gradient(150deg, #1c2538, #141620); box-shadow: inset 0 0 0 1px rgba(110,160,255,0.26); }
.cb-cell-top { display: flex; flex-direction: column; gap: 1px; }
.cb-addr { font-size: 14.5px; font-weight: 650; letter-spacing: -0.015em; line-height: 1.15; }
.cb-xl .cb-addr, .cb-lg .cb-addr { font-size: 18px; }
.cb-town { font-size: 11.5px; color: #8793ad; }
.cb-issue { font-size: 13px; color: #e7ebf5; font-weight: 500; margin-top: auto; } .cb-t-danger .cb-issue { color: #ff9b7e; } .cb-t-warn .cb-issue { color: #f3c06e; }
.cb-pips { display: flex; align-items: center; gap: 7px; margin-top: auto; }
.cb-sm .cb-pips { margin-top: auto; }
.cb-pip { width: 18px; height: 18px; border-radius: 6px; display: grid; place-items: center; font-size: 10px; font-weight: 800; flex-shrink: 0; }
.cb-p-ok { background: rgba(80,200,140,0.18); color: #6fd99e; } .cb-p-danger { background: rgba(255,122,89,0.2); color: #ff9b7e; } .cb-p-warn { background: rgba(240,177,78,0.2); color: #f3c06e; } .cb-p-info { background: rgba(110,160,255,0.2); color: #9bbcff; } .cb-p-neutral { background: rgba(255,255,255,0.08); color: #8793ad; }
.cb-when { font-size: 11px; color: #7d8aa8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cb-scrim { position: fixed; inset: 0; z-index: 40; background: rgba(5,7,12,0.66); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: cbf 0.2s; }
@keyframes cbf { from { opacity: 0; } }
.cb-panel { width: min(760px, 100%); max-height: 86vh; overflow: auto; background: #10141f; border-radius: 22px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 40px 100px rgba(0,0,0,0.6); padding: 30px 32px; position: relative; animation: cbp 0.3s cubic-bezier(0.3,1,0.4,1); }
@keyframes cbp { from { opacity: 0; transform: translateY(14px) scale(0.98); } }
.cb-close { position: absolute; top: 22px; right: 22px; width: 32px; height: 32px; border-radius: 9px; background: rgba(255,255,255,0.06); border: none; color: #8793ad; cursor: pointer; display: grid; place-items: center; } .cb-close:hover { background: rgba(255,255,255,0.12); color: #fff; } .cb-close svg { width: 15px; height: 15px; }
.cb-p-addr { font-size: 25px; font-weight: 680; letter-spacing: -0.025em; margin: 0 0 3px; }
.cb-p-meta { font-size: 13px; color: #8793ad; margin: 0 0 18px; }
.cb-p-con { font-size: 13.5px; font-weight: 600; margin: 0 0 10px; padding-left: 13px; border-left: 2px solid currentColor; } .cb-p-con span { font-weight: 400; color: #a7b0c6; }
.cb-t-danger.cb-p-con, .cb-p-con.cb-t-danger { color: #ff9b7e; } .cb-p-con.cb-t-warn { color: #f3c06e; } .cb-p-con.cb-t-info { color: #9bbcff; }
.cb-p-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 22px; }
.cb-p-sh { display: flex; flex-direction: column; gap: 1px; margin-bottom: 4px; }
.cb-p-role { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: #6d7a96; font-weight: 600; }
.cb-p-name { font-size: 16px; font-weight: 620; letter-spacing: -0.015em; }
.cb-p-st { font-size: 12.5px; margin: 0 0 14px; } .cb-p-st.cb-t-danger { color: #ff9b7e; } .cb-p-st.cb-t-warn { color: #f3c06e; } .cb-p-st.cb-t-ok { color: #8793ad; } .cb-p-st.cb-t-neutral { color: #8793ad; }
.cb-p-thread { display: flex; flex-direction: column; gap: 11px; margin-bottom: 16px; }
.cb-p-te { display: grid; grid-template-columns: 16px 1fr; gap: 9px; } .cb-p-te > svg { width: 14px; height: 14px; color: #6d7a96; margin-top: 2px; grid-row: span 2; }
.cb-p-tt { font-size: 13px; color: #d6dcea; line-height: 1.3; } .cb-p-tw { font-size: 11px; color: #6d7a96; }
.cb-p-none { font-size: 12.5px; color: #6d7a96; }
.cb-p-done { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #6fd99e; margin: 0; } .cb-p-done svg { width: 14px; height: 14px; }
.cb-p-acts { display: flex; gap: 8px; }
.cb-p-prim { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 600; color: #0a0d16; background: linear-gradient(180deg, #86adff, #6ea0ff); border: none; border-radius: 10px; padding: 9px 14px; cursor: pointer; } .cb-p-prim svg { width: 14px; height: 14px; }
.cb-p-sec { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 550; color: #a7b0c6; background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 9px 13px; cursor: pointer; } .cb-p-sec:hover { background: rgba(255,255,255,0.1); } .cb-p-sec svg { width: 14px; height: 14px; }
@media (max-width: 1100px) { .cb-grid { grid-template-columns: repeat(4, 1fr); } .cb-xl, .cb-lg { grid-column: span 2; } }
@media (max-width: 680px) { .cb-grid { grid-template-columns: repeat(2, 1fr); } .cb-xl, .cb-lg, .cb-md { grid-column: span 2; grid-row: span 1; } .cb-top { flex-wrap: wrap; gap: 14px; } .cb-legend { display: none; } .cb-p-sides { grid-template-columns: 1fr; } }
`;
