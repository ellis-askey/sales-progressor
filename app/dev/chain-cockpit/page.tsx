"use client";

// /dev/chain-cockpit — focused preview: on the CHAIN tab, the right-hand
// "Sale health" column is swapped for a compact panel that shows a mini steps
// view (seller/buyer toggle) and, underneath, the file's notes with an inline
// add-a-note box. Self-contained mock, no wiring.

import { useState } from "react";
import { notFound } from "next/navigation";

/* ─────────── tiny primitives ─────────── */

function Tick({ state }: { state: "done" | "next" | "todo" }) {
  if (state === "done") {
    return (
      <span className="cc-tk cc-tk--done" aria-hidden>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </span>
    );
  }
  return <span className={`cc-tk ${state === "next" ? "cc-tk--next" : ""}`} aria-hidden />;
}

function Chip({ tone, children }: { tone: "ftb" | "terminal"; children: React.ReactNode }) {
  return <span className={`cc-chip cc-chip--${tone}`}>{children}</span>;
}

// Initials avatar — the SVG/photo fallback the rest of the app uses.
function Avatar({ initials, colour, size = 22 }: { initials: string; colour: string; size?: number }) {
  return <span className="cc-avatar" style={{ background: colour, width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}

/* ─────────── mini steps (per side) ─────────── */

type Step = { label: string; state: "done" | "next" | "todo" };
const SELLER_STEPS: Step[] = [
  { label: "Solicitor instructed", state: "done" },
  { label: "Memorandum of sale", state: "done" },
  { label: "Property forms returned", state: "done" },
  { label: "Draft contract issued", state: "done" },
  { label: "Enquiries received", state: "done" },
  { label: "Reply to enquiries", state: "next" },
  { label: "Replies sent", state: "todo" },
  { label: "Ready to exchange", state: "todo" },
  { label: "Exchange", state: "todo" },
  { label: "Completion", state: "todo" },
];
const BUYER_STEPS: Step[] = [
  { label: "Solicitor instructed", state: "done" },
  { label: "Money on account", state: "done" },
  { label: "Searches ordered", state: "done" },
  { label: "Search results back", state: "done" },
  { label: "Survey booked", state: "done" },
  { label: "Enquiries raised", state: "next" },
  { label: "Mortgage offer", state: "todo" },
  { label: "Report on title", state: "todo" },
  { label: "Exchange", state: "todo" },
  { label: "Completion", state: "todo" },
];

function MiniSteps() {
  const [side, setSide] = useState<"seller" | "buyer">("seller");
  const steps = side === "seller" ? SELLER_STEPS : BUYER_STEPS;
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <div>
      {/* Sliding toggle — the selection is the primary colour and glides across. */}
      <div className="cc-toggle" role="tablist" aria-label="Side">
        <span className="cc-toggle-ind" data-side={side} aria-hidden />
        <button role="tab" aria-selected={side === "seller"} className={`cc-toggle-btn${side === "seller" ? " on" : ""}`} onClick={() => setSide("seller")}>Seller</button>
        <button role="tab" aria-selected={side === "buyer"} className={`cc-toggle-btn${side === "buyer" ? " on" : ""}`} onClick={() => setSide("buyer")}>Buyer</button>
      </div>
      <div className="cc-steps-meta">
        <span>{done} of {steps.length} done</span>
        <span className="cc-steps-stage">Enquiries</span>
      </div>
      <ul className="cc-steps">
        {steps.map((s) => (
          <li key={s.label} className={`cc-step cc-step--${s.state}`}>
            <Tick state={s.state} />
            <span className="cc-step-label">{s.label}</span>
            {s.state === "next" && <span className="cc-step-next">Next</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────── notes + inline composer ─────────── */

const NOTES = [
  { who: "Ellis Askey", initials: "EA", colour: "#C77D1A", when: "Today · 11:52", text: "Buyer's solicitor confirmed searches back, nothing flagged. Pushing enquiries this week." },
  { who: "Laura Chen", initials: "LC", colour: "#3B7DE0", when: "Mon · 16:05", text: "Top of chain confirmed not buying on — chain ends here. All keen to exchange before month-end." },
  { who: "Ellis Askey", initials: "EA", colour: "#C77D1A", when: "Fri · 09:20", text: "Okafors' mortgage offer through. Chasing their solicitor for the signed contract." },
];

function NotesPanel() {
  const [draft, setDraft] = useState("");
  return (
    <div className="cc-notes">
      <div className="cc-notes-head">
        <h4>Notes</h4>
        <span className="cc-notes-hint">On this sale</span>
      </div>

      {/* Inline composer — small, drag-to-resize like the app's note inputs. */}
      <div className={`cc-compose${draft ? " is-active" : ""}`}>
        <textarea
          className="cc-compose-input"
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="cc-compose-row">
          <button className="cc-compose-save" type="button" disabled={!draft.trim()}>Add note</button>
        </div>
      </div>

      <div className="cc-note-list">
        {NOTES.map((n, i) => (
          <div key={i} className="cc-note">
            <Avatar initials={n.initials} colour={n.colour} />
            <div className="cc-note-body">
              <div className="cc-note-top">
                <span className="cc-note-who">{n.who}</span>
                <span className="cc-note-when">{n.when}</span>
              </div>
              <p className="cc-note-text">{n.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RightColumn() {
  return (
    <aside className="cc-right">
      <MiniSteps />
      <div className="cc-divider" />
      <NotesPanel />
    </aside>
  );
}

/* ─────────── left: compact chain (keeps the at-a-glance markers) ─────────── */

const CHAIN = [
  { pos: 3, addr: "4 Old Oak Gardens", town: "Berkhamsted · HP4", pct: 84, marker: "terminal" as const, you: false },
  { pos: 2, addr: "41 Woodpecker Close", town: "Bedford · MK44", pct: 42, you: true },
  { pos: 1, addr: "14 Marlowe Court", town: "Hemel Hempstead · HP1", pct: 35, marker: "ftb" as const, you: false },
];

function ChainLeft() {
  return (
    <div className="cc-left">
      <div className="cc-left-head">
        <div className="cc-left-tabs"><span className="on">Timeline</span><span>Map</span></div>
        <button className="cc-email" type="button">Email the chain</button>
      </div>
      {CHAIN.map((n) => (
        <div key={n.pos} className={`cc-cnode${n.you ? " is-you" : ""}`}>
          <span className="cc-cpos">{n.pos}</span>
          <div className="cc-ccard">
            <div className="cc-crow">
              <div style={{ minWidth: 0 }}>
                <p className="cc-caddr">{n.addr}</p>
                <p className="cc-ctown">{n.town}</p>
              </div>
              <div className="cc-cright">
                {n.marker === "ftb" && <Chip tone="ftb">First-time buyer · bottom</Chip>}
                {n.marker === "terminal" && <Chip tone="terminal">No onward purchase · top</Chip>}
                {n.you && <span className="cc-cyou">You&rsquo;re here</span>}
              </div>
            </div>
            <span className="cc-cbar"><span style={{ width: `${n.pct}%` }} /></span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────── page ─────────── */

export default function ChainCockpitDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);
  return (
    <div className={`cc-page${dark ? " dark" : ""}`}>
      <div className="cc-wrap">
        <header className="cc-top">
          <div>
            <h1 className="cc-h1">Chain tab — steps &amp; notes where health used to be</h1>
            <p className="cc-lede">The right column shows a mini steps view (seller/buyer toggle) and the file&rsquo;s notes, with a box to jot one down there and then. Chain keeps the first-time-buyer / top-of-chain markers on the left.</p>
          </div>
          <button className="cc-theme" type="button" onClick={() => setDark((v) => !v)}>{dark ? "Light" : "Dark"}</button>
        </header>

        <div className="cc-frame">
          <ChainLeft />
          <RightColumn />
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
  --ok:#1F8A4A; --okrgb:31,138,74; --amber:#C77D1A;
  --surface:rgba(255,255,255,0.80); --solid:#fff;
  --bsub:rgba(45,24,16,0.08); --bdef:rgba(45,24,16,0.13); --sunk:rgba(45,24,16,0.05);
  --seller:#3B7DE0; --buyer:#0F9D6B;
  --bg1:#fbf1ec; --bg2:#eef2f8; --bg3:#faf0f4;
  min-height:100vh; color:var(--tp); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  background:radial-gradient(1100px 620px at 10% -10%, rgba(var(--crgb),0.09), transparent 60%),radial-gradient(900px 560px at 110% 2%, rgba(64,116,214,0.09), transparent 58%),linear-gradient(160deg,var(--bg1),var(--bg2) 55%,var(--bg3));
  padding:40px 20px 72px;
}
.cc-page.dark{
  --tp:#F3EAE4; --ts:#CBB9AC; --tm:rgba(243,234,228,0.52);
  --coral:#FF8A65; --cd:#FF7A58; --crgb:255,122,88;
  --ok:#35C06A; --okrgb:53,192,106; --amber:#E0A458;
  --surface:rgba(34,28,25,0.62); --solid:#241e1b;
  --bsub:rgba(255,255,255,0.08); --bdef:rgba(255,255,255,0.14); --sunk:rgba(255,255,255,0.05);
  --seller:#6AA0F0; --buyer:#2FC58A; --bg1:#17110f; --bg2:#121418; --bg3:#181115;
  background:radial-gradient(1100px 620px at 10% -10%, rgba(var(--crgb),0.15), transparent 60%),radial-gradient(900px 560px at 110% 2%, rgba(90,130,210,0.13), transparent 58%),linear-gradient(160deg,var(--bg1),var(--bg2) 55%,var(--bg3));
}
.cc-wrap{ max-width:940px; margin:0 auto; }
.cc-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:26px; }
.cc-h1{ margin:0; font-size:24px; font-weight:800; letter-spacing:-0.025em; }
.cc-lede{ margin:8px 0 0; font-size:13.5px; line-height:1.55; color:var(--ts); max-width:66ch; }
.cc-theme{ flex-shrink:0; border:1px solid var(--bdef); background:var(--surface); color:var(--ts); border-radius:10px; padding:8px 15px; font:inherit; font-size:12.5px; font-weight:650; cursor:pointer; backdrop-filter:blur(12px); transition:border-color .15s; }
.cc-theme:hover{ border-color:var(--cd); }

.cc-frame{ display:grid; grid-template-columns:1fr 336px; gap:18px; align-items:start; }
@media (max-width:820px){ .cc-frame{ grid-template-columns:1fr; } }

/* left */
.cc-left-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.cc-left-tabs{ display:inline-flex; gap:3px; padding:3px; border-radius:10px; background:var(--sunk); border:1px solid var(--bsub); }
.cc-left-tabs span{ font-size:12.5px; font-weight:650; color:var(--tm); padding:6px 14px; border-radius:8px; }
.cc-left-tabs span.on{ color:var(--tp); background:var(--solid); box-shadow:0 1px 2px rgba(20,14,10,0.1); }
.cc-email{ border:1px solid var(--bdef); background:var(--surface); color:var(--ts); border-radius:9px; padding:7px 13px; font:inherit; font-size:12px; font-weight:650; cursor:pointer; transition:border-color .15s; }
.cc-email:hover{ border-color:var(--cd); }

.cc-cnode{ display:flex; gap:12px; }
.cc-cpos{ width:24px; height:24px; border-radius:50%; display:grid; place-items:center; font-size:11px; font-weight:800; color:var(--ts); background:var(--solid); border:1.5px solid var(--bdef); flex-shrink:0; margin-top:12px; }
.cc-cnode.is-you .cc-cpos{ color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); border-color:transparent; }
.cc-ccard{ flex:1; min-width:0; margin-bottom:10px; border:1px solid var(--bsub); background:var(--surface); backdrop-filter:blur(16px) saturate(1.4); border-radius:14px; padding:13px 15px; box-shadow:0 2px 4px rgba(20,14,10,0.04); }
.cc-cnode.is-you .cc-ccard{ border-color:rgba(var(--crgb),0.5); box-shadow:0 0 0 1px rgba(var(--crgb),0.3); }
.cc-crow{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px; }
.cc-caddr{ margin:0; font-size:14.5px; font-weight:720; letter-spacing:-0.01em; }
.cc-ctown{ margin:2px 0 0; font-size:11.5px; color:var(--tm); }
.cc-cright{ display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0; }
.cc-cyou{ font-size:11px; font-weight:750; color:var(--cd); }
.cc-cbar{ display:block; height:5px; border-radius:999px; background:var(--sunk); overflow:hidden; }
.cc-cbar span{ display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,var(--coral),var(--cd)); }

.cc-chip{ display:inline-flex; align-items:center; font-size:10px; font-weight:750; padding:3px 9px; border-radius:999px; white-space:nowrap; border:1px solid transparent; }
.cc-chip--ftb{ color:var(--buyer); background:rgba(15,157,107,0.12); border-color:rgba(15,157,107,0.26); }
.cc-chip--terminal{ color:var(--amber); background:rgba(199,125,26,0.12); border-color:rgba(199,125,26,0.28); }
.cc-page.dark .cc-chip--terminal{ background:rgba(224,164,88,0.14); border-color:rgba(224,164,88,0.3); }

/* right column */
.cc-right{ border:1px solid var(--bsub); background:var(--surface); backdrop-filter:blur(20px) saturate(1.5); border-radius:16px; padding:14px; box-shadow:0 2px 4px rgba(20,14,10,0.04), 0 18px 38px -26px rgba(20,14,10,0.24); }

/* sliding toggle — selection is primary colour, glides across */
.cc-toggle{ position:relative; display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:11px; background:var(--sunk); border:1px solid var(--bsub); }
.cc-toggle-ind{ position:absolute; top:4px; bottom:4px; left:4px; width:calc(50% - 6px); border-radius:8px;
  background:linear-gradient(180deg,var(--coral),var(--cd)); box-shadow:0 2px 8px rgba(var(--crgb),0.35), inset 0 1px 0 rgba(255,255,255,0.28);
  transition:transform 280ms cubic-bezier(0.22,1,0.36,1); z-index:0; }
.cc-toggle-ind[data-side="buyer"]{ transform:translateX(calc(100% + 4px)); }
.cc-toggle-btn{ position:relative; z-index:1; border:1px solid transparent; cursor:pointer; padding:8px 10px; border-radius:8px; font:inherit; font-size:12.5px; font-weight:680; background:transparent; color:var(--tm); transition:color .18s, border-color .15s; }
.cc-toggle-btn.on{ color:#fff; }
.cc-toggle-btn:not(.on):hover{ color:var(--ts); border-color:var(--bdef); }
@media (prefers-reduced-motion:reduce){ .cc-toggle-ind{ transition:none; } }

.cc-steps-meta{ display:flex; align-items:center; justify-content:space-between; margin:14px 2px 8px; font-size:11.5px; color:var(--tm); font-weight:600; }
.cc-steps-stage{ color:var(--cd); font-weight:700; }
.cc-steps{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1px; }
.cc-step{ display:flex; align-items:center; gap:9px; font-size:12.5px; padding:4px 2px; color:var(--ts); }
.cc-step--done{ color:var(--tm); }
.cc-step--todo{ color:var(--tm); opacity:0.7; }
.cc-step--next{ color:var(--tp); font-weight:700; }
.cc-step-label{ flex:1; min-width:0; }
.cc-step-next{ font-size:10.5px; font-weight:700; color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); padding:2px 9px; border-radius:999px; }
.cc-tk{ width:16px; height:16px; border-radius:50%; flex-shrink:0; border:1.5px solid var(--bdef); display:grid; place-items:center; }
.cc-tk--done{ background:rgba(var(--okrgb),0.14); border-color:rgba(var(--okrgb),0.4); color:var(--ok); }
.cc-tk--next{ border:2px solid var(--cd); box-shadow:0 0 0 3px rgba(var(--crgb),0.14); }

.cc-divider{ height:1px; background:var(--bsub); margin:14px 0; }

/* notes */
.cc-notes-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:10px; }
.cc-notes-head h4{ margin:0; font-size:13.5px; font-weight:740; }
.cc-notes-hint{ font-size:11px; color:var(--tm); }

.cc-compose{ border:1px solid var(--bdef); background:var(--solid); border-radius:12px; padding:8px 10px; margin-bottom:16px; transition:border-color .15s, box-shadow .15s; }
.cc-compose:hover{ border-color:var(--cd); }
.cc-compose.is-active{ border-color:var(--cd); box-shadow:0 0 0 3px rgba(var(--crgb),0.1); }
.cc-compose-input{ width:100%; min-height:30px; height:30px; max-height:160px; border:0; background:transparent; resize:vertical; font:inherit; font-size:12.5px; color:var(--tp); outline:none; line-height:1.5; display:block; }
.cc-compose-input::placeholder{ color:var(--tm); }
.cc-compose-row{ display:flex; justify-content:flex-end; margin-top:6px; }
.cc-compose-save{ border:1px solid transparent; border-radius:8px; padding:6px 13px; font:inherit; font-size:12px; font-weight:700; color:#fff; background:linear-gradient(180deg,var(--coral),var(--cd)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.28); cursor:pointer; transition:filter .15s; }
.cc-compose-save:hover:not(:disabled){ filter:brightness(1.05); }
.cc-compose-save:disabled{ opacity:0.45; cursor:default; }

.cc-note-list{ display:flex; flex-direction:column; gap:14px; }
.cc-note{ display:flex; gap:10px; }
.cc-avatar{ border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-weight:800; color:#fff; letter-spacing:0.02em; margin-top:1px; }
.cc-note-body{ flex:1; min-width:0; }
.cc-note-top{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:2px; }
.cc-note-who{ font-size:12.5px; font-weight:700; color:var(--tp); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cc-note-when{ font-size:10.5px; color:var(--tm); flex-shrink:0; }
.cc-note-text{ margin:0; font-size:12.5px; line-height:1.5; color:var(--ts); }
`;
