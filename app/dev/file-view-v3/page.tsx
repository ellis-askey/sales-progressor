"use client";

// /dev/file-view-v3 — CONCEPT. A radically different take on the agent file view.
// Dev-only, blocks in production. Mock data in the production shape. Self-contained:
// no shared component, token, or production page is touched.
//
// Thesis: a property sale is two solicitors racing toward one convergence point.
// So the hero is not a progress bar or a checklist — it is a CONVERGENCE TIMELINE:
// seller and buyer run as two lanes across real time and physically bend to meet
// at the Exchange gate. Progress is spatial; the live front and any stall are
// visible as position, not as a percentage. Around it, a card-less editorial
// dossier: hairlines not rounded cards, warm paper not glass, monospace for the
// temporal data (this screen measures a transaction against time), and coral used
// exactly once — on the blocker, the one action, and the exchange gate.
//
// Preserves TSP identity (warm ink, coral, the two-sided weighted milestone model)
// in a substantially different visual world.

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, PaperPlaneTilt, NotePencil, Check, Phone,
  EnvelopeSimple, ArrowRight,
} from "@phosphor-icons/react";

// ── Palette (tokens where branded, fixed where categorical) ──────────────────
const CORAL = "var(--agent-coral-deep)";       // the single accent
const INK = "#2D1810";
const INK2 = "rgba(45,24,16,0.62)";
const INK3 = "rgba(45,24,16,0.42)";
const INK4 = "rgba(45,24,16,0.28)";
const HAIR = "rgba(45,24,16,0.11)";
const HAIR2 = "rgba(45,24,16,0.06)";
const SELLER = "#4F46E5";   // vendor accent
const BUYER = "#BE185D";    // purchaser accent
const CORAL_HEX = "#F0532B";
const GREEN = "#1F8A4A";

const FILE = {
  address: "14 Alderton Rise",
  town: "Hertford",
  postcode: "SG14 2PL",
  tenure: "Leasehold",
  price: "£465,000",
  service: "Outsourced progression",
  seller: "Priya & Daniel Osei",
  buyer: "Marcus Whitlock",
  sellerSol: "Hartfield & Rowe",
  buyerSol: "Castleton Legal",
  progressor: "Ellis Askey",
  forecast: "9 Dec",
  weeksOut: "5",
  overall: 45,
  sellerPct: 44,
  buyerPct: 46,
};

// ── Timeline geometry — real dates on a linear Aug 20 → Dec 9 axis ────────────
// viewBox 1000×250. Date axis maps day0 (20 Aug) → x=52, day111 (9 Dec) → x=872.
const X0 = 52, XEX = 872, DAYS = 111, PXD = (XEX - X0) / DAYS;
const x = (d: number) => X0 + PXD * d;
const yS = 86, yB = 168, yC = 127;     // seller lane, buyer lane, convergence centre
const XTODAY = x(73);                    // 1 Nov
const XCOMP = 948;

type Tick = { d: number; faint?: boolean };
const SELLER_DONE: Tick[] = [8, 9, 14, 16, 19, 26, 29, 31, 42].map((d) => ({ d }));
const BUYER_DONE: Tick[] = [10, 10.6, 15, 20, 23, 30, 31, 32, 35, 42, 43, 45].map((d) => ({ d }));

// ── Milestone ledger (same two-sided model, reimagined as a dossier) ─────────
type LStep = { name: string; state: "done" | "live" | "ready" | "ahead" };
type LPhase = { label: string; steps: LStep[] };
const SELLER_PHASES: LPhase[] = [
  { label: "Onboarding", steps: [
    { name: "Solicitor instructed", state: "done" },
    { name: "Memorandum of sale", state: "done" },
    { name: "Welcome pack received", state: "done" },
    { name: "ID & AML checks", state: "done" },
    { name: "Property forms received", state: "done" },
    { name: "Completed forms returned", state: "done" },
  ]},
  { label: "Conveyancing", steps: [
    { name: "Draft contract pack issued", state: "done" },
    { name: "Management pack requested", state: "done" },
    { name: "Management pack received", state: "done" },
    { name: "Enquiries received", state: "live" },
    { name: "All enquiries satisfied", state: "ahead" },
  ]},
];
const BUYER_PHASES: LPhase[] = [
  { label: "Onboarding", steps: [
    { name: "Solicitor instructed", state: "done" },
    { name: "Memorandum of sale", state: "done" },
    { name: "ID & AML checks", state: "done" },
    { name: "Money on account paid", state: "done" },
  ]},
  { label: "Finances & survey", steps: [
    { name: "Mortgage application", state: "done" },
    { name: "Lender valuation booked", state: "done" },
    { name: "Mortgage offer received", state: "done" },
    { name: "Survey booked & reported", state: "done" },
  ]},
  { label: "Conveyancing", steps: [
    { name: "Draft contract pack received", state: "done" },
    { name: "Searches ordered", state: "done" },
    { name: "Management pack received", state: "done" },
    { name: "Search results received", state: "ready" },
    { name: "Enquiries raised", state: "live" },
    { name: "All enquiries satisfied", state: "ahead" },
  ]},
];
// Shared run-in to exchange (both solicitors converge here)
const CONVERGE: LStep[] = [
  { name: "Reports to clients & contracts signed", state: "ahead" },
  { name: "Both solicitors ready to exchange", state: "ahead" },
];

type Movement = { date: string; text: string; accent?: string };
const MOVEMENTS: Movement[] = [
  { date: "29 Oct", text: "Chased the seller’s solicitor for enquiry replies", accent: CORAL_HEX },
  { date: "09 Oct", text: "Search results received and confirmed", accent: GREEN },
  { date: "07 Oct", text: "Buyer’s solicitor raised initial enquiries" },
  { date: "02 Oct", text: "Mortgage offer received", accent: GREEN },
  { date: "01 Oct", text: "Management pack received from the freeholder" },
];

const NAV = ["Overview", "Both sides", "Chain", "Reminders", "To-do", "Documents", "Activity", "Client portal"];

export default function FileViewV3() {
  if (process.env.NODE_ENV === "production") notFound();
  const [view, setView] = useState<"Overview" | "Both sides">("Overview");

  return (
    <div className="fv3-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="fv3-frame fv3-enter">
        {/* ── Index rail ─────────────────────────────────────────── */}
        <nav className="fv3-rail">
          <a className="fv3-back" href="#" onClick={(e) => e.preventDefault()}>
            <ArrowLeft size={14} weight="bold" /> <span>All files</span>
          </a>
          <ul className="fv3-nav">
            {NAV.map((n) => {
              const active = n === view;
              const live = n === "Overview" || n === "Both sides";
              return (
                <li key={n}>
                  <button
                    className={`fv3-navitem${active ? " is-active" : ""}`}
                    onClick={() => live && setView(n as "Overview" | "Both sides")}
                  >
                    <span className="fv3-nav-tick" />
                    {n}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="fv3-rail-foot">
            <span className="fv3-rail-foot-label">Handled by</span>
            <span className="fv3-rail-handler"><span className="fv3-ava">EA</span>{FILE.progressor}</span>
          </div>
        </nav>

        {/* ── Main column ────────────────────────────────────────── */}
        <main className="fv3-main">
          <Masthead />
          {view === "Overview" ? <Overview /> : <BothSides />}
        </main>
      </div>
    </div>
  );
}

function Masthead() {
  return (
    <header className="fv3-masthead">
      <div className="fv3-mast-id">
        <div className="fv3-mast-line1">
          <h1 className="fv3-address">{FILE.address}</h1>
          <span className="fv3-live">
            <span className="fv3-live-dot" /> Active
          </span>
        </div>
        <div className="fv3-mast-meta">
          <span className="fv3-mono">{FILE.town} {FILE.postcode}</span>
          <span className="fv3-sep">/</span>
          <span>{FILE.tenure}</span>
          <span className="fv3-sep">/</span>
          <span className="fv3-mono">{FILE.price}</span>
          <span className="fv3-sep">/</span>
          <span className="fv3-mast-parties">
            <span className="fv3-pmark" style={{ background: SELLER }} />{FILE.seller}
            <ArrowRight size={11} weight="bold" className="fv3-parrow" />
            <span className="fv3-pmark" style={{ background: BUYER }} />{FILE.buyer}
          </span>
        </div>
      </div>
      <div className="fv3-mast-forecast">
        <span className="fv3-fore-label">Approaching exchange</span>
        <span className="fv3-fore-value">
          <span className="fv3-mono fv3-fore-weeks">~{FILE.weeksOut}</span> weeks
        </span>
        <span className="fv3-fore-sub"><span className="fv3-mono">{FILE.forecast}</span> · on track</span>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Overview() {
  return (
    <>
      <section className="fv3-timeline-wrap">
        <ConvergenceTimeline />
      </section>

      {/* The front — the single most important read */}
      <section className="fv3-front">
        <div className="fv3-front-main">
          <h2 className="fv3-front-head">The sale is waiting on one thing.</h2>
          <p className="fv3-front-body">
            The seller’s solicitor has held the enquiries for over three weeks. Everything else on
            both sides is done or moving. Clear this and the file runs to exchange.
          </p>
          <div className="fv3-front-actions">
            <button className="fv3-btn fv3-btn-primary"><PaperPlaneTilt size={15} weight="fill" /> Send a chase</button>
            <button className="fv3-btn fv3-btn-ghost"><NotePencil size={14} /> Log an update</button>
            <span className="fv3-front-note fv3-mono">last chased 29 Oct</span>
          </div>
        </div>
        <div className="fv3-front-side">
          <span className="fv3-front-side-label">Also ready</span>
          <p className="fv3-front-side-text">Buyer’s search results are back and can be confirmed.</p>
          <button className="fv3-btn fv3-btn-mini"><Check size={13} weight="bold" /> Confirm</button>
        </div>
      </section>

      {/* Editorial band — people / movements / numbers, hairline-divided */}
      <section className="fv3-band">
        <div className="fv3-band-col">
          <h3 className="fv3-band-title">The people</h3>
          <Roster color={SELLER} role="Seller" name={FILE.seller} />
          <Roster color={SELLER} role="Seller’s solicitor" name={FILE.sellerSol} faint />
          <Roster color={BUYER} role="Buyer" name={FILE.buyer} />
          <Roster color={BUYER} role="Buyer’s solicitor" name={FILE.buyerSol} faint />
        </div>

        <div className="fv3-band-col fv3-band-mid">
          <h3 className="fv3-band-title">Recent movements</h3>
          <ul className="fv3-log">
            {MOVEMENTS.map((m, i) => (
              <li key={i} className="fv3-log-row">
                <span className="fv3-mono fv3-log-date">{m.date}</span>
                <span className="fv3-log-rule" style={{ background: m.accent ?? INK4 }} />
                <span className="fv3-log-text">{m.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="fv3-band-col">
          <h3 className="fv3-band-title">The numbers</h3>
          <Figure label="Sale price" value="£465,000" />
          <Figure label="Your fee" value="£4,650" sub="1% · inc. VAT" />
          <Figure label="Both sides" value={`${FILE.sellerPct} / ${FILE.buyerPct}%`} sub="weighted, seller / buyer" />
        </div>
      </section>
    </>
  );
}

function ConvergenceTimeline() {
  // dashed convergence curves from each lane front into the exchange gate
  const sellerConverge = `M ${XTODAY} ${yS} C ${XTODAY + 110} ${yS} ${XEX - 120} ${yC} ${XEX} ${yC}`;
  const buyerConverge = `M ${XTODAY} ${yB} C ${XTODAY + 110} ${yB} ${XEX - 120} ${yC} ${XEX} ${yC}`;
  const months: [string, number][] = [["AUG", x(2)], ["SEP", x(12)], ["OCT", x(42)], ["NOV", x(73)], ["DEC", x(103)]];

  return (
    <div className="fv3-tl-scroll">
      <svg className="fv3-tl" viewBox="0 0 1000 250" role="img"
        aria-label="Seller and buyer timelines converging on exchange, 9 December">
        {/* month gridlines + labels */}
        {months.map(([m, mx]) => (
          <g key={m}>
            <line x1={mx} y1={34} x2={mx} y2={212} stroke={HAIR2} strokeWidth={1} />
            <text x={mx} y={230} className="fv3-tl-month" textAnchor="middle">{m}</text>
          </g>
        ))}

        {/* today marker */}
        <line x1={XTODAY} y1={28} x2={XTODAY} y2={212} stroke={CORAL_HEX} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        <text x={XTODAY} y={22} className="fv3-tl-today" textAnchor="middle">TODAY · 1 NOV</text>

        {/* SELLER lane */}
        <text x={X0} y={yS - 16} className="fv3-tl-lane" fill={SELLER}>SELLER</text>
        <line className="fv3-draw" x1={X0} y1={yS} x2={x(42)} y2={yS} stroke={SELLER} strokeWidth={2.5} strokeLinecap="round" pathLength={1} />
        <line x1={x(42)} y1={yS} x2={XTODAY} y2={yS} stroke={CORAL_HEX} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 5" opacity={0.85} />
        <path d={sellerConverge} fill="none" stroke={SELLER} strokeWidth={1.5} strokeDasharray="2 5" opacity={0.3} />
        {SELLER_DONE.map((t, i) => (
          <circle key={i} className="fv3-tick" style={{ animationDelay: `${0.5 + i * 0.045}s` }}
            cx={x(t.d)} cy={yS} r={3.4} fill={SELLER} />
        ))}
        {/* seller live front — the blocker */}
        <circle className="fv3-pulse" cx={XTODAY} cy={yS} r={7} fill="none" stroke={CORAL_HEX} strokeWidth={1.5} />
        <circle cx={XTODAY} cy={yS} r={5} fill={CORAL_HEX} />
        <text x={XTODAY} y={yS - 15} className="fv3-tl-front" fill={CORAL_HEX} textAnchor="middle">Enquiries · 25 days</text>

        {/* BUYER lane */}
        <text x={X0} y={yB + 26} className="fv3-tl-lane" fill={BUYER}>BUYER</text>
        <line className="fv3-draw" x1={X0} y1={yB} x2={x(45)} y2={yB} stroke={BUYER} strokeWidth={2.5} strokeLinecap="round" pathLength={1} />
        <line x1={x(45)} y1={yB} x2={XTODAY} y2={yB} stroke={BUYER} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 5" opacity={0.7} />
        <path d={buyerConverge} fill="none" stroke={BUYER} strokeWidth={1.5} strokeDasharray="2 5" opacity={0.3} />
        {BUYER_DONE.map((t, i) => (
          <circle key={i} className="fv3-tick" style={{ animationDelay: `${0.5 + i * 0.04}s` }}
            cx={x(t.d)} cy={yB} r={3.4} fill={BUYER} />
        ))}
        {/* buyer ready-to-confirm node */}
        <circle cx={x(48)} cy={yB} r={5} fill="none" stroke={GREEN} strokeWidth={1.6} />
        <text x={x(48)} y={yB + 24} className="fv3-tl-small" fill={GREEN} textAnchor="middle">ready</text>
        {/* buyer live front */}
        <circle cx={XTODAY} cy={yB} r={6} fill={BUYER} />
        <text x={XTODAY} y={yB + 26} className="fv3-tl-front" fill={BUYER} textAnchor="middle">Enquiries raised</text>

        {/* EXCHANGE gate */}
        <g className="fv3-gate">
          <circle cx={XEX} cy={yC} r={13} fill={CORAL_HEX} />
          <path d={`M ${XEX - 5} ${yC} l 3.4 3.4 l 6 -7`} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x={XEX} y={yC - 22} className="fv3-tl-gate" textAnchor="middle">EXCHANGE</text>
        <text x={XEX} y={yC + 30} className="fv3-tl-gate-date" textAnchor="middle">9 DEC · ~5 WEEKS</text>

        {/* completion tail */}
        <line x1={XEX + 13} y1={yC} x2={XCOMP - 7} y2={yC} stroke={INK4} strokeWidth={1.5} strokeDasharray="2 5" />
        <circle cx={XCOMP} cy={yC} r={4} fill="none" stroke={INK4} strokeWidth={1.5} />
        <text x={XCOMP} y={yC - 14} className="fv3-tl-small" fill={INK3} textAnchor="middle">Completion</text>
      </svg>
    </div>
  );
}

function Roster({ color, role, name, faint }: { color: string; role: string; name: string; faint?: boolean }) {
  return (
    <div className="fv3-roster">
      <span className="fv3-roster-mark" style={{ background: faint ? "transparent" : color, borderColor: color }} />
      <span className="fv3-roster-text">
        <span className="fv3-roster-role">{role}</span>
        <span className="fv3-roster-name">{name}</span>
      </span>
      <span className="fv3-roster-acts">
        <button className="fv3-ibtn" aria-label={`Email ${name}`}><EnvelopeSimple size={14} /></button>
        <button className="fv3-ibtn" aria-label={`Call ${name}`}><Phone size={14} /></button>
      </span>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fv3-figure">
      <span className="fv3-figure-label">{label}</span>
      <span className="fv3-figure-value fv3-mono">{value}</span>
      {sub && <span className="fv3-figure-sub">{sub}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function BothSides() {
  return (
    <section className="fv3-ledger">
      <div className="fv3-ledger-head">
        <h2 className="fv3-ledger-title">Both sides to exchange</h2>
        <p className="fv3-ledger-sub">
          <span className="fv3-mono">20</span> steps done across both sides ·
          seller <span className="fv3-mono" style={{ color: SELLER }}>{FILE.sellerPct}%</span> ·
          buyer <span className="fv3-mono" style={{ color: BUYER }}>{FILE.buyerPct}%</span> weighted
        </p>
      </div>

      <div className="fv3-ledger-cols">
        <LedgerColumn side="Seller" color={SELLER} phases={SELLER_PHASES} />
        <div className="fv3-ledger-spine" aria-hidden />
        <LedgerColumn side="Buyer" color={BUYER} phases={BUYER_PHASES} align="right" />
      </div>

      {/* convergence — shared run-in both sides feed into */}
      <div className="fv3-converge">
        <span className="fv3-converge-label">Both sides converge</span>
        <ul className="fv3-converge-steps">
          {CONVERGE.map((s) => (
            <li key={s.name} className="fv3-cstep"><span className="fv3-cmark" />{s.name}</li>
          ))}
        </ul>
        <div className="fv3-converge-gate">
          <span className="fv3-cgate-dot"><Check size={12} weight="bold" /></span>
          <span className="fv3-cgate-text">Exchange</span>
          <span className="fv3-mono fv3-cgate-date">9 Dec</span>
          <ArrowUpRight size={14} className="fv3-cgate-arrow" />
          <span className="fv3-cgate-comp">Completion</span>
        </div>
      </div>
    </section>
  );
}

function LedgerColumn({ side, color, phases, align }: {
  side: string; color: string; phases: LPhase[]; align?: "right";
}) {
  const done = phases.flatMap((p) => p.steps).filter((s) => s.state === "done").length;
  const total = phases.flatMap((p) => p.steps).length;
  return (
    <div className={`fv3-lcol${align === "right" ? " is-right" : ""}`}>
      <div className="fv3-lcol-head">
        <span className="fv3-lcol-side"><span className="fv3-lcol-mark" style={{ background: color }} />{side}</span>
        <span className="fv3-mono fv3-lcol-count">{done}/{total}</span>
      </div>
      {phases.map((ph) => (
        <div key={ph.label} className="fv3-lphase">
          <span className="fv3-lphase-label">{ph.label}</span>
          <ul className="fv3-lsteps">
            {ph.steps.map((s) => (
              <li key={s.name} className={`fv3-lstep is-${s.state}`}>
                <span className="fv3-lstep-mark" style={s.state === "live" ? { background: color, borderColor: color } : undefined} />
                <span className="fv3-lstep-name">{s.name}</span>
                {s.state === "ready" && <span className="fv3-lstep-tag" style={{ color: GREEN }}>ready</span>}
                {s.state === "live" && <span className="fv3-lstep-tag" style={{ color: CORAL_HEX }}>live</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Scoped styles ───────────────────────────────────────────────────────────
const CSS = `
.fv3-root { min-height: 100vh; color: ${INK};
  background:
    radial-gradient(120% 70% at 100% -10%, rgba(240,83,43,0.05), transparent 55%),
    radial-gradient(90% 60% at -10% 110%, rgba(79,70,229,0.035), transparent 50%),
    #F7F2EA;
  font-feature-settings: "ss01" 1; }
.fv3-root ::selection { background: rgba(240,83,43,0.18); color: ${INK}; }
.fv3-mono { font-family: var(--font-geist-mono, ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace);
  font-feature-settings: "tnum" 1; letter-spacing: -0.01em; }
.fv3-root ::-webkit-scrollbar { height: 9px; width: 9px; }
.fv3-root ::-webkit-scrollbar-thumb { background: rgba(45,24,16,0.18); border-radius: 9px; }

.fv3-enter { animation: fv3-rise .5s cubic-bezier(.22,1,.36,1) both; }
@keyframes fv3-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

.fv3-frame { display: grid; grid-template-columns: 196px minmax(0, 1fr); max-width: 1180px; margin: 0 auto;
  min-height: 100vh; }

/* ── Index rail ── */
.fv3-rail { border-right: 1px solid ${HAIR}; padding: 26px 20px 24px 14px; display: flex; flex-direction: column;
  position: sticky; top: 0; align-self: start; height: 100vh; }
.fv3-back { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: ${INK2};
  text-decoration: none; padding: 4px 6px; border-radius: 6px; width: fit-content; transition: color .15s; }
.fv3-back:hover { color: ${INK}; }
.fv3-nav { list-style: none; margin: 26px 0 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.fv3-navitem { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  background: none; border: 0; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 500;
  color: ${INK2}; padding: 7px 8px; border-radius: 7px; transition: color .15s, background .15s; }
.fv3-navitem:hover { color: ${INK}; background: rgba(45,24,16,0.04); }
.fv3-nav-tick { width: 5px; height: 5px; border-radius: 999px; background: transparent; transition: background .18s, transform .18s; }
.fv3-navitem.is-active { color: ${INK}; font-weight: 600; }
.fv3-navitem.is-active .fv3-nav-tick { background: ${CORAL}; transform: scale(1.3); box-shadow: 0 0 0 3px rgba(240,83,43,0.14); }
.fv3-rail-foot { margin-top: auto; padding-top: 18px; border-top: 1px solid ${HAIR}; display: flex; flex-direction: column; gap: 7px; }
.fv3-rail-foot-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.09em; color: ${INK3}; font-weight: 600; }
.fv3-rail-handler { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: ${INK}; }
.fv3-ava { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; font-size: 9.5px;
  font-weight: 700; color: #fff; background: linear-gradient(135deg, #FF8A65, ${CORAL}); letter-spacing: .02em; }

/* ── Main ── */
.fv3-main { padding: 34px 44px 90px; min-width: 0; }

/* Masthead */
.fv3-masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px;
  padding-bottom: 20px; border-bottom: 1px solid ${HAIR}; }
.fv3-mast-line1 { display: flex; align-items: center; gap: 14px; }
.fv3-address { font-size: 33px; line-height: 1; letter-spacing: -0.025em; font-weight: 600; margin: 0; color: ${INK}; }
.fv3-live { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: ${GREEN};
  text-transform: uppercase; letter-spacing: 0.06em; }
.fv3-live-dot { width: 6px; height: 6px; border-radius: 999px; background: ${GREEN}; box-shadow: 0 0 0 3px rgba(31,138,74,0.15); }
.fv3-mast-meta { display: flex; align-items: center; gap: 9px; margin-top: 14px; font-size: 13px; color: ${INK2}; flex-wrap: wrap; }
.fv3-sep { color: ${INK4}; }
.fv3-mast-parties { display: inline-flex; align-items: center; gap: 7px; color: ${INK}; font-weight: 500; }
.fv3-pmark { width: 7px; height: 7px; border-radius: 2px; }
.fv3-parrow { color: ${INK4}; margin: 0 1px; }
.fv3-mast-forecast { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; text-align: right; }
.fv3-fore-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${INK3}; font-weight: 600; }
.fv3-fore-value { font-size: 20px; font-weight: 600; color: ${INK}; letter-spacing: -0.01em; }
.fv3-fore-weeks { font-size: 28px; color: ${CORAL}; letter-spacing: -0.03em; }
.fv3-fore-sub { font-size: 12px; color: ${INK2}; }

/* ── Timeline ── */
.fv3-timeline-wrap { margin: 30px 0 0; }
.fv3-tl-scroll { overflow-x: auto; scrollbar-width: thin; }
.fv3-tl { width: 100%; min-width: 680px; height: auto; display: block; overflow: visible; }
.fv3-tl text { font-family: var(--font-geist-mono, ui-monospace, Menlo, monospace); }
.fv3-tl-month { font-size: 10px; fill: ${INK3}; letter-spacing: 0.12em; }
.fv3-tl-today { font-size: 9px; fill: ${CORAL_HEX}; letter-spacing: 0.1em; font-weight: 600; }
.fv3-tl-lane { font-size: 10px; letter-spacing: 0.16em; font-weight: 600; opacity: 0.85; }
.fv3-tl-front { font-size: 11px; font-weight: 600; font-family: inherit; letter-spacing: -0.01em; }
.fv3-tl-small { font-size: 9px; letter-spacing: 0.06em; }
.fv3-tl-gate { font-size: 11px; letter-spacing: 0.18em; fill: ${INK}; font-weight: 700; }
.fv3-tl-gate-date { font-size: 9px; letter-spacing: 0.12em; fill: ${INK2}; }
.fv3-draw { animation: fv3-draw 1.1s cubic-bezier(.4,0,.2,1) .15s both; }
@keyframes fv3-draw { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
.fv3-tick { animation: fv3-tickin .3s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes fv3-tickin { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
.fv3-pulse { transform-box: fill-box; transform-origin: center; animation: fv3-pulse 2.2s ease-out infinite; }
@keyframes fv3-pulse { 0% { opacity: .55; transform: scale(.7); } 70%,100% { opacity: 0; transform: scale(1.7); } }
.fv3-gate { transform-box: fill-box; transform-origin: center; animation: fv3-gatein .5s cubic-bezier(.34,1.56,.64,1) 1.1s both; }
@keyframes fv3-gatein { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }

/* ── The front ── */
.fv3-front { display: grid; grid-template-columns: minmax(0,1fr) 260px; gap: 36px; margin-top: 30px;
  padding: 28px 0 26px; border-top: 1px solid ${HAIR}; border-bottom: 1px solid ${HAIR}; }
.fv3-front-head { font-size: 25px; line-height: 1.12; letter-spacing: -0.02em; font-weight: 600; color: ${INK}; margin: 0; max-width: 20ch; }
.fv3-front-body { font-size: 14px; line-height: 1.55; color: ${INK2}; margin: 12px 0 0; max-width: 54ch; }
.fv3-front-actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
.fv3-front-note { font-size: 11px; color: ${INK3}; }
.fv3-front-side { border-left: 1px solid ${HAIR}; padding-left: 24px; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; }
.fv3-front-side-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.09em; color: ${INK3}; font-weight: 600; }
.fv3-front-side-text { font-size: 13px; line-height: 1.5; color: ${INK2}; margin: 0; }

/* Buttons */
.fv3-btn { display: inline-flex; align-items: center; gap: 7px; font-family: inherit; font-size: 13px; font-weight: 600;
  border-radius: 8px; padding: 8px 15px; cursor: pointer; border: 1px solid transparent; transition: all .15s; }
.fv3-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(240,83,43,0.5); }
.fv3-btn-primary { color: #fff; background: ${CORAL}; box-shadow: 0 2px 10px rgba(240,83,43,0.30); }
.fv3-btn-primary:hover { filter: brightness(1.05); box-shadow: 0 4px 16px rgba(240,83,43,0.40); transform: translateY(-1px); }
.fv3-btn-ghost { color: ${INK}; background: transparent; border-color: ${HAIR}; }
.fv3-btn-ghost:hover { background: rgba(45,24,16,0.04); border-color: rgba(45,24,16,0.2); }
.fv3-btn-mini { font-size: 12px; padding: 6px 12px; color: ${INK}; background: transparent; border-color: ${HAIR}; }
.fv3-btn-mini:hover { background: rgba(45,24,16,0.04); border-color: rgba(45,24,16,0.2); }

/* ── Editorial band ── */
.fv3-band { display: grid; grid-template-columns: 1fr 1.25fr 0.85fr; gap: 0; margin-top: 30px; }
.fv3-band-col { padding: 2px 0; }
.fv3-band-mid { padding: 0 32px; border-left: 1px solid ${HAIR}; border-right: 1px solid ${HAIR}; margin: 0 32px; }
.fv3-band-title { font-size: 13px; font-weight: 600; color: ${INK}; margin: 0 0 14px; letter-spacing: -0.01em; }

.fv3-roster { display: flex; align-items: center; gap: 11px; padding: 9px 0; border-bottom: 1px solid ${HAIR2}; }
.fv3-roster:last-child { border-bottom: 0; }
.fv3-roster-mark { width: 8px; height: 8px; border-radius: 2px; border: 1.5px solid; flex-shrink: 0; }
.fv3-roster-text { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.fv3-roster-role { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.07em; color: ${INK3}; font-weight: 600; }
.fv3-roster-name { font-size: 13px; font-weight: 600; color: ${INK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv3-roster-acts { display: flex; gap: 3px; }
.fv3-ibtn { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; background: transparent; color: ${INK3}; transition: all .15s; }
.fv3-ibtn:hover { background: rgba(45,24,16,0.05); color: ${INK}; }
.fv3-ibtn:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(240,83,43,0.5); }

.fv3-log { list-style: none; margin: 0; padding: 0; }
.fv3-log-row { display: grid; grid-template-columns: 48px 2px 1fr; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${HAIR2}; }
.fv3-log-row:last-child { border-bottom: 0; }
.fv3-log-date { font-size: 11px; color: ${INK2}; }
.fv3-log-rule { width: 2px; height: 14px; border-radius: 2px; }
.fv3-log-text { font-size: 13px; color: ${INK}; line-height: 1.35; }

.fv3-figure { padding: 9px 0; border-bottom: 1px solid ${HAIR2}; display: flex; flex-direction: column; gap: 2px; }
.fv3-figure:last-child { border-bottom: 0; }
.fv3-figure-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.07em; color: ${INK3}; font-weight: 600; }
.fv3-figure-value { font-size: 19px; font-weight: 600; color: ${INK}; }
.fv3-figure-sub { font-size: 11px; color: ${INK2}; }

/* ── Both-sides ledger ── */
.fv3-ledger { margin-top: 30px; }
.fv3-ledger-head { padding-bottom: 20px; border-bottom: 1px solid ${HAIR}; }
.fv3-ledger-title { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin: 0; color: ${INK}; }
.fv3-ledger-sub { font-size: 13px; color: ${INK2}; margin: 8px 0 0; }
.fv3-ledger-cols { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0; margin-top: 8px; }
.fv3-ledger-spine { background: ${HAIR}; }
.fv3-lcol { padding: 22px 34px; }
.fv3-lcol.is-right { text-align: right; }
.fv3-lcol-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; margin-bottom: 8px; border-bottom: 1px solid ${HAIR}; }
.fv3-lcol.is-right .fv3-lcol-head { flex-direction: row-reverse; }
.fv3-lcol-side { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: ${INK}; letter-spacing: 0.01em; }
.fv3-lcol-mark { width: 9px; height: 9px; border-radius: 2px; }
.fv3-lcol-count { font-size: 13px; font-weight: 600; color: ${INK2}; }
.fv3-lphase { margin-top: 18px; }
.fv3-lphase-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: ${INK3}; font-weight: 700; }
.fv3-lsteps { list-style: none; margin: 10px 0 0; padding: 0; }
.fv3-lcol.is-right .fv3-lsteps { }
.fv3-lstep { display: flex; align-items: center; gap: 11px; padding: 6px 0; font-size: 13px; }
.fv3-lcol.is-right .fv3-lstep { flex-direction: row-reverse; }
.fv3-lstep-mark { width: 13px; height: 13px; border-radius: 999px; flex-shrink: 0; border: 1.5px solid transparent; position: relative; }
.fv3-lstep.is-done .fv3-lstep-mark { background: ${GREEN}; }
.fv3-lstep.is-done .fv3-lstep-mark::after { content: ""; position: absolute; left: 3.5px; top: 4px; width: 4px; height: 2px;
  border-left: 1.5px solid #fff; border-bottom: 1.5px solid #fff; transform: rotate(-45deg); }
.fv3-lstep.is-ready .fv3-lstep-mark { border-color: ${GREEN}; }
.fv3-lstep.is-ahead .fv3-lstep-mark { border-color: ${INK4}; }
.fv3-lstep.is-live .fv3-lstep-mark { box-shadow: 0 0 0 3px rgba(240,83,43,0.12); }
.fv3-lstep-name { flex: 1; color: ${INK}; }
.fv3-lstep.is-ahead .fv3-lstep-name { color: ${INK3}; }
.fv3-lstep.is-done .fv3-lstep-name { color: ${INK2}; }
.fv3-lstep.is-live .fv3-lstep-name { font-weight: 600; }
.fv3-lstep-tag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }

/* convergence block */
.fv3-converge { margin-top: 2px; border-top: 1px solid ${HAIR}; padding-top: 26px; display: flex; flex-direction: column;
  align-items: center; text-align: center; }
.fv3-converge-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: ${INK3}; font-weight: 700; }
.fv3-converge-steps { list-style: none; margin: 14px 0 0; padding: 0; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.fv3-cstep { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: ${INK2};
  padding: 8px 14px; border: 1px solid ${HAIR}; border-radius: 999px; }
.fv3-cmark { width: 9px; height: 9px; border-radius: 999px; border: 1.5px solid ${INK4}; }
.fv3-converge-gate { display: inline-flex; align-items: center; gap: 11px; margin-top: 20px; padding: 11px 20px;
  background: ${INK}; border-radius: 999px; color: #fff; }
.fv3-cgate-dot { width: 20px; height: 20px; border-radius: 999px; background: ${CORAL}; display: grid; place-items: center; color: #fff; }
.fv3-cgate-text { font-size: 14px; font-weight: 700; letter-spacing: 0.01em; }
.fv3-cgate-date { font-size: 12px; color: rgba(255,255,255,0.7); }
.fv3-cgate-arrow { color: rgba(255,255,255,0.4); }
.fv3-cgate-comp { font-size: 12px; color: rgba(255,255,255,0.55); }

/* ── Responsive ── */
@media (max-width: 920px) {
  .fv3-frame { grid-template-columns: 1fr; }
  .fv3-rail { flex-direction: row; align-items: center; height: auto; position: static; border-right: 0;
    border-bottom: 1px solid ${HAIR}; padding: 14px 20px; gap: 16px; overflow-x: auto; }
  .fv3-nav { flex-direction: row; margin: 0; gap: 2px; }
  .fv3-navitem { white-space: nowrap; }
  .fv3-nav-tick { display: none; }
  .fv3-navitem.is-active { box-shadow: inset 0 -2px 0 ${CORAL}; border-radius: 0; }
  .fv3-rail-foot { margin: 0 0 0 auto; padding: 0; border: 0; flex-direction: row; align-items: center; gap: 8px; }
  .fv3-rail-foot-label { display: none; }
  .fv3-main { padding: 24px 24px 72px; }
}
@media (max-width: 760px) {
  .fv3-masthead { flex-direction: column; align-items: flex-start; gap: 16px; }
  .fv3-mast-forecast { align-items: flex-start; text-align: left; }
  .fv3-front { grid-template-columns: 1fr; gap: 22px; }
  .fv3-front-side { border-left: 0; border-top: 1px solid ${HAIR}; padding-left: 0; padding-top: 20px; }
  .fv3-band { grid-template-columns: 1fr; gap: 0; }
  .fv3-band-mid { border-left: 0; border-right: 0; border-top: 1px solid ${HAIR}; border-bottom: 1px solid ${HAIR};
    margin: 22px 0; padding: 22px 0; }
  .fv3-ledger-cols { grid-template-columns: 1fr; }
  .fv3-ledger-spine { display: none; }
  .fv3-lcol { padding: 20px 0; border-bottom: 1px solid ${HAIR}; }
  .fv3-lcol.is-right { text-align: left; }
  .fv3-lcol.is-right .fv3-lcol-head, .fv3-lcol.is-right .fv3-lstep { flex-direction: row; }
  .fv3-address { font-size: 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .fv3-enter, .fv3-draw, .fv3-tick, .fv3-pulse, .fv3-gate { animation: none !important; }
  .fv3-draw { stroke-dashoffset: 0 !important; }
  .fv3-tick { opacity: 1 !important; }
}
`;
