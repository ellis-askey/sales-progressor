"use client";
// Direction A — "The Briefing". An editorial day-view: one centred reading column,
// serif headlines, the conversation shown as a pull-quote, inline text actions.
// No sidebar, no cards, no master-detail. Reads like a beautifully typeset brief.
import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { EnvelopeSimple, PhoneCall, ArrowRight, MagnifyingGlass } from "@/components/icons/ph";
import { SALES, type Sale, type Side, rel, sideSignal, sideCovered, attentionScore } from "../../mock";
import { who, first, sideStatus, headline } from "../../common";

export default function BriefingA() {
  if (process.env.NODE_ENV === "production") notFound();
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(JSON.stringify(SALES)));
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState("");
  const cov = useMemo(() => { let t = 0, d = 0; for (const s of sales) for (const p of [s.vendor, s.purchaser]) { if (!p) continue; t++; if (sideCovered(p)) d++; } return { t, d }; }, [sales]);
  const list = useMemo(() => sales
    .filter((s) => !q.trim() || `${s.line1} ${s.town} ${s.vendor?.names ?? ""} ${s.purchaser?.names ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .map((s) => ({ s, score: attentionScore(s) }))
    .sort((a, b) => b.score - a.score), [sales, q]);
  const hot = list.filter((x) => x.score > 0).map((x) => x.s);
  const calm = list.filter((x) => x.score === 0).map((x) => x.s);

  const mark = (sale: Sale, side: Side, label: string) => {
    setSales((cur) => cur.map((s) => s.id !== sale.id ? s : { ...s, [side.kind === "vendor" ? "vendor" : "purchaser"]: { ...side, touchedThisWeek: true, parked: false } }));
    setFlash(`${who(side)} at ${sale.line1}: ${label}`); setTimeout(() => setFlash(""), 2600);
  };

  return (
    <div className="ba-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ba-wrap">
        <header className="ba-mast">
          <div className="ba-mast-l">
            <p className="ba-date">Thursday, 7 November</p>
            <h1 className="ba-head">{hot.length} {hot.length === 1 ? "sale needs" : "sales need"} you,<br />{cov.t - cov.d} clients still to reach this week.</h1>
          </div>
          <div className="ba-mast-r">
            <div className="ba-cov"><span className="ba-cov-n">{cov.d}<em>/{cov.t}</em></span><span className="ba-cov-l">contacted<br />this week</span></div>
            <label className="ba-search"><MagnifyingGlass weight="regular" /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          </div>
        </header>

        {flash && <div className="ba-flash">{flash}</div>}

        <section className="ba-feed">
          {hot.map((s) => <Story key={s.id} sale={s} onMark={mark} />)}
          {calm.length > 0 && (
            <>
              <div className="ba-rule"><span>In good shape</span></div>
              {calm.map((s) => <CalmLine key={s.id} sale={s} />)}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Story({ sale, onMark }: { sale: Sale; onMark: (s: Sale, side: Side, l: string) => void }) {
  const h = headline(sale);
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  const quoteSide = sides.map((s) => ({ s, m: [...s.comms].sort((a, b) => a.daysAgo - b.daysAgo)[0] })).filter((x) => x.m)
    .sort((a, b) => (a.m!.daysAgo) - (b.m!.daysAgo))[0];
  return (
    <article className="ba-story">
      {h && <p className={`ba-kicker ba-${h.tone}`}>{h.text}</p>}
      <h2 className="ba-title">{sale.line1}<span>, {sale.town}</span></h2>
      <div className="ba-sides">
        {sides.map((s) => { const st = sideStatus(s); return (
          <div key={s.kind} className="ba-side">
            <span className="ba-role">{who(s)}</span>
            <span className="ba-name">{s.names}</span>
            <span className={`ba-state ba-${st.tone}`}>{st.text}</span>
          </div>
        ); })}
      </div>
      {quoteSide?.m && (
        <blockquote className="ba-quote">
          “{quoteSide.m.subject ?? quoteSide.m.preview}”
          <cite>{quoteSide.m.dir === "in" ? first(quoteSide.s.names) : "You"}, {rel(quoteSide.m.daysAgo)} ago · {who(quoteSide.s)}</cite>
        </blockquote>
      )}
      <div className="ba-acts">
        {sides.filter((s) => !sideCovered(s)).map((s) => (
          <button key={s.kind} className="ba-act" onClick={() => onMark(sale, s, "email sent")}>
            <EnvelopeSimple weight="regular" /> Email {first(s.names)} <ArrowRight weight="bold" className="ba-arr" />
          </button>
        ))}
        {sides.some((s) => !sideCovered(s)) && <button className="ba-act ba-act-q" onClick={() => onMark(sale, sides.find((s) => !sideCovered(s))!, "call logged")}><PhoneCall weight="regular" /> Log a call</button>}
      </div>
    </article>
  );
}

function CalmLine({ sale }: { sale: Sale }) {
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  const last = Math.min(...sides.flatMap((s) => { const d = sideSignal(s).lastHumanDays; return d == null ? [9999] : [d]; }));
  return (
    <div className="ba-calm">
      <span className="ba-calm-addr">{sale.line1}<em>, {sale.town}</em></span>
      <span className="ba-calm-meta">Both sides in touch · last spoke {rel(last)} ago</span>
    </div>
  );
}

const CSS = `
.ba-root { min-height: 100vh; background: #15110d; color: #f3ebdd; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.ba-root ::selection { background: rgba(232,131,90,0.3); }
.ba-root *::-webkit-scrollbar { width: 11px; } .ba-root *::-webkit-scrollbar-thumb { background: rgba(243,235,221,0.14); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
.ba-wrap { max-width: 720px; margin: 0 auto; padding: 56px 28px 120px; }
.ba-mast { display: flex; justify-content: space-between; align-items: flex-start; gap: 30px; padding-bottom: 34px; border-bottom: 1px solid rgba(243,235,221,0.12); }
.ba-date { font-size: 12.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #a08f78; margin: 0 0 14px; font-weight: 600; }
.ba-head { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-size: 33px; line-height: 1.16; letter-spacing: -0.015em; font-weight: 600; margin: 0; }
.ba-mast-r { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; flex-shrink: 0; }
.ba-cov { display: flex; align-items: baseline; gap: 10px; }
.ba-cov-n { font-family: "Iowan Old Style", Georgia, serif; font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ba-cov-n em { font-style: normal; color: #a08f78; font-size: 19px; }
.ba-cov-l { font-size: 11px; color: #a08f78; line-height: 1.3; text-align: right; }
.ba-search { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(243,235,221,0.18); padding: 5px 2px; color: #a08f78; }
.ba-search svg { width: 15px; height: 15px; }
.ba-search input { background: none; border: none; outline: none; color: #f3ebdd; font: inherit; font-size: 13.5px; width: 130px; }
.ba-search input::placeholder { color: #80715d; }
.ba-flash { position: sticky; top: 14px; z-index: 5; margin: 18px auto 0; width: fit-content; background: #2a2017; border: 1px solid rgba(232,131,90,0.4); color: #f3d9c6; font-size: 13px; padding: 9px 16px; border-radius: 999px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
.ba-feed { padding-top: 10px; }
.ba-story { padding: 36px 0; border-bottom: 1px solid rgba(243,235,221,0.1); }
.ba-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; margin: 0 0 10px; }
.ba-danger { color: #f0865a; } .ba-warn { color: #e3a44e; } .ba-info { color: #7fb0e8; } .ba-ok { color: #8ca888; } .ba-neutral { color: #a08f78; }
.ba-title { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-size: 27px; line-height: 1.1; letter-spacing: -0.02em; font-weight: 600; margin: 0 0 16px; }
.ba-title span { color: #a08f78; font-weight: 500; }
.ba-sides { display: flex; gap: 40px; flex-wrap: wrap; margin-bottom: 20px; }
.ba-side { display: flex; flex-direction: column; gap: 2px; }
.ba-role { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #80715d; font-weight: 600; }
.ba-name { font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; }
.ba-state { font-size: 13px; margin-top: 2px; }
.ba-quote { font-family: "Iowan Old Style", Georgia, serif; font-size: 17.5px; line-height: 1.5; font-style: italic; color: #e4d8c5; margin: 0 0 22px; padding-left: 20px; border-left: 2px solid rgba(232,131,90,0.5); }
.ba-quote cite { display: block; font-family: -apple-system, system-ui, sans-serif; font-style: normal; font-size: 12px; color: #80715d; margin-top: 8px; }
.ba-acts { display: flex; align-items: center; gap: 22px; }
.ba-act { display: inline-flex; align-items: center; gap: 9px; background: none; border: none; color: #f3ebdd; font: inherit; font-size: 14px; font-weight: 550; cursor: pointer; padding: 0; transition: color 0.18s; }
.ba-act svg { width: 16px; height: 16px; color: #e8835a; }
.ba-act .ba-arr { width: 13px; opacity: 0; transform: translateX(-4px); transition: all 0.2s; color: #e8835a; }
.ba-act:hover { color: #f0865a; } .ba-act:hover .ba-arr { opacity: 1; transform: none; }
.ba-act-q { color: #a08f78; font-size: 13.5px; } .ba-act-q svg { color: #a08f78; } .ba-act-q:hover { color: #f3ebdd; }
.ba-rule { display: flex; align-items: center; gap: 16px; margin: 48px 0 8px; }
.ba-rule::before, .ba-rule::after { content: ""; flex: 1; height: 1px; background: rgba(243,235,221,0.12); }
.ba-rule span { font-size: 11.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #80715d; font-weight: 600; }
.ba-calm { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; padding: 14px 0; border-bottom: 1px solid rgba(243,235,221,0.07); }
.ba-calm-addr { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; } .ba-calm-addr em { color: #a08f78; font-style: normal; font-weight: 500; }
.ba-calm-meta { font-size: 12.5px; color: #80715d; white-space: nowrap; }
@media (max-width: 640px) { .ba-wrap { padding: 32px 18px 90px; } .ba-mast { flex-direction: column; } .ba-head { font-size: 26px; } .ba-sides { gap: 24px; } }
`;
