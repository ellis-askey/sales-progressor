"use client";

// /dev/chain-cockpit — polished preview of two progressor UX wins:
//   Board 1: the chain readable at a glance (FTB / top / bottom markers + a
//            one-line summary) so you never click a node mid-call.
//   Board 2: one page — your notes, a milestone checklist, and the chain
//            together (the Alto layout the agent asked for).
// Faithful to the agent-app visual language (glass, coral, avatars), theme-aware,
// self-contained mock. No wiring.

import { useState } from "react";
import { notFound } from "next/navigation";

/* ───────────────────────── primitives ───────────────────────── */

function Avatar({ side, name, size = 22 }: { side: "seller" | "buyer"; name: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`cc-av cc-av--${side}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}

function Chip({ tone, children }: { tone: "ftb" | "cash" | "terminal" | "neutral"; children: React.ReactNode }) {
  return <span className={`cc-chip cc-chip--${tone}`}>{children}</span>;
}

function StatusPill({ tone, children }: { tone: "progress" | "done" | "wait"; children: React.ReactNode }) {
  return (
    <span className={`cc-status cc-status--${tone}`}>
      <span className="cc-status-dot" aria-hidden />
      {children}
    </span>
  );
}

function Bar({ pct }: { pct: number }) {
  return <span className="cc-bar"><span className="cc-bar-fill" style={{ width: `${pct}%` }} /></span>;
}

function Ring({ pct, size = 46 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="cc-ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} className="cc-ring-track" strokeWidth={5} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} className="cc-ring-fill" strokeWidth={5} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" className="cc-ring-text">{pct}%</text>
    </svg>
  );
}

/* ───────────────────────── chain data ───────────────────────── */

type Node = {
  pos: number; address: string; town: string; status: string;
  statusTone: "progress" | "done" | "wait"; pct: number;
  seller: string; buyer: string;
  cap?: "top" | "bottom"; marker?: "ftb" | "cash" | "terminal"; you?: boolean;
};

const CHAIN: Node[] = [
  { pos: 4, address: "The Old Rectory, Aldbury", town: "Tring · HP23", status: "Contract pack issued", statusTone: "progress", pct: 55, seller: "Margaret Whitfield", buyer: "Hart family", cap: "top", marker: "terminal" },
  { pos: 3, address: "22 Falcon Crescent", town: "Tring · HP23", status: "Mortgage offer received", statusTone: "progress", pct: 68, seller: "Hart family", buyer: "Okafor family" },
  { pos: 2, address: "8 Riverside Gardens", town: "Berkhamsted · HP4", status: "Enquiries raised", statusTone: "wait", pct: 42, seller: "Okafor family", buyer: "Sophie Bennett", you: true },
  { pos: 1, address: "14 Marlowe Court", town: "Hemel Hempstead · HP1", status: "Searches ordered", statusTone: "progress", pct: 35, seller: "Sophie Bennett", buyer: "—", cap: "bottom", marker: "ftb" },
];

function ChainNode({ n }: { n: Node }) {
  return (
    <div className={`cc-node${n.you ? " is-you" : ""}`}>
      <div className="cc-node-rail">
        <span className="cc-pos">{n.pos}</span>
      </div>
      <div className="cc-card">
        {n.cap && (
          <div className={`cc-cap cc-cap--${n.cap}`}>
            {n.cap === "top" ? "Top of chain" : "Bottom of chain"}
          </div>
        )}
        <div className="cc-node-head">
          <div style={{ minWidth: 0 }}>
            <p className="cc-addr">{n.address}</p>
            <p className="cc-town">{n.town}</p>
          </div>
          <StatusPill tone={n.statusTone}>{n.status}</StatusPill>
        </div>
        <div className="cc-node-foot">
          <span className="cc-people">
            <Avatar side="seller" name={n.seller} />
            <span className="cc-ppl-name">{n.seller}</span>
            {n.buyer !== "—" && (
              <>
                <span className="cc-arrow" aria-hidden>→</span>
                <Avatar side="buyer" name={n.buyer} />
                <span className="cc-ppl-name">{n.buyer}</span>
              </>
            )}
          </span>
          <span className="cc-node-right">
            {n.marker === "ftb" && <Chip tone="ftb">First-time buyer</Chip>}
            {n.marker === "cash" && <Chip tone="cash">Cash buyer</Chip>}
            {n.marker === "terminal" && <Chip tone="terminal">No onward purchase</Chip>}
            {n.you && <span className="cc-you">You&rsquo;re here</span>}
          </span>
        </div>
        <Bar pct={n.pct} />
      </div>
    </div>
  );
}

/* ───────────────────────── milestone checklist ───────────────────────── */

const DONE = [
  "Memorandum of sale issued", "Solicitor instructed", "ID & AML checks", "Draft contract pack received",
  "Searches ordered", "Search results back", "Survey booked",
];
const NEXT = "Reply to enquiries";
const UPCOMING = ["All enquiries satisfied", "Report on title", "Sign contracts", "Exchange"];

function MilestoneChecklist() {
  return (
    <div className="cc-glass cc-mile">
      <div className="cc-glass-head">
        <h3>Milestones</h3>
        <span className="cc-count">18 of 32 done</span>
      </div>
      <Bar pct={56} />
      <ul className="cc-mlist">
        {DONE.map((m) => (
          <li key={m} className="cc-mrow cc-mrow--done">
            <span className="cc-tick cc-tick--done" aria-hidden>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </span>
            {m}
          </li>
        ))}
        <li className="cc-mrow cc-mrow--next">
          <span className="cc-tick cc-tick--next" aria-hidden />
          <span className="cc-next-text">{NEXT}</span>
          <span className="cc-next-tag">Next</span>
        </li>
        {UPCOMING.map((m) => (
          <li key={m} className="cc-mrow cc-mrow--todo">
            <span className="cc-tick" aria-hidden />
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

const NOTES = [
  { who: "You", when: "Today, 10:42", text: "Spoke to buyer's solicitor — searches back, no issues flagged. Enquiries going over this week." },
  { who: "You", when: "Mon, 16:05", text: "Margaret (top) confirmed she's not buying on, so the chain ends here. Everyone keen to exchange before month-end." },
  { who: "Laura", when: "Fri, 09:20", text: "Okafors' mortgage offer through. Chasing their solicitor to return the contract." },
];

function NotesCard() {
  return (
    <div className="cc-glass cc-notes">
      <div className="cc-glass-head"><h3>Your notes</h3><button className="cc-add" type="button">+ Add note</button></div>
      <div className="cc-note-list">
        {NOTES.map((n, i) => (
          <div key={i} className="cc-note">
            <div className="cc-note-meta"><span className="cc-note-who">{n.who}</span><span className="cc-note-when">{n.when}</span></div>
            <p className="cc-note-text">{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChainMini() {
  return (
    <div className="cc-glass cc-mini">
      <div className="cc-glass-head"><h3>Chain</h3><span className="cc-count">4 properties</span></div>
      <div className="cc-mini-list">
        {CHAIN.map((n) => (
          <div key={n.pos} className={`cc-mini-row${n.you ? " is-you" : ""}`}>
            <span className="cc-mini-pos">{n.pos}</span>
            <span className="cc-mini-addr">{n.address.split(",")[0]}</span>
            {n.marker === "ftb" && <Chip tone="ftb">FTB</Chip>}
            {n.marker === "terminal" && <Chip tone="terminal">Chain-free</Chip>}
            {n.you && <span className="cc-mini-you">You</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NextAction() {
  return (
    <div className="cc-glass cc-next">
      <p className="cc-next-eyebrow">Next action</p>
      <p className="cc-next-head">Reply to the buyer&rsquo;s enquiries</p>
      <p className="cc-next-sub">Raised 6 days ago · with you</p>
      <button className="cc-next-btn" type="button">Open enquiries</button>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function ChainCockpitDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);

  return (
    <div className={`cc-page${dark ? " dark" : ""}`}>
      <div className="cc-wrap">
        <header className="cc-top">
          <div>
            <h1 className="cc-h1">Chain &amp; file — built for a phone call</h1>
            <p className="cc-lede">Everything the progressor asked for: the chain readable at a glance (no clicking into a node), and their notes, milestones and chain on one page.</p>
          </div>
          <button className="cc-theme" type="button" onClick={() => setDark((v) => !v)}>{dark ? "Light" : "Dark"}</button>
        </header>

        {/* Board 1 — chain at a glance */}
        <p className="cc-board-label">The chain, without clicking in</p>
        <div className="cc-summary">
          <span className="cc-sum-strong">4-property chain.</span>
          <span> First-time buyer at the bottom, no onward purchase at the top — you&rsquo;re the 2nd property up.</span>
        </div>
        <div className="cc-ladder">
          {CHAIN.map((n) => <ChainNode key={n.pos} n={n} />)}
        </div>

        {/* Board 2 — one page */}
        <p className="cc-board-label" style={{ marginTop: 44 }}>One page: notes, milestones &amp; chain together</p>
        <div className="cc-file-head">
          <div>
            <p className="cc-file-eyebrow">Your sale · 2nd in the chain</p>
            <h2 className="cc-file-addr">8 Riverside Gardens, Berkhamsted</h2>
            <p className="cc-file-sub">Okafor family → Sophie Bennett · Enquiries stage</p>
          </div>
          <Ring pct={42} size={58} />
        </div>
        <div className="cc-cockpit">
          <div className="cc-col">
            <NotesCard />
            <MilestoneChecklist />
          </div>
          <div className="cc-col cc-col--side">
            <ChainMini />
            <NextAction />
          </div>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.cc-page{
  --tp:#2D1810; --ts:#5A3A28; --tm:rgba(45,24,16,0.55);
  --coral:#FF8A65; --cd:#FF6B4A; --crgb:255,107,74;
  --ok:#1F8A4A; --okrgb:31,138,74; --amber:#C77D1A; --danger:#C73E3E;
  --surface:rgba(255,255,255,0.78); --solid:#ffffff;
  --bsub:rgba(45,24,16,0.08); --bdef:rgba(45,24,16,0.13);
  --seller:#3B7DE0; --buyer:#0F9D6B;
  --bg1:#fbf1ec; --bg2:#eef2f8; --bg3:#faf0f4;
  min-height:100vh; color:var(--tp);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  background:
    radial-gradient(1100px 620px at 12% -8%, rgba(var(--crgb),0.10), transparent 60%),
    radial-gradient(900px 560px at 108% 4%, rgba(64,116,214,0.10), transparent 58%),
    linear-gradient(160deg, var(--bg1), var(--bg2) 55%, var(--bg3));
  padding:40px 20px 72px;
}
.cc-page.dark{
  --tp:#F3EAE4; --ts:#CBB9AC; --tm:rgba(243,234,228,0.52);
  --coral:#FF8A65; --cd:#FF7A58; --crgb:255,122,88;
  --ok:#35C06A; --okrgb:53,192,106; --amber:#E0A458; --danger:#F08A8A;
  --surface:rgba(34,28,25,0.62); --solid:#241e1b;
  --bsub:rgba(255,255,255,0.08); --bdef:rgba(255,255,255,0.14);
  --seller:#6AA0F0; --buyer:#2FC58A;
  --bg1:#17110f; --bg2:#121418; --bg3:#181115;
  color:var(--tp);
  background:
    radial-gradient(1100px 620px at 12% -8%, rgba(var(--crgb),0.16), transparent 60%),
    radial-gradient(900px 560px at 108% 4%, rgba(90,130,210,0.14), transparent 58%),
    linear-gradient(160deg, var(--bg1), var(--bg2) 55%, var(--bg3));
}
.cc-wrap{ max-width:940px; margin:0 auto; }

.cc-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:30px; }
.cc-h1{ margin:0; font-size:25px; font-weight:800; letter-spacing:-0.025em; }
.cc-lede{ margin:8px 0 0; font-size:14px; line-height:1.55; color:var(--ts); max-width:62ch; }
.cc-theme{ flex-shrink:0; border:1px solid var(--bdef); background:var(--surface); color:var(--ts); border-radius:10px; padding:8px 15px; font:inherit; font-size:12.5px; font-weight:650; cursor:pointer; backdrop-filter:blur(12px); }

.cc-board-label{ font-size:11.5px; font-weight:750; text-transform:uppercase; letter-spacing:0.06em; color:var(--tm); margin:0 0 12px 2px; }

/* summary strip */
.cc-summary{ border:1px solid var(--bsub); background:var(--surface); backdrop-filter:blur(16px) saturate(1.4);
  border-radius:13px; padding:13px 16px; font-size:13.5px; line-height:1.5; color:var(--ts); margin-bottom:16px;
  box-shadow:0 1px 2px rgba(20,14,10,0.04); }
.cc-sum-strong{ color:var(--tp); font-weight:750; }

/* ladder */
.cc-ladder{ display:flex; flex-direction:column; }
.cc-node{ display:flex; gap:14px; }
.cc-node-rail{ position:relative; width:30px; flex-shrink:0; display:flex; justify-content:center; }
.cc-node-rail::before{ content:""; position:absolute; top:0; bottom:0; width:2px; background:var(--bdef); }
.cc-node:first-child .cc-node-rail::before{ top:18px; }
.cc-node:last-child .cc-node-rail::before{ bottom:calc(100% - 18px); }
.cc-pos{ position:relative; z-index:1; margin-top:10px; width:26px; height:26px; border-radius:50%;
  display:grid; place-items:center; font-size:12px; font-weight:800; color:var(--ts);
  background:var(--solid); border:1.5px solid var(--bdef); flex-shrink:0; }
.cc-node.is-you .cc-pos{ color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); border-color:transparent; box-shadow:0 2px 8px rgba(var(--crgb),0.4); }

.cc-card{ flex:1; min-width:0; margin-bottom:12px; border:1px solid var(--bsub); background:var(--surface);
  backdrop-filter:blur(18px) saturate(1.5); border-radius:15px; padding:14px 16px;
  box-shadow:0 2px 4px rgba(20,14,10,0.04), 0 14px 30px -20px rgba(20,14,10,0.22); }
.cc-node.is-you .cc-card{ border-color:rgba(var(--crgb),0.5); box-shadow:0 0 0 1px rgba(var(--crgb),0.35), 0 14px 32px -18px rgba(var(--crgb),0.4); }

.cc-cap{ display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; margin-bottom:9px; }
.cc-cap::before{ content:""; width:14px; height:2px; border-radius:2px; }
.cc-cap--top{ color:var(--seller); } .cc-cap--top::before{ background:var(--seller); }
.cc-cap--bottom{ color:var(--buyer); } .cc-cap--bottom::before{ background:var(--buyer); }

.cc-node-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.cc-addr{ margin:0; font-size:15px; font-weight:720; letter-spacing:-0.01em; color:var(--tp); }
.cc-town{ margin:2px 0 0; font-size:12px; color:var(--tm); }

.cc-node-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin:11px 0 10px; flex-wrap:wrap; }
.cc-people{ display:inline-flex; align-items:center; gap:7px; min-width:0; }
.cc-ppl-name{ font-size:12.5px; color:var(--ts); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:13ch; }
.cc-arrow{ color:var(--tm); font-size:12px; }
.cc-node-right{ display:inline-flex; align-items:center; gap:8px; flex-shrink:0; }
.cc-you{ font-size:11px; font-weight:750; color:var(--cd); }

.cc-av{ border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-weight:800; color:#fff; letter-spacing:0.02em; }
.cc-av--seller{ background:var(--seller); } .cc-av--buyer{ background:var(--buyer); }

/* chips (status markers; subtle tints, never a card wash) */
.cc-chip{ display:inline-flex; align-items:center; font-size:10.5px; font-weight:750; letter-spacing:0.01em;
  padding:3px 9px; border-radius:999px; white-space:nowrap; border:1px solid transparent; }
.cc-chip--ftb{ color:var(--buyer); background:rgba(15,157,107,0.12); border-color:rgba(15,157,107,0.26); }
.cc-chip--cash{ color:var(--seller); background:rgba(59,125,224,0.12); border-color:rgba(59,125,224,0.26); }
.cc-chip--terminal{ color:var(--amber); background:rgba(199,125,26,0.12); border-color:rgba(199,125,26,0.28); }
.cc-page.dark .cc-chip--terminal{ background:rgba(224,164,88,0.14); border-color:rgba(224,164,88,0.3); }

.cc-status{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:650; color:var(--ts); flex-shrink:0; white-space:nowrap; }
.cc-status-dot{ width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.cc-status--progress .cc-status-dot{ background:var(--coral); }
.cc-status--done .cc-status-dot{ background:var(--ok); }
.cc-status--wait .cc-status-dot{ background:var(--amber); }

.cc-bar{ display:block; height:5px; border-radius:999px; background:rgba(45,24,16,0.08); overflow:hidden; }
.cc-page.dark .cc-bar{ background:rgba(255,255,255,0.09); }
.cc-bar-fill{ display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,var(--coral),var(--cd)); }

/* ── cockpit ── */
.cc-file-head{ display:flex; align-items:center; justify-content:space-between; gap:16px; border:1px solid var(--bsub);
  background:var(--surface); backdrop-filter:blur(18px) saturate(1.5); border-radius:16px; padding:16px 20px; margin-bottom:16px;
  box-shadow:0 2px 4px rgba(20,14,10,0.04); }
.cc-file-eyebrow{ margin:0; font-size:11px; font-weight:750; text-transform:uppercase; letter-spacing:0.05em; color:var(--cd); }
.cc-file-addr{ margin:4px 0 3px; font-size:20px; font-weight:780; letter-spacing:-0.02em; }
.cc-file-sub{ margin:0; font-size:13px; color:var(--tm); }

.cc-cockpit{ display:grid; grid-template-columns:1.35fr 1fr; gap:16px; align-items:start; }
@media (max-width:760px){ .cc-cockpit{ grid-template-columns:1fr; } }
.cc-col{ display:flex; flex-direction:column; gap:16px; min-width:0; }

.cc-glass{ border:1px solid var(--bsub); background:var(--surface); backdrop-filter:blur(18px) saturate(1.5);
  border-radius:16px; padding:16px 18px; box-shadow:0 2px 4px rgba(20,14,10,0.04), 0 16px 34px -24px rgba(20,14,10,0.2); }
.cc-glass-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
.cc-glass-head h3{ margin:0; font-size:14.5px; font-weight:740; letter-spacing:-0.01em; }
.cc-count{ font-size:11.5px; font-weight:650; color:var(--tm); }
.cc-add{ border:0; background:none; font:inherit; font-size:12px; font-weight:650; color:var(--cd); cursor:pointer; padding:0; }

/* notes */
.cc-note-list{ display:flex; flex-direction:column; gap:12px; }
.cc-note{ padding-left:12px; border-left:2px solid rgba(var(--crgb),0.4); }
.cc-note-meta{ display:flex; align-items:center; gap:8px; margin-bottom:3px; }
.cc-note-who{ font-size:12px; font-weight:700; color:var(--tp); }
.cc-note-when{ font-size:11px; color:var(--tm); }
.cc-note-text{ margin:0; font-size:13px; line-height:1.5; color:var(--ts); }

/* milestones */
.cc-mile .cc-bar{ margin-bottom:12px; }
.cc-mlist{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1px; }
.cc-mrow{ display:flex; align-items:center; gap:10px; font-size:13px; padding:5px 0; color:var(--ts); }
.cc-mrow--done{ color:var(--tm); }
.cc-mrow--todo{ color:var(--tm); opacity:0.75; }
.cc-tick{ width:17px; height:17px; border-radius:50%; flex-shrink:0; border:1.5px solid var(--bdef); display:grid; place-items:center; }
.cc-tick--done{ background:rgba(var(--okrgb),0.14); border-color:rgba(var(--okrgb),0.4); color:var(--ok); }
.cc-mrow--next{ color:var(--tp); font-weight:700; }
.cc-tick--next{ border:2px solid var(--cd); box-shadow:0 0 0 3px rgba(var(--crgb),0.14); }
.cc-next-text{ flex:1; }
.cc-next-tag{ font-size:10px; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); padding:3px 8px; border-radius:999px; }

/* chain mini */
.cc-mini-list{ display:flex; flex-direction:column; gap:2px; }
.cc-mini-row{ display:flex; align-items:center; gap:9px; padding:7px 8px; border-radius:9px; font-size:13px; color:var(--ts); }
.cc-mini-row.is-you{ background:rgba(var(--crgb),0.08); }
.cc-mini-pos{ width:19px; height:19px; border-radius:50%; display:grid; place-items:center; font-size:10.5px; font-weight:800; color:var(--ts); background:var(--solid); border:1px solid var(--bdef); flex-shrink:0; }
.cc-mini-row.is-you .cc-mini-pos{ color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); border-color:transparent; }
.cc-mini-addr{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; color:var(--tp); }
.cc-mini-you{ font-size:10.5px; font-weight:750; color:var(--cd); }

/* next action */
.cc-next{ display:flex; flex-direction:column; }
.cc-next-eyebrow{ margin:0 0 4px; font-size:11px; font-weight:750; text-transform:uppercase; letter-spacing:0.05em; color:var(--cd); }
.cc-next-head{ margin:0 0 3px; font-size:15px; font-weight:730; letter-spacing:-0.01em; color:var(--tp); }
.cc-next-sub{ margin:0 0 13px; font-size:12px; color:var(--tm); }
.cc-next-btn{ align-self:flex-start; border:1px solid transparent; border-radius:10px; padding:9px 16px; font:inherit; font-size:13px; font-weight:700; color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px rgba(var(--crgb),0.3); cursor:pointer; }

/* rings */
.cc-ring-track{ stroke:rgba(45,24,16,0.1); } .cc-page.dark .cc-ring-track{ stroke:rgba(255,255,255,0.12); }
.cc-ring-fill{ stroke:var(--cd); }
.cc-ring-text{ font-size:12px; font-weight:800; fill:var(--tp); }

@media (prefers-reduced-motion:reduce){ *{ scroll-behavior:auto; } }
`;
