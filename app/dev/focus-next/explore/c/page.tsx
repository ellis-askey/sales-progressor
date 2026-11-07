"use client";
// Direction C — "Focus Flow". One sale at a time on a calm light stage, with a
// queue you advance through (keyboard or click). Clear it like triage-zero. Warm,
// spacious, focused. Not a list, grid, or master-detail.
import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { EnvelopeSimple, PhoneCall, ArrowRight, Check, Moon, Sparkle } from "@/components/icons/ph";
import { SALES, type Sale, type Side, rel, sideCovered, attentionScore } from "../../mock";
import { who, first, sideStatus, headline, CH, STATE_LABEL, dirWord } from "../../common";

export default function FlowC() {
  if (process.env.NODE_ENV === "production") notFound();
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(JSON.stringify(SALES)));
  const [i, setI] = useState(0);
  const queue = useMemo(() => sales.map((s) => ({ s, score: attentionScore(s) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.s), [sales]);
  const cov = useMemo(() => { let t = 0, d = 0; for (const s of sales) for (const p of [s.vendor, s.purchaser]) { if (!p) continue; t++; if (sideCovered(p)) d++; } return { t, d }; }, [sales]);
  const idx = Math.min(i, Math.max(0, queue.length - 1));
  const cur = queue[idx] ?? null;

  const next = useCallback(() => setI((v) => Math.min(queue.length - 1, v + 1)), [queue.length]);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);
  const act = (sale: Sale, side: Side) => setSales((cur2) => cur2.map((s) => s.id !== sale.id ? s : { ...s, [side.kind === "vendor" ? "vendor" : "purchaser"]: { ...side, touchedThisWeek: true, parked: false } }));
  const park = (sale: Sale) => setSales((cur2) => cur2.map((s) => s.id !== sale.id ? s : { ...s, vendor: s.vendor ? { ...s.vendor, parked: true } : null, purchaser: s.purchaser ? { ...s.purchaser, parked: true } : null }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement) return; if (e.key === "ArrowRight" || e.key === "n") { e.preventDefault(); next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <div className="fc-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="fc-top">
        <span className="fc-brand">Focus</span>
        <div className="fc-prog">{queue.map((s, n) => <span key={s.id} className={`fc-pdot${n === idx ? " on" : ""}${n < idx ? " done" : ""}`} onClick={() => setI(n)} />)}</div>
        <span className="fc-cov"><b>{cov.d}/{cov.t}</b> contacted this week</span>
      </header>

      <main className="fc-stage">
        {!cur ? (
          <div className="fc-clear"><Sparkle weight="fill" /><h2>You&rsquo;re clear</h2><p>Nothing urgent left in your book. {cov.t - cov.d} clients still to reach for weekly coverage, in your own time.</p></div>
        ) : (
          <div className="fc-card" key={cur.id}>
            <div className="fc-count">{idx + 1} <em>of {queue.length}</em></div>
            {(() => { const h = headline(cur); return h ? <p className={`fc-kick fc-${h.tone}`}>{h.text}</p> : null; })()}
            <h1 className="fc-addr">{cur.line1}</h1>
            <p className="fc-meta">{cur.town} {cur.postcode} · {cur.stage}</p>

            <div className="fc-sides">
              {[cur.vendor, cur.purchaser].filter((s): s is Side => !!s).map((s) => { const st = sideStatus(s); const comms = [...s.comms].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 2); return (
                <div key={s.kind} className="fc-side">
                  <div className="fc-sh"><span className="fc-role">{who(s)}</span><span className="fc-name">{s.names}</span><span className={`fc-st fc-${st.tone}`}>{st.text}</span></div>
                  <div className="fc-thread">{comms.length ? comms.map((m, k) => { const I = CH[m.channel]; return <div key={k} className="fc-te"><I weight="regular" /><span className="fc-tt">{m.subject ?? m.preview}</span><span className="fc-tw">{dirWord(m)} · {STATE_LABEL[m.state]} · {rel(m.daysAgo)}</span></div>; }) : <p className="fc-none">No contact yet</p>}</div>
                  {sideCovered(s) ? <p className="fc-sdone"><Check weight="bold" /> {s.parked ? "Set aside" : "Contacted"}</p> : (
                    <div className="fc-sacts"><button className="fc-prim" onClick={() => act(cur, s)}><EnvelopeSimple weight="fill" /> Email {first(s.names)}</button><button className="fc-sec" onClick={() => act(cur, s)}><PhoneCall weight="regular" /> Log call</button></div>
                  )}
                </div>
              ); })}
            </div>

            <div className="fc-foot">
              <button className="fc-skip" onClick={() => { park(cur); }}><Moon weight="regular" /> Set aside this week</button>
              <button className="fc-next" onClick={next}>Next {idx < queue.length - 1 ? "" : "·"} <ArrowRight weight="bold" /></button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
.fc-root { min-height: 100vh; background: linear-gradient(180deg, #faf8f4, #f3efe8); color: #201d18; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; }
.fc-root ::selection { background: rgba(31,138,102,0.2); }
.fc-top { display: flex; align-items: center; gap: 24px; padding: 20px 30px; }
.fc-brand { font-size: 15px; font-weight: 680; letter-spacing: -0.01em; }
.fc-prog { flex: 1; display: flex; align-items: center; gap: 6px; justify-content: center; flex-wrap: wrap; }
.fc-pdot { width: 8px; height: 8px; border-radius: 50%; background: #d7cfc2; cursor: pointer; transition: all 0.2s; }
.fc-pdot:hover { transform: scale(1.3); } .fc-pdot.done { background: #1f8a66; } .fc-pdot.on { background: #c2563a; width: 22px; border-radius: 99px; }
.fc-cov { font-size: 12.5px; color: #87806f; } .fc-cov b { color: #201d18; font-variant-numeric: tabular-nums; }
.fc-stage { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 20px 24px 60px; }
.fc-card { width: min(680px, 100%); animation: fcin 0.4s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes fcin { from { opacity: 0; transform: translateY(12px); } }
.fc-count { font-size: 12.5px; font-weight: 600; color: #a79e8c; font-variant-numeric: tabular-nums; margin-bottom: 20px; } .fc-count em { font-style: normal; }
.fc-kick { font-size: 13px; font-weight: 700; margin: 0 0 10px; letter-spacing: 0.01em; }
.fc-danger { color: #c2563a; } .fc-warn { color: #b07d1e; } .fc-info { color: #3a6ea8; } .fc-ok { color: #1f8a66; } .fc-neutral { color: #87806f; }
.fc-addr { font-size: 38px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 6px; }
.fc-meta { font-size: 13.5px; color: #87806f; margin: 0 0 32px; }
.fc-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
.fc-sh { display: flex; flex-direction: column; gap: 1px; margin-bottom: 14px; }
.fc-role { font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: #a79e8c; font-weight: 700; }
.fc-name { font-size: 17px; font-weight: 640; letter-spacing: -0.015em; margin-top: 2px; }
.fc-st { font-size: 13px; margin-top: 3px; font-weight: 500; }
.fc-thread { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
.fc-te { display: grid; grid-template-columns: 16px 1fr; gap: 9px; } .fc-te > svg { width: 14px; height: 14px; color: #a79e8c; margin-top: 2px; grid-row: span 2; }
.fc-tt { font-size: 13.5px; color: #3c372f; line-height: 1.35; } .fc-tw { font-size: 11.5px; color: #a79e8c; margin-top: 1px; }
.fc-none { font-size: 13px; color: #a79e8c; }
.fc-sdone { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #1f8a66; font-weight: 550; } .fc-sdone svg { width: 14px; height: 14px; }
.fc-sacts { display: flex; gap: 8px; flex-wrap: wrap; }
.fc-prim { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 600; color: #fff; background: #1f8a66; border: none; border-radius: 11px; padding: 10px 15px; cursor: pointer; box-shadow: 0 5px 16px rgba(31,138,102,0.3); transition: filter 0.15s, transform 0.15s; } .fc-prim:hover { filter: brightness(1.06); } .fc-prim:active { transform: scale(0.97); } .fc-prim svg { width: 15px; height: 15px; }
.fc-sec { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 550; color: #5c564a; background: rgba(32,29,24,0.05); border: none; border-radius: 11px; padding: 10px 14px; cursor: pointer; } .fc-sec:hover { background: rgba(32,29,24,0.09); } .fc-sec svg { width: 15px; height: 15px; }
.fc-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 40px; padding-top: 22px; border-top: 1px solid rgba(32,29,24,0.1); }
.fc-skip { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 13px; font-weight: 550; color: #87806f; background: none; border: none; cursor: pointer; } .fc-skip:hover { color: #201d18; } .fc-skip svg { width: 15px; height: 15px; }
.fc-next { display: inline-flex; align-items: center; gap: 9px; font: inherit; font-size: 14px; font-weight: 650; color: #201d18; background: #fff; border: 1px solid rgba(32,29,24,0.14); border-radius: 12px; padding: 11px 20px; cursor: pointer; box-shadow: 0 3px 10px rgba(0,0,0,0.06); transition: transform 0.15s, box-shadow 0.15s; } .fc-next:hover { transform: translateY(-1px); box-shadow: 0 7px 18px rgba(0,0,0,0.1); } .fc-next svg { width: 15px; height: 15px; }
.fc-clear { text-align: center; margin-top: 90px; } .fc-clear svg { width: 40px; height: 40px; color: #1f8a66; } .fc-clear h2 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin: 14px 0 8px; } .fc-clear p { font-size: 14px; color: #87806f; max-width: 360px; margin: 0 auto; line-height: 1.5; }
@media (max-width: 640px) { .fc-addr { font-size: 29px; } .fc-sides { grid-template-columns: 1fr; gap: 26px; } .fc-top { gap: 14px; } .fc-prog { order: 3; width: 100%; } }
`;
