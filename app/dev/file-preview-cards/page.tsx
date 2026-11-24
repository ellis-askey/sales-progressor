"use client";

// /dev/file-preview-cards — PROTOTYPE for the file-preview drawer cards.
// Three sections, all mock data / presentation only:
//   1. Last comms  — reframed from "Latest note": latest real communication of
//      ANY kind (note / email / call / WhatsApp), system-note noise banned.
//   2. Next reminder — date + an enriched sub-string per reminder state.
//   3. Next step     — the fileNextStep ladder (18 strings) with proposed subtext.
// Strings mirror the real engines (lib/services/comms.ts, next-step.ts,
// lib/reminders/classify.ts). Nothing wired; founder reacts to pixels.

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, NotePencil, EnvelopeSimple, Phone, WhatsappLogo, Scales,
  UserCircle, BellRinging, WarningCircle, Clock, MoonStars as Snooze, CheckCircle,
  PauseCircle, ArrowRight,
} from "@phosphor-icons/react";

/* ─────────────────────────────── 1. LAST COMMS ─────────────────────────────── */
// Each row: what the latest comm on a file could be. `ban` = system-note noise
// that must NEVER surface here (it is not a real communication).
type CommRow = { icon: React.ReactNode; kind: string; who: string; snippet: string; when: string; ban?: boolean };
const COMMS: CommRow[] = [
  { icon: <NotePencil weight="fill" />, kind: "Note", who: "You", snippet: "Chased both solicitors. The buyer's side is waiting on searches.", when: "2h ago" },
  { icon: <EnvelopeSimple weight="fill" />, kind: "Email received", who: "Buyer's solicitor", snippet: "Replies to the enquiries are attached.", when: "Yesterday" },
  { icon: <Phone weight="fill" />, kind: "Call", who: "Seller", snippet: "Happy to proceed and available to sign on Friday.", when: "2d ago" },
  { icon: <WhatsappLogo weight="fill" />, kind: "WhatsApp", who: "Buyer", snippet: "Any update on when the mortgage offer will come through?", when: "3d ago" },
  { icon: <Scales weight="fill" />, kind: "Solicitor update", who: "Dentons", snippet: "We've issued the draft contract pack today.", when: "4d ago" },
  { icon: <UserCircle weight="fill" />, kind: "Portal note", who: "Buyer", snippet: "When can we book the survey?", when: "5d ago" },
];
const COMMS_BANNED = [
  "File assigned to {person}",
  "Sale status changed from X to Y",
  "Purchase price updated from X to Y",
  "Completion date changed from X to Y",
  "Chain update recorded: …",
  "{name} updated their details via the portal",
  "{name} viewed their client portal",
  "Client update emails sent immediately",
  "Setup note / survey quote link sent",
];

/* ────────────────────────────── 2. NEXT REMINDER ───────────────────────────── */
// state → { value (the big line), sub (the enriched line below) }. The label
// ("Chasing the buyer's solicitor — search results") is the milestone name we
// already load but currently discard.
type RemCard = { state: string; value: string; sub: string; tone: Tone; icon: React.ReactNode };
type Tone = "danger" | "warn" | "due" | "muted" | "ready" | "auto";
const REMINDERS: RemCard[] = [
  { state: "escalated", value: "Today", sub: "Escalated. The buyer's solicitor has been quiet for 12 days.", tone: "danger", icon: <WarningCircle weight="fill" /> },
  { state: "overdue", value: "Mon 16 Nov", sub: "Chasing the search results. Overdue by 3 days.", tone: "danger", icon: <BellRinging weight="fill" /> },
  { state: "due today", value: "Today", sub: "Chasing the buyer for the mortgage offer.", tone: "due", icon: <BellRinging weight="fill" /> },
  { state: "upcoming", value: "Thu 19 Nov", sub: "Chasing the buyer's solicitor for the enquiries.", tone: "muted", icon: <Clock weight="fill" /> },
  { state: "snoozed", value: "Wed 25 Nov", sub: "Snoozed until then.", tone: "muted", icon: <Snooze weight="fill" /> },
  { state: "none (autopilot)", value: "Nothing due", sub: "Autopilot is watching. No chase is needed yet.", tone: "auto", icon: <CheckCircle weight="fill" /> },
  { state: "none (off)", value: "Off", sub: "Auto-chase is off. Chase manually.", tone: "warn", icon: <PauseCircle weight="fill" /> },
  { state: "terminal", value: "None", sub: "The sale is complete.", tone: "muted", icon: <CheckCircle weight="fill" /> },
];

/* ─────────────────────────────── 3. NEXT STEP ──────────────────────────────── */
// The fileNextStep ladder in PRECEDENCE order (worst first). headline = today's
// string; sub = proposed enrichment (the milestone / why), currently absent.
type StepRow = { n: number; headline: string; sub: string; tone: Tone };
const STEPS: StepRow[] = [
  { n: 1, headline: "Escalated, needs you", sub: "The buyer's solicitor has been quiet for 12 days.", tone: "danger" },
  { n: 2, headline: "Buyer's solicitor's gone quiet, chase them", sub: "There's been no reply since the draft contract pack.", tone: "danger" },
  { n: 3, headline: "Autopilot's done, over to you", sub: "Every automated chase has been exhausted.", tone: "danger" },
  { n: 4, headline: "Chase bounced, update the buyer's email", sub: "Their email rejected the last two sends.", tone: "warn" },
  { n: 5, headline: "No email for the buyer, add one", sub: "We can't chase them without an email.", tone: "warn" },
  { n: 6, headline: "No solicitor on file, add one", sub: "The buyer's side has no firm yet.", tone: "warn" },
  { n: 7, headline: "Auto-chase off, chase manually", sub: "Autopilot is paused for this file.", tone: "warn" },
  { n: 8, headline: "Buyer opted out, reach them another way", sub: "They unsubscribed from chases.", tone: "warn" },
  { n: 9, headline: "Needs you", sub: "", tone: "danger" },
  { n: 10, headline: "Ready to exchange", sub: "All enquiries are satisfied and the contracts are signed.", tone: "ready" },
  { n: 11, headline: "Auto-chasing the buyer's solicitor", sub: "We're waiting for the search results.", tone: "auto" },
  { n: 12, headline: "Auto-chase resumes 19 Nov", sub: "Chasing is paused over the weekend.", tone: "muted" },
  { n: 13, headline: "You'll chase the buyer on 19 Nov", sub: "The chase is for the mortgage offer.", tone: "muted" },
  { n: 14, headline: "Chased the buyer, raises again 22 Nov", sub: "The chase is for the mortgage offer.", tone: "muted" },
  { n: 15, headline: "Snoozed until 25 Nov", sub: "This file has been paused manually.", tone: "muted" },
  { n: 16, headline: "Waiting on the chain", sub: "Your side is ready but the chain is not.", tone: "muted" },
  { n: 17, headline: "Awaiting completion", sub: "Completion is set for 2 December.", tone: "muted" },
  { n: 18, headline: "All progressing", sub: "Nothing is outstanding.", tone: "muted" },
];

export default function FilePreviewCardsDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);
  return (
    <div className="fpc-page" data-theme={dark ? "dark" : "light"}>
      <div className="fpc-top">
        <div>
          <h1 className="fpc-title">File-preview cards, enriched</h1>
          <p className="fpc-lede">Last comms, Next reminder, Next step. Mock strings, mirrored from the real engines. React to the pixels.</p>
        </div>
        <button type="button" className="fpc-theme" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
          {dark ? <Sun size={16} weight="fill" /> : <MoonStars size={16} weight="fill" />}
        </button>
      </div>

      {/* 1 ─ LAST COMMS */}
      <section className="fpc-sec">
        <h2 className="fpc-h2"><span className="fpc-h2-n">1</span>Last comms <span className="fpc-h2-note">(was "Latest note")</span></h2>
        <div className="fpc-card fpc-card-wide">
          <span className="fpc-lab">Last comms</span>
          <div className="fpc-comm">
            <span className="fpc-comm-ic">{COMMS[0].icon}</span>
            <div className="fpc-comm-body">
              <div className="fpc-comm-head"><b>{COMMS[0].kind}</b><span className="fpc-comm-who">{COMMS[0].who}</span><span className="fpc-when">{COMMS[0].when}</span></div>
              <div className="fpc-comm-snip">{COMMS[0].snippet}</div>
            </div>
          </div>
        </div>
        <p className="fpc-cap">Any of these can be the latest comm:</p>
        <div className="fpc-grid">
          {COMMS.map((c, i) => (
            <div key={i} className="fpc-mini">
              <span className="fpc-mini-ic">{c.icon}</span>
              <div className="fpc-mini-body"><b>{c.kind}</b><div className="fpc-mini-sub">{c.who}</div></div>
            </div>
          ))}
        </div>
        <p className="fpc-cap">Banned system notes (never a real comm):</p>
        <div className="fpc-ban-list">
          {COMMS_BANNED.map((b, i) => <span key={i} className="fpc-ban">{b}</span>)}
        </div>
      </section>

      {/* 2 ─ NEXT REMINDER */}
      <section className="fpc-sec">
        <h2 className="fpc-h2"><span className="fpc-h2-n">2</span>Next reminder <span className="fpc-h2-note">(date with an enriched line below)</span></h2>
        <div className="fpc-cards">
          {REMINDERS.map((r, i) => (
            <div key={i} className={`fpc-card tone-${r.tone}`}>
              <span className="fpc-lab">Next reminder <span className="fpc-state">{r.state}</span></span>
              <div className="fpc-val-row"><span className="fpc-ic">{r.icon}</span><span className="fpc-val">{r.value}</span></div>
              <div className="fpc-sub">{r.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 ─ NEXT STEP */}
      <section className="fpc-sec">
        <h2 className="fpc-h2"><span className="fpc-h2-n">3</span>Next step <span className="fpc-h2-note">(ladder in precedence order, headline then subtext)</span></h2>
        <div className="fpc-steps">
          {STEPS.map((s) => (
            <div key={s.n} className={`fpc-step tone-${s.tone}`}>
              <span className="fpc-step-n">{s.n}</span>
              <span className={`fpc-step-dot dot-${s.tone}`} />
              <div className="fpc-step-body">
                <div className="fpc-step-head">{s.headline}</div>
                {s.sub && <div className="fpc-step-sub"><ArrowRight size={11} weight="bold" /> {s.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fpc-page{ min-height:100vh; background:var(--bg); color:var(--tx); padding:36px 20px 80px;
  --bg:#f6f7f9; --surface:#fff; --tx:#0f172a; --tx2:#475569; --tx3:#94a3b8; --border:rgba(15,23,42,0.08); --border2:rgba(15,23,42,0.12);
  --coral:#FF6B4A; --danger:#dc2626; --warn:#b45309; --due:#c2410c; --ready:#047857; --auto:#0369a1; --muted:#64748b;
  --tint:rgba(15,23,42,0.03); font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; }
.fpc-page[data-theme="dark"]{ --bg:#0d1117; --surface:#161b22; --tx:#e6edf3; --tx2:#9ba7b4; --tx3:#6b7684; --border:rgba(255,255,255,0.09); --border2:rgba(255,255,255,0.14);
  --danger:#f87171; --warn:#fbbf24; --due:#fb923c; --ready:#34d399; --auto:#38bdf8; --muted:#94a3b8; --tint:rgba(255,255,255,0.04); }

.fpc-top{ max-width:960px; margin:0 auto 26px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.fpc-title{ margin:0; font-size:21px; font-weight:760; letter-spacing:-0.02em; }
.fpc-lede{ margin:6px 0 0; font-size:13px; color:var(--tx2); max-width:60ch; }
.fpc-theme{ flex-shrink:0; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px;
  border:1px solid var(--border2); background:var(--surface); color:var(--tx2); cursor:pointer; }
.fpc-theme:hover{ color:var(--tx); border-color:var(--coral); }

.fpc-sec{ max-width:960px; margin:0 auto 38px; }
.fpc-h2{ margin:0 0 14px; font-size:14px; font-weight:700; letter-spacing:-0.01em; display:flex; align-items:center; gap:8px; }
.fpc-h2-n{ flex-shrink:0; width:20px; height:20px; border-radius:6px; background:var(--coral); color:#fff; font-size:11.5px; font-weight:750; display:inline-flex; align-items:center; justify-content:center; }
.fpc-h2-note{ font-weight:500; color:var(--tx3); font-size:12.5px; }
.fpc-cap{ margin:18px 0 9px; font-size:11.5px; font-weight:650; text-transform:uppercase; letter-spacing:0.05em; color:var(--tx3); }

/* card shell (reused by reminder + last-comms) */
.fpc-card{ background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:13px 15px; display:flex; flex-direction:column; gap:7px; }
.fpc-card-wide{ max-width:460px; }
.fpc-lab{ font-size:11px; font-weight:650; text-transform:uppercase; letter-spacing:0.05em; color:var(--tx3); display:flex; align-items:center; gap:7px; }
.fpc-state{ text-transform:none; letter-spacing:0; font-weight:600; color:var(--tx3); background:var(--tint); padding:1px 7px; border-radius:999px; font-size:10.5px; }

/* last comms */
.fpc-comm{ display:flex; gap:11px; align-items:flex-start; }
.fpc-comm-ic{ flex-shrink:0; width:30px; height:30px; border-radius:9px; background:var(--tint); color:var(--coral); display:inline-flex; align-items:center; justify-content:center; font-size:15px; margin-top:1px; }
.fpc-comm-ic svg{ width:16px; height:16px; }
.fpc-comm-body{ min-width:0; }
.fpc-comm-head{ font-size:12.5px; color:var(--tx2); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.fpc-comm-head b{ color:var(--tx); font-weight:650; }
.fpc-comm-who{ color:var(--tx2); }
.fpc-when{ margin-left:auto; color:var(--tx3); font-size:11.5px; }
.fpc-comm-snip{ margin-top:3px; font-size:13px; color:var(--tx); line-height:1.4; }

.fpc-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:9px; }
.fpc-mini{ display:flex; gap:9px; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:11px; padding:9px 11px; }
.fpc-mini-ic{ flex-shrink:0; width:26px; height:26px; border-radius:8px; background:var(--tint); color:var(--coral); display:inline-flex; align-items:center; justify-content:center; }
.fpc-mini-ic svg{ width:14px; height:14px; }
.fpc-mini-body b{ font-size:12.5px; font-weight:650; color:var(--tx); }
.fpc-mini-sub{ font-size:11.5px; color:var(--tx3); }

.fpc-ban-list{ display:flex; flex-wrap:wrap; gap:7px; }
.fpc-ban{ font-size:12px; color:var(--tx3); background:var(--tint); border:1px dashed var(--border2); border-radius:8px; padding:4px 9px; text-decoration:line-through; text-decoration-color:var(--tx3); }

/* reminder cards */
.fpc-cards{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:11px; }
.fpc-val-row{ display:flex; align-items:center; gap:8px; }
.fpc-ic{ display:inline-flex; color:var(--muted); }
.fpc-ic svg{ width:17px; height:17px; }
.fpc-val{ font-size:17px; font-weight:720; letter-spacing:-0.01em; color:var(--tx); font-variant-numeric:tabular-nums; }
.fpc-sub{ font-size:12.5px; color:var(--tx2); line-height:1.35; }
.tone-danger .fpc-ic{ color:var(--danger); } .tone-danger .fpc-val{ color:var(--danger); }
.tone-due .fpc-ic{ color:var(--due); } .tone-due .fpc-val{ color:var(--due); }
.tone-warn .fpc-ic{ color:var(--warn); }
.tone-ready .fpc-ic{ color:var(--ready); } .tone-ready .fpc-val{ color:var(--ready); }
.tone-auto .fpc-ic{ color:var(--auto); }

/* next-step ladder */
.fpc-steps{ display:flex; flex-direction:column; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.fpc-step{ display:flex; align-items:center; gap:12px; background:var(--surface); padding:11px 15px; }
.fpc-step-n{ flex-shrink:0; width:22px; font-size:11.5px; font-weight:700; color:var(--tx3); font-variant-numeric:tabular-nums; text-align:right; }
.fpc-step-dot{ flex-shrink:0; width:8px; height:8px; border-radius:50%; }
.dot-danger{ background:var(--danger); } .dot-warn{ background:var(--warn); } .dot-due{ background:var(--due); }
.dot-ready{ background:var(--ready); } .dot-auto{ background:var(--auto); } .dot-muted{ background:var(--tx3); }
.fpc-step-body{ min-width:0; }
.fpc-step-head{ font-size:13.5px; font-weight:600; color:var(--tx); }
.fpc-step-sub{ font-size:12px; color:var(--tx3); display:flex; align-items:center; gap:4px; margin-top:1px; }
.fpc-step-sub svg{ flex-shrink:0; }
`;
