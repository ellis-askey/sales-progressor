"use client";

// /dev/auto-emails-rethink — clickable prototype of the WHOLE
// /agent/automated-emails page: the existing top (attention banner, three
// summary cards, activity chart) shown faithfully, plus the re-thought bottom
// half — a file-centric "cockpit" (By sale) replacing the time-ordered email
// "log" (kept as Schedule). Mock data + local state only; the real feature
// reads the same forecast/coverage/needs modules the live page already loads.
// Dev-only; blocks in production. Delete once the direction is agreed.

import { notFound } from "next/navigation";
import { useState } from "react";

type NeedKind = "bounced" | "needs-email" | "chased-out";
type NeedRow = { id: string; addr: string; kind: NeedKind; pill: string; pillTone: "bad" | "warn" | "cool"; detail: string; meta: [string, string][]; action: string };
type ChaseRow = { id: string; addr: string; detail: string; next: string; chaseN: number; chaseMax: number; note: string };

const NEEDS: NeedRow[] = [
  { id: "n1", addr: "2 Conifer Close, Waltham Cross, EN7 6EY", kind: "bounced", pill: "Email bounced", pillTone: "bad",
    detail: "The seller's last email **bounced**, so chasing is paused on this file until it's fixed.",
    meta: [["Paused", "2 days"], ["Was chasing", "Seller · draft pack"]], action: "Update email" },
  { id: "n2", addr: "19 Bodge Piece, Aylesbury, HP22 3BR", kind: "needs-email", pill: "Needs email", pillTone: "warn",
    detail: "No buyer email on file — nothing can send until one's added.",
    meta: [["Waiting", "since instructed"], ["Missing", "Buyer"]], action: "Add email" },
  { id: "n3", addr: "55 Woodlands Avenue, Berkhamsted, HP4 2JQ", kind: "chased-out", pill: "Chased out", pillTone: "cool",
    detail: "All **3 of 3** automated chases sent and searches still aren't back. Time for a call.",
    meta: [["Outstanding", "18 days"], ["Last chase", "Thu 22 Oct"]], action: "Log a call" },
];

const DEFAULT_NEXT = "Mon 26 Oct";
const CHASING: ChaseRow[] = [
  { id: "c1", addr: "16 Deans Furlong, Tring, HP23 4AR", detail: "**Buyer's solicitor** · Draft contract pack issued", next: "Mon 26 Oct", chaseN: 2, chaseMax: 3, note: "reply awaited" },
  { id: "c2", addr: "11a John Eliot Close, Nazeing, EN9 2NZ", detail: "**Both solicitors** · Readiness to exchange", next: "Mon 26 Oct", chaseN: 2, chaseMax: 3, note: "" },
  { id: "c3", addr: "176 Perrysfield Road, Cheshunt, EN8 0TW", detail: "**Seller's solicitor** · Readiness to exchange", next: "Mon 26 Oct", chaseN: 2, chaseMax: 3, note: "" },
  { id: "c4", addr: "Unit 1, Robins Wharf, Northfleet, DA11 9AX", detail: "**Buyer's solicitor** · Search results received", next: "Tue 27 Oct", chaseN: 1, chaseMax: 3, note: "first nudge" },
];

const ALL_SET_SAMPLE = [
  "4 Old Oak Gardens, Herons Elm, HP4 3QX", "20 Williamson Way, Pitstone, LU7 9FU",
  "83 Highfield Road, Tring, HP23 4DN", "118 Hadley Grange, Harlow, CM17 9NB", "49 Prospect Road, Waltham Cross, EN8 7HR",
];

const SCHEDULE = [
  { day: "Monday · 44 to go", rows: [
    { who: "Seller's solicitor", addr: "176 Perrysfield Road, Cheshunt, EN8 0TW", subj: "Confirmed readiness to exchange chase", n: "chase 2" },
    { who: "Seller's solicitor", addr: "11a John Eliot Close, Nazeing, EN9 2NZ", subj: "Confirmed readiness to exchange chase", n: "chase 2" },
    { who: "Buyer's solicitor", addr: "11a John Eliot Close, Nazeing, EN9 2NZ", subj: "Confirmed readiness to exchange chase", n: "chase 2" },
    { who: "Buyer's solicitor", addr: "16 Deans Furlong, Tring, HP23 4AR", subj: "Draft contract pack issued chase", n: "chase 2" },
    { who: "Buyer's solicitor", addr: "Unit 1, Robins Wharf, Northfleet, DA11 9AX", subj: "Received the search results chase", n: "chase 1" },
  ] },
  { day: "Tuesday 27 Oct", rows: [
    { who: "Buyer", addr: "20 Williamson Way, Pitstone, LU7 9FU", subj: "Payment on account reminder", n: "chase 1" },
  ] },
];

// Activity chart — 30 mock days (sent per day).
const ACTIVITY = [3,5,4,6,2,0,0,7,8,5,6,4,0,0,9,6,7,5,8,3,0,0,6,7,9,5,4,0,0,2];

function boldify(s: string) {
  return s.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 === 1 ? <strong key={i} className="b">{p}</strong> : <span key={i}>{p}</span>));
}

export default function AutoEmailsRethinkDemo() {
  if (process.env.NODE_ENV === "production") notFound();

  const [tab, setTab] = useState<"sale" | "schedule" | "history" | "insights">("sale");
  const [needs, setNeeds] = useState(NEEDS);
  const [paused, setPaused] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) { setToast(msg); window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200); }
  function resolve(row: NeedRow) {
    setNeeds((xs) => xs.filter((x) => x.id !== row.id));
    flash(row.kind === "chased-out" ? "Call logged — back in the chasing list" : "Fixed — chasing resumed on this sale");
  }
  function togglePause(id: string) { setPaused((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  const maxBar = Math.max(...ACTIVITY);

  return (
    <div className="rt-root">
      <style>{CSS}</style>
      <div className="rt-wrap">
        <div className="rt-demobar">Demo · mock data · the real page reads the live forecast / coverage / needs modules. Top is today&rsquo;s design; the bottom half is the re-think.</div>

        {/* Header */}
        <div className="pg-head">
          <div><h1>Automated emails</h1><p className="sub">Automated emails across the files our team runs.</p></div>
          <div className="head-actions"><button className="btn ghost">✎ Add note</button><button className="btn ghost">➤ New email</button></div>
        </div>

        {/* Attention banner */}
        <div className="banner">
          <div className="banner-l">
            <div className="banner-ic">!</div>
            <div>
              <div className="banner-t">Needs your attention</div>
              <div className="banner-s">Chasing is running across 29 active files, but 19 things need a person. They&rsquo;re listed below.</div>
            </div>
          </div>
          <div className="banner-stats">
            <div className="st"><div className="st-n">0</div><div className="st-k">Sent today</div><div className="st-sub">Nothing due today</div></div>
            <div className="st"><div className="st-n amber">0</div><div className="st-k">Sending today</div><div className="st-sub">Sunday — sends Monday</div></div>
            <div className="st"><div className="st-n amber">19</div><div className="st-k">Need attention</div><div className="st-sub">See below</div></div>
            <div className="st"><div className="st-n">29</div><div className="st-k">Files monitored</div><div className="st-sub">Automated</div></div>
          </div>
        </div>

        {/* Row A: three cards */}
        <div className="cards3">
          <div className="card">
            <div className="card-h"><h3>Needs attention</h3><span className="count bad">19</span><span className="card-hint">Across 11 files</span></div>
            <div className="chips"><span className="mini bad">1 Bounced</span><span className="mini warn">6 Missing</span><span className="mini cool">12 Errored</span></div>
            <div className="mini-rows">
              <div className="mini-row"><span className="mi bad">✉</span><div><div className="mi-t">We can&rsquo;t reach the seller</div><div className="mi-s">2 Conifer Close · bounced</div></div></div>
              <div className="mini-row"><span className="mi warn">◷</span><div><div className="mi-t">Missing buyer email</div><div className="mi-s">19 Bodge Piece</div></div></div>
            </div>
            <div className="card-foot">Worked in the cockpit below ↓</div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Still to send today</h3><span className="count good">0</span></div>
            <div className="big0">0</div>
            <p className="card-p">Nothing sends today — chasing runs Monday&ndash;Friday.</p>
            <p className="card-p strong">44 lined up for <b>Monday</b>.</p>
            <a className="card-link">See the Outbox →</a>
          </div>

          <div className="card">
            <div className="card-h"><h3>Automation coverage</h3></div>
            <div className="donut-wrap">
              <div className="donut"><div className="donut-hole"><div className="donut-n">29</div><div className="donut-k">Files</div></div></div>
            </div>
            <div className="legend-rows">
              <div className="lr"><span className="sw good" /> <b>22</b> Fully covered</div>
              <div className="lr"><span className="sw warn" /> <b>6</b> Need information</div>
              <div className="lr"><span className="sw cool" /> <b>1</b> Paused</div>
            </div>
          </div>
        </div>

        {/* Activity chart */}
        <div className="card chart-card">
          <div className="card-h"><h3>Automation activity</h3><span className="card-hint">Last 30 days</span></div>
          <div className="chart">
            {ACTIVITY.map((v, i) => <div key={i} className="bar" style={{ height: `${v === 0 ? 3 : (v / maxBar) * 100}%`, opacity: v === 0 ? 0.3 : 1 }} title={`${v} sent`} />)}
          </div>
          <div className="chart-x"><span>4 weeks ago</span><span>today</span></div>
        </div>

        {/* ── THE RE-THOUGHT BOTTOM HALF ── */}
        <div className="rethink-head">
          <span className="eyebrow">Re-thought</span>
          <h2 className="rt-h2">From a log to a cockpit — one row per sale</h2>
        </div>

        <div className="seg" role="tablist">
          <button className={tab === "sale" ? "on new" : "new"} onClick={() => setTab("sale")}>By sale ✦</button>
          <button className={tab === "schedule" ? "on" : ""} onClick={() => setTab("schedule")}>Schedule</button>
          <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>History</button>
          <button className={tab === "insights" ? "on" : ""} onClick={() => setTab("insights")}>Insights</button>
        </div>

        {tab === "sale" && (
          <>
            <div className="groupbar">
              <h2>Needs you</h2><span className={`count ${needs.length ? "bad" : "good"}`}>{needs.length}</span>
              <span className="hint">{needs.length ? "automation can't proceed until you act" : "all clear — nothing stuck"}</span>
            </div>
            <div className="stack">
              {needs.length === 0 && <div className="empty">Nothing needs you. Every file&rsquo;s automation is running or quiet.</div>}
              {needs.map((r) => (
                <div className="row attn" key={r.id}>
                  <div className="thumb" />
                  <div className="body">
                    <div className="r-top"><span className="addr">{r.addr}</span><span className={`pill ${r.pillTone}`}>{r.pill}</span></div>
                    <p className="detail">{boldify(r.detail)}</p>
                    <div className="meta">{r.meta.map(([k, v], i) => <span key={i}><span className="k">{k}</span> {v}</span>)}</div>
                  </div>
                  <div className="actions">
                    <button className="btn primary" onClick={() => resolve(r)}>{r.action}</button>
                    <button className="btn ghost" onClick={() => flash("Would open the file")}>View file</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="groupbar"><h2>Chasing now</h2><span className="count good">{CHASING.length}</span><span className="hint">on their own · next run <b>{DEFAULT_NEXT}</b></span></div>
            <div className="stack">
              {CHASING.map((r) => {
                const isPaused = paused.has(r.id);
                const differsDate = !isPaused && r.next !== DEFAULT_NEXT;
                return (
                  <div className="row" key={r.id}>
                    <div className="thumb" />
                    <div className="body">
                      <div className="r-top">
                        <span className="addr">{r.addr}</span>
                        {/* A badge ONLY when the row deviates from the group — paused, or a
                            different send day. No repeated "Chasing" pill. */}
                        {isPaused && <span className="pill cool">Paused</span>}
                        {differsDate && <span className="nextchip">Sends {r.next}</span>}
                      </div>
                      <p className="detail">{boldify(r.detail)}</p>
                      <div className="meta">
                        <span className="dots">{Array.from({ length: r.chaseMax }).map((_, i) => <i key={i} className={`dot ${i < r.chaseN ? "on" : ""}`} />)}</span>
                        <span>chase {r.chaseN} of {r.chaseMax}{r.note ? ` · ${r.note}` : ""}</span>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn" onClick={() => flash("Chase sent now")} disabled={isPaused}>Chase now</button>
                      <button className="btn ghost" onClick={() => togglePause(r.id)}>{isPaused ? "Resume" : "Pause"}</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="groupbar"><h2>All set</h2><span className="count good">22</span></div>
            <div className="smooth" role="button" tabIndex={0} onClick={() => setExpanded((e) => !e)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((x) => !x); } }}>
              <div className="ic">✓</div>
              <div><div className="t">22 sales fully covered</div><div className="s">Every contact present, chasing on, nothing overdue. Tap to {expanded ? "collapse" : "expand"}.</div></div>
              <div className="chev" style={{ transform: expanded ? "rotate(90deg)" : "none" }}>›</div>
            </div>
            {expanded && (
              <div className="setlist" style={{ marginTop: 8 }}>
                {ALL_SET_SAMPLE.map((a, i) => (
                  <div className="setrow" key={i} onClick={() => flash("Would open the file")}>
                    <span className="addr sm">{a}</span>
                    <span className="set-next">next {i === 2 ? "Tue 27 Oct" : "Mon 26 Oct"}</span>
                  </div>
                ))}
                <div className="setrow muted">…and 17 more, all running cleanly</div>
              </div>
            )}
          </>
        )}

        {tab === "schedule" && (
          <>
            <p className="note">Today&rsquo;s view — a time-ordered list of individual emails. Kept for when you want the raw schedule, but no longer the default.</p>
            {SCHEDULE.map((g) => (
              <div key={g.day} className="sched-group">
                <p className="sched-day">{g.day}</p>
                {g.rows.map((r, i) => (
                  <div className="sched-row" key={i}>
                    <span className="chip">CHASE</span>
                    <div className="sched-body"><div className="sched-addr">{r.addr}</div><div className="sched-sub">{r.subj}</div></div>
                    <div className="sched-side"><span>{r.who}</span><span className="sched-n">{r.n}</span></div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {tab === "history" && <div className="empty tall">History (last 30 days) — unchanged from today: what actually sent, with delivery state.</div>}
        {tab === "insights" && <div className="empty tall">Insights — unchanged from today: chase performance + email health charts.</div>}
      </div>

      {toast && <div className="rt-toast">{toast}</div>}
    </div>
  );
}

const CSS = `
.rt-root{--coral:#FF6B4A;--ink:#1d2230;--muted:#6b7180;--faint:#9aa0ad;--ground:#f5f4f8;--card:#fff;--line:#e9e7ef;--line-soft:#f0eef4;--sunken:#faf9fc;
 --good:#16a34a;--good-bg:#e9f8ef;--good-line:#c4ecd3;--warn:#b7791f;--warn-bg:#fdf4e3;--warn-line:#f2e2bd;--bad:#c73e3e;--bad-bg:#fcebeb;--bad-line:#f3cfcf;--cool:#5b6472;--cool-bg:#eef0f4;--cool-line:#dfe2e9;
 min-height:100vh;background:
   radial-gradient(900px 500px at 12% -5%, rgba(255,107,74,.07), transparent 60%),
   radial-gradient(900px 500px at 92% 0%, rgba(90,120,255,.06), transparent 55%),
   var(--ground);
 color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;padding:26px 18px 90px;}
@media (prefers-color-scheme:dark){.rt-root{--ink:#e8eaf0;--muted:#9aa0ad;--faint:#6f7585;--ground:#14151a;--card:#1c1e25;--line:#2a2d36;--line-soft:#23262e;--sunken:#191b21;--good:#6ee7a8;--good-bg:#122a1d;--good-line:#1f4631;--warn:#f0c674;--warn-bg:#2b2412;--warn-line:#4a3d1c;--bad:#f3a1a1;--bad-bg:#2c1717;--bad-line:#4a2626;--cool:#aeb6c4;--cool-bg:#23262e;--cool-line:#333845;}}
.rt-wrap{max-width:1040px;margin:0 auto;}
.rt-demobar{font-size:12px;color:var(--coral);background:var(--sunken);border:1px dashed var(--line);border-radius:10px;padding:7px 12px;margin-bottom:18px;}
.pg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
h1{font-size:26px;letter-spacing:-.02em;margin:0;}
.sub{font-size:14px;color:var(--muted);margin:4px 0 0;}
.head-actions{display:flex;gap:8px;}
.banner{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:16px;}
.banner-l{display:flex;gap:13px;align-items:center;min-width:260px;flex:1;}
.banner-ic{width:38px;height:38px;border-radius:10px;background:var(--warn-bg);border:1px solid var(--warn-line);color:var(--warn);font-weight:800;display:flex;align-items:center;justify-content:center;flex:none;}
.banner-t{font-size:15px;font-weight:700;}
.banner-s{font-size:12.5px;color:var(--muted);margin-top:2px;max-width:52ch;}
.banner-stats{display:flex;gap:26px;flex-wrap:wrap;}
.st{min-width:70px;}
.st-n{font-size:22px;font-weight:750;line-height:1;}
.st-n.amber{color:var(--warn);}
.st-k{font-size:12px;font-weight:600;color:var(--muted);margin-top:3px;}
.st-sub{font-size:10.5px;color:var(--faint);margin-top:1px;}
.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px;}
@media (max-width:860px){.cards3{grid-template-columns:1fr;}}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px 16px;}
.card-h{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.card-h h3{font-size:14px;font-weight:700;margin:0;}
.card-hint{margin-left:auto;font-size:11.5px;color:var(--faint);}
.count{font-size:11.5px;font-weight:700;border-radius:99px;padding:1px 9px;}
.count.bad{color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line);}
.count.good{color:var(--good);background:var(--good-bg);border:1px solid var(--good-line);}
.chips{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;}
.mini{font-size:11px;font-weight:600;border-radius:99px;padding:2px 9px;}
.mini.bad{color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line);}
.mini.warn{color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn-line);}
.mini.cool{color:var(--cool);background:var(--cool-bg);border:1px solid var(--cool-line);}
.mini-rows{display:flex;flex-direction:column;gap:8px;}
.mini-row{display:flex;gap:9px;align-items:center;}
.mi{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none;}
.mi.bad{color:var(--bad);background:var(--bad-bg);}
.mi.warn{color:var(--warn);background:var(--warn-bg);}
.mi-t{font-size:12.5px;font-weight:600;}
.mi-s{font-size:11px;color:var(--muted);}
.card-foot{font-size:11px;color:var(--coral);margin-top:11px;font-weight:600;}
.big0{font-size:40px;font-weight:800;line-height:1;color:var(--good);margin:2px 0 6px;}
.card-p{font-size:12.5px;color:var(--muted);margin:0 0 4px;}
.card-p.strong{color:var(--ink);}
.card-link{font-size:12.5px;font-weight:600;color:var(--coral);cursor:pointer;display:inline-block;margin-top:6px;}
.donut-wrap{display:flex;justify-content:center;padding:4px 0 12px;}
.donut{width:120px;height:120px;border-radius:50%;background:conic-gradient(var(--good) 0 273deg,var(--warn) 273deg 347deg,var(--cool) 347deg 360deg);display:flex;align-items:center;justify-content:center;}
.donut-hole{width:84px;height:84px;border-radius:50%;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;}
.donut-n{font-size:26px;font-weight:800;line-height:1;}
.donut-k{font-size:11px;color:var(--muted);}
.legend-rows{display:flex;flex-direction:column;gap:5px;}
.lr{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:7px;}
.lr b{color:var(--ink);}
.sw{width:9px;height:9px;border-radius:3px;display:inline-block;}
.sw.good{background:var(--good);}.sw.warn{background:var(--warn);}.sw.cool{background:var(--cool);}
.chart-card{margin-bottom:8px;}
.chart{display:flex;align-items:flex-end;gap:4px;height:90px;padding:4px 2px 0;}
.bar{flex:1;background:linear-gradient(180deg,var(--coral),#ff8a6e);border-radius:3px 3px 0 0;min-height:3px;}
.chart-x{display:flex;justify-content:space-between;font-size:10.5px;color:var(--faint);margin-top:6px;}
.rethink-head{margin:30px 0 4px;}
.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--coral);}
.rt-h2{font-size:18px;letter-spacing:-.01em;margin:5px 0 0;}
.note{font-size:13px;color:var(--muted);margin:10px 0 16px;max-width:70ch;}
.seg{display:inline-flex;gap:2px;padding:3px;background:var(--sunken);border:1px solid var(--line);border-radius:11px;margin:14px 0 6px;flex-wrap:wrap;}
.seg button{font:inherit;font-size:13px;font-weight:600;border:0;background:none;color:var(--muted);padding:6px 13px;border-radius:8px;cursor:pointer;}
.seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);}
.seg button.new{color:var(--coral);}
.groupbar{display:flex;align-items:center;gap:9px;margin:20px 2px 10px;}
.groupbar h2{font-size:13px;font-weight:700;margin:0;}
.groupbar .hint{margin-left:auto;font-size:12px;color:var(--faint);}
.stack{display:flex;flex-direction:column;gap:8px;}
.row{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 15px;display:flex;gap:13px;align-items:flex-start;}
.row.attn{border-left:3px solid var(--coral);}
.row.quiet{opacity:.92;}
.thumb{width:42px;height:42px;border-radius:9px;flex:none;background:linear-gradient(135deg,#d9dbe3,#c3c6d1);}
.thumb.sm{width:34px;height:34px;}
@media (prefers-color-scheme:dark){.thumb{background:linear-gradient(135deg,#2c2f38,#23252c);}}
.body{flex:1;min-width:0;}
.r-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.addr{font-size:14px;font-weight:650;}
.addr.sm{font-size:13px;}
.pill{font-size:11px;font-weight:650;border-radius:99px;padding:2px 9px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;}
.pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;}
.pill.good{color:var(--good);background:var(--good-bg);border:1px solid var(--good-line);}
.pill.warn{color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn-line);}
.pill.bad{color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line);}
.pill.cool{color:var(--cool);background:var(--cool-bg);border:1px solid var(--cool-line);}
.detail{font-size:12.5px;color:var(--muted);margin:5px 0 0;line-height:1.45;}
.detail .b{color:var(--ink);font-weight:600;}
.meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:7px;font-size:11.5px;color:var(--faint);}
.meta .k{color:var(--muted);font-weight:600;}
.dots{display:inline-flex;gap:3px;vertical-align:middle;margin-left:4px;}
.dot{width:6px;height:6px;border-radius:50%;background:var(--line);display:inline-block;}
.dot.on{background:var(--coral);}
.nextchip{font-size:10.5px;font-weight:650;color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:99px;padding:2px 8px;white-space:nowrap;}
.setlist{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;}
.setrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 15px;border-top:1px solid var(--line-soft);cursor:pointer;}
.setrow:first-child{border-top:0;}
.setrow:hover{background:var(--sunken);}
.setrow.muted{color:var(--faint);font-size:12px;cursor:default;justify-content:center;}
.setrow.muted:hover{background:transparent;}
.set-next{font-size:11.5px;color:var(--faint);white-space:nowrap;}
.actions{display:flex;flex-direction:column;gap:6px;flex:none;}
.btn{font:inherit;font-size:12.5px;font-weight:600;border-radius:9px;padding:6px 12px;cursor:pointer;white-space:nowrap;border:1px solid var(--line);background:var(--card);color:var(--ink);}
.btn:hover{border-color:var(--faint);}
.btn.primary{background:var(--coral);border-color:var(--coral);color:#fff;}
.btn.primary:hover{background:#e85b3c;}
.btn.ghost{color:var(--muted);}
.btn:disabled{opacity:.45;cursor:default;}
.smooth{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;}
.smooth .ic{width:34px;height:34px;border-radius:9px;background:var(--good-bg);border:1px solid var(--good-line);color:var(--good);display:flex;align-items:center;justify-content:center;font-size:16px;flex:none;}
.smooth .t{font-size:13.5px;font-weight:600;}
.smooth .s{font-size:12px;color:var(--muted);margin-top:1px;}
.smooth .chev{margin-left:auto;color:var(--faint);font-size:18px;transition:transform .15s;}
.empty{font-size:13px;color:var(--muted);padding:14px 16px;background:var(--sunken);border:1px solid var(--line-soft);border-radius:12px;text-align:center;}
.empty.tall{padding:44px 16px;}
.sched-group{margin-bottom:16px;}
.sched-day{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:0 0 8px;}
.sched-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin-bottom:6px;}
.chip{font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--coral);background:var(--sunken);border:1px solid var(--line);border-radius:6px;padding:3px 7px;flex:none;}
.sched-body{flex:1;min-width:0;}
.sched-addr{font-size:13px;font-weight:650;}
.sched-sub{font-size:12px;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sched-side{text-align:right;font-size:11.5px;color:var(--faint);flex:none;display:flex;flex-direction:column;gap:2px;}
.sched-n{color:var(--muted);}
.rt-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--ink);color:var(--ground);font-size:13px;font-weight:600;padding:10px 18px;border-radius:99px;box-shadow:0 6px 24px rgba(0,0,0,.25);z-index:50;}
@media (max-width:620px){.actions{flex-direction:row;}.banner-stats{gap:16px;}}
`;
