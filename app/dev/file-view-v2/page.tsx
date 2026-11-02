"use client";

// /dev/file-view-v2 — PROPOSED agent file view (transaction detail), improved.
// Visual mock, no wiring. Same product truth as /agent/transactions/[id]: same
// milestone model (vendor + purchaser sides, weighted to exchange), same data
// shape, same functions — elevated craft. Blocks in production.
//
// The POV: the current file makes you assemble three reads from four places (the
// 6-stage strip, the per-side weighted bar, the accordions, the activity feed).
// This answers them on the spine of the page instead:
//   Where are we?  → the journey band (one stepper, both sides on it)
//   What's next?   → the single focal action, with who it waits on and for how long
//   What's at risk? → carried in the current stage + the next action, not a side card
//
// Renders inside the real agent token environment (see layout.tsx), so coral,
// glass, text tones and the aurora are the live ones.

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CaretRight, Check, CheckCircle, Clock,
  EnvelopeSimple, Phone, Scales, Bank, FileText, MagnifyingGlass, Signature,
  Key, House, PaperPlaneTilt, NotePencil, Lock, ArrowRight, Minus,
} from "@phosphor-icons/react";

// ── Live-token aliases (resolve from the agent theme in layout.tsx) ──────────
const CORAL = "var(--agent-coral-deep)";      // #FF6B4A brand primary
const INK = "var(--agent-text-primary)";       // #2D1810
const INK2 = "var(--agent-text-secondary)";    // #5A3A28
const INK3 = "var(--agent-text-tertiary)";     // #7A4A2E
const MUT = "var(--agent-text-muted)";          // ~55% ink
const LINE = "var(--agent-border-default)";     // card borders
// Categorical, theme-locked (design tokens — never themed by brand engine)
const SELLER = "#4F46E5";   // vendor accent (indigo)
const BUYER = "#BE185D";    // purchaser accent (pink)
const GREEN = "#1F8A4A";    // success / complete

// ── The file (mock: a leasehold + mortgage sale, mid-enquiries) ──────────────
const FILE = {
  address: "14 Alderton Rise",
  town: "Hertford, SG14 2PL",
  tenure: "Leasehold",
  price: "£465,000",
  service: "Outsourced progression",
  status: "Active",
  seller: "Priya & Daniel Osei",
  buyer: "Marcus Whitlock",
  sellerSol: "Hartfield & Rowe",
  buyerSol: "Castleton Legal",
  progressor: "Ellis Askey",
  overall: 45,
  sellerPct: 44,
  buyerPct: 46,
  stepsDone: 22,
  stepsTotal: 39,
  forecast: "9 Dec 2026",
  pace: "On track",
};

type StageStatus = "complete" | "current" | "upnext" | "pending";
type Stage = { key: string; name: string; status: StageStatus; when: string; Icon: typeof House };

const STAGES: Stage[] = [
  { key: "instructed", name: "Instructed", status: "complete", when: "28 Aug", Icon: Scales },
  { key: "pack", name: "Contract pack", status: "complete", when: "18 Sep", Icon: FileText },
  { key: "finances", name: "Finances", status: "complete", when: "2 Oct", Icon: Bank },
  { key: "searches", name: "Searches", status: "complete", when: "9 Oct", Icon: MagnifyingGlass },
  { key: "enquiries", name: "Enquiries", status: "current", when: "underway", Icon: NotePencil },
  { key: "exchange", name: "Exchange", status: "upnext", when: "~9 Dec", Icon: Signature },
  { key: "completion", name: "Completion", status: "pending", when: "Not set", Icon: Key },
];

type Act = { Icon: typeof Phone; text: string; when: string; tone?: string };
const ACTIVITY: Act[] = [
  { Icon: PaperPlaneTilt, text: "Chased the seller's solicitor for enquiry replies", when: "3 days ago", tone: CORAL },
  { Icon: CheckCircle, text: "Search results received and confirmed", when: "9 Oct · 11:02am", tone: GREEN },
  { Icon: FileText, text: "Buyer's solicitor raised initial enquiries", when: "7 Oct · 9:30am" },
  { Icon: Bank, text: "Mortgage offer received", when: "2 Oct · 4:15pm", tone: GREEN },
];

// ── Milestone engine data (the two sides, grouped as the real Steps tab) ─────
type StepState = "done" | "current" | "available" | "locked" | "nr";
type Step = { name: string; state: StepState; meta?: string; by?: string };
type Section = { label: string; color: string; steps: Step[] };

const SELLER_SECTIONS: Section[] = [
  {
    label: "Onboarding", color: CORAL, steps: [
      { name: "Solicitor instructed", state: "done", by: "Confirmed · 28 Aug" },
      { name: "Memorandum of sale received", state: "done", by: "Confirmed · 29 Aug" },
      { name: "Welcome pack received", state: "done", by: "Confirmed · 3 Sep" },
      { name: "ID & AML checks complete", state: "done", by: "Confirmed · 5 Sep" },
      { name: "Property information forms received", state: "done", by: "Confirmed · 8 Sep" },
      { name: "Completed forms returned", state: "done", by: "Confirmed · 15 Sep" },
    ],
  },
  {
    label: "Conveyancing", color: SELLER, steps: [
      { name: "Draft contract pack issued", state: "done", by: "Confirmed · 18 Sep" },
      { name: "Management pack requested", state: "done", by: "Confirmed · 18 Sep" },
      { name: "Management pack received", state: "done", by: "Confirmed · 1 Oct" },
      { name: "Initial enquiries received", state: "current", meta: "Underway · awaiting the seller's replies" },
      { name: "All enquiries satisfied", state: "locked" },
    ],
  },
  {
    label: "Exchange & completion", color: "#7E22CE", steps: [
      { name: "Contract documents issued", state: "locked" },
      { name: "Signed contract returned", state: "locked" },
      { name: "Ready to exchange", state: "locked" },
      { name: "Contracts exchanged", state: "locked" },
      { name: "Sale completed", state: "locked" },
    ],
  },
];

const BUYER_SECTIONS: Section[] = [
  {
    label: "Onboarding", color: CORAL, steps: [
      { name: "Solicitor instructed", state: "done", by: "Confirmed · 30 Aug" },
      { name: "Memorandum of sale received", state: "done", by: "Confirmed · 30 Aug" },
      { name: "ID & AML checks complete", state: "done", by: "Confirmed · 4 Sep" },
      { name: "Money on account paid", state: "done", by: "Confirmed · 9 Sep" },
    ],
  },
  {
    label: "Finances", color: "#3D7AB8", steps: [
      { name: "Mortgage application submitted", state: "done", by: "Confirmed · 12 Sep" },
      { name: "Lender valuation booked", state: "done", by: "Confirmed · 20 Sep" },
      { name: "Mortgage offer received", state: "done", by: "Confirmed · 2 Oct" },
    ],
  },
  {
    label: "Surveys", color: GREEN, steps: [
      { name: "Survey booked", state: "done", by: "Booked with Hale & Court · 24 Sep" },
      { name: "Survey report received", state: "done", by: "Confirmed · 1 Oct" },
    ],
  },
  {
    label: "Conveyancing", color: BUYER, steps: [
      { name: "Draft contract pack received", state: "done", by: "Confirmed · 19 Sep" },
      { name: "Searches ordered", state: "done", by: "Confirmed · 21 Sep" },
      { name: "Management pack received", state: "done", by: "Confirmed · 4 Oct" },
      { name: "Search results received", state: "available", meta: "Ready to confirm" },
      { name: "Initial enquiries raised", state: "current", meta: "Underway · raised 7 Oct" },
      { name: "All enquiries satisfied", state: "locked" },
    ],
  },
  {
    label: "Exchange & completion", color: "#7E22CE", steps: [
      { name: "Final report received", state: "locked" },
      { name: "Contract documents issued", state: "locked" },
      { name: "Signed contract returned", state: "locked" },
      { name: "Deposit transferred", state: "locked" },
      { name: "Ready to exchange", state: "locked" },
      { name: "Contracts exchanged", state: "locked" },
      { name: "Purchase completed", state: "locked" },
    ],
  },
];

const TABS = ["Overview", "Steps", "Reminders", "Chain", "To-Do", "Documents", "Activity", "Client portal"];

export default function FileViewV2Page() {
  if (process.env.NODE_ENV === "production") notFound();

  const [tab, setTab] = useState<"Overview" | "Steps">("Overview");
  const [side, setSide] = useState<"seller" | "buyer">("buyer");

  return (
    <main className="fv2-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="fv2-shell fv2-enter">
        {/* ── Top chrome ─────────────────────────────────────────── */}
        <div className="fv2-topbar">
          <a className="fv2-back" href="#" onClick={(e) => e.preventDefault()}>
            <ArrowLeft size={15} weight="bold" /> All files
          </a>
          <div className="fv2-handled">
            <span className="fv2-handled-label">Handled by</span>
            <span className="fv2-ava" aria-hidden>EA</span>
            <span className="fv2-handled-name">{FILE.progressor}</span>
          </div>
        </div>

        {/* ── File header ────────────────────────────────────────── */}
        <header className="fv2-header glass-card">
          <div className="fv2-header-main">
            <h1 className="fv2-address">{FILE.address}</h1>
            <div className="fv2-meta">
              <span>{FILE.town}</span>
              <span className="fv2-dot" />
              <span>{FILE.tenure}</span>
              <span className="fv2-dot" />
              <span className="fv2-tnum">{FILE.price}</span>
            </div>
            <div className="fv2-parties">
              <span className="fv2-party">
                <span className="fv2-party-swatch" style={{ background: SELLER }} />
                <span className="fv2-party-role">Seller</span>
                <span className="fv2-party-name">{FILE.seller}</span>
              </span>
              <ArrowRight size={14} weight="bold" className="fv2-party-arrow" />
              <span className="fv2-party">
                <span className="fv2-party-swatch" style={{ background: BUYER }} />
                <span className="fv2-party-role">Buyer</span>
                <span className="fv2-party-name">{FILE.buyer}</span>
              </span>
            </div>
          </div>
          <div className="fv2-header-aside">
            <span className="fv2-status">
              <span className="fv2-status-dot" />
              {FILE.status}
            </span>
            <span className="fv2-service">{FILE.service}</span>
          </div>
        </header>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <nav className="fv2-tabs" role="tablist">
          {TABS.map((t) => {
            const active = t === tab;
            const live = t === "Overview" || t === "Steps";
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                className={`fv2-tab${active ? " is-active" : ""}`}
                onClick={() => live && setTab(t as "Overview" | "Steps")}
              >
                {t}
                {active && <span className="fv2-tab-underline" />}
              </button>
            );
          })}
        </nav>

        {tab === "Overview" ? (
          <Overview onGoSteps={() => setTab("Steps")} />
        ) : (
          <Steps side={side} setSide={setSide} onGoOverview={() => setTab("Overview")} />
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Overview({ onGoSteps }: { onGoSteps: () => void }) {
  return (
    <div className="fv2-grid">
      <div className="fv2-col-main">
        {/* Journey band — the centrepiece */}
        <section className="fv2-journey glass-card">
          <div className="fv2-journey-head">
            <h2 className="fv2-h2">Journey to exchange</h2>
            <div className="fv2-journey-stat">
              <span className="fv2-pct fv2-tnum">{FILE.overall}%</span>
              <span className="fv2-pace">
                <span className="fv2-pace-dot" />
                {FILE.pace} · forecast <strong className="fv2-tnum">{FILE.forecast}</strong>
              </span>
            </div>
          </div>

          <ol className="fv2-stepper">
            {STAGES.map((s, i) => (
              <li key={s.key} className={`fv2-step is-${s.status}`} style={{ ["--d" as string]: `${i * 70}ms` }}>
                {i > 0 && <span className={`fv2-conn ${STAGES[i - 1].status === "complete" ? "is-done" : ""}`} />}
                <span className="fv2-node">
                  {s.status === "complete" ? (
                    <Check size={15} weight="bold" />
                  ) : (
                    <s.Icon size={15} weight={s.status === "current" ? "fill" : "regular"} />
                  )}
                  {s.status === "current" && <span className="fv2-node-pulse" />}
                </span>
                <span className="fv2-step-name">{s.name}</span>
                <span className="fv2-step-when fv2-tnum">{s.when}</span>
              </li>
            ))}
          </ol>

          <div className="fv2-sides">
            <SideTrack role="Seller" color={SELLER} pct={FILE.sellerPct} note="through enquiries" />
            <SideTrack role="Buyer" color={BUYER} pct={FILE.buyerPct} note="through enquiries" />
          </div>
        </section>

        {/* What's next — the focal action */}
        <section className="fv2-next glass-card">
          <div className="fv2-next-top">
            <span className="fv2-next-chip"><Clock size={13} weight="fill" /> Up next</span>
            <span className="fv2-next-stall">Chased 3 days ago</span>
          </div>
          <h3 className="fv2-next-title">Awaiting enquiry replies from the seller's solicitor</h3>
          <p className="fv2-next-meta">
            Raised 7 Oct · {FILE.sellerSol} usually reply within two weeks. Both sides are otherwise
            ready to move toward exchange.
          </p>
          <div className="fv2-next-actions">
            <button className="fv2-btn fv2-btn-primary"><PaperPlaneTilt size={15} weight="fill" /> Send a chase</button>
            <button className="fv2-btn fv2-btn-ghost"><NotePencil size={15} /> Log an update</button>
          </div>
          <div className="fv2-next-also">
            <span className="fv2-also-icon" style={{ color: GREEN }}><CheckCircle size={16} weight="fill" /></span>
            <span className="fv2-also-text">Ready to confirm: <strong>Search results received</strong></span>
            <button className="fv2-btn fv2-btn-mini" onClick={onGoSteps}>Confirm</button>
          </div>
        </section>

        {/* Recent activity */}
        <section className="fv2-activity glass-card">
          <div className="fv2-card-head">
            <h3 className="fv2-h3">Recent activity</h3>
            <button className="fv2-link">View all <CaretRight size={12} weight="bold" /></button>
          </div>
          <ul className="fv2-feed">
            {ACTIVITY.map((a, i) => (
              <li key={i} className="fv2-feed-row">
                <span className="fv2-feed-icon" style={{ color: a.tone ?? INK3 }}>
                  <a.Icon size={16} weight="fill" />
                </span>
                <span className="fv2-feed-text">{a.text}</span>
                <span className="fv2-feed-when fv2-tnum">{a.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Sidebar */}
      <aside className="fv2-col-side">
        <section className="fv2-people glass-card">
          <h3 className="fv2-h3">People</h3>
          <PersonRow color={SELLER} role="Seller" name={FILE.seller} />
          <PersonRow color={SELLER} role="Seller's solicitor" name={FILE.sellerSol} muted />
          <PersonRow color={BUYER} role="Buyer" name={FILE.buyer} />
          <PersonRow color={BUYER} role="Buyer's solicitor" name={FILE.buyerSol} muted />
        </section>

        <section className="fv2-fees glass-card">
          <h3 className="fv2-h3">Price &amp; fees</h3>
          <div className="fv2-fee-row">
            <span>Purchase price</span>
            <span className="fv2-tnum fv2-fee-strong">{FILE.price}</span>
          </div>
          <div className="fv2-fee-row">
            <span>Your fee</span>
            <span className="fv2-tnum">£4,650</span>
          </div>
          <div className="fv2-fee-sub">1% of sale price, inc. VAT</div>
        </section>
      </aside>
    </div>
  );
}

function SideTrack({ role, color, pct, note }: { role: string; color: string; pct: number; note: string }) {
  return (
    <div className="fv2-track">
      <div className="fv2-track-head">
        <span className="fv2-track-role">
          <span className="fv2-track-dot" style={{ background: color }} />
          {role}
        </span>
        <span className="fv2-track-pct fv2-tnum" style={{ color }}>{pct}%</span>
      </div>
      <div className="fv2-track-bar">
        <span className="fv2-track-fill" style={{ ["--to" as string]: `${pct}%`, background: color }} />
      </div>
      <span className="fv2-track-note">{note}</span>
    </div>
  );
}

function PersonRow({ color, role, name, muted }: { color: string; role: string; name: string; muted?: boolean }) {
  return (
    <div className="fv2-person">
      <span className="fv2-person-swatch" style={{ background: muted ? "transparent" : color, borderColor: color }} />
      <span className="fv2-person-text">
        <span className="fv2-person-role">{role}</span>
        <span className="fv2-person-name">{name}</span>
      </span>
      <span className="fv2-person-actions">
        <button className="fv2-ibtn" aria-label={`Email ${name}`}><EnvelopeSimple size={15} /></button>
        <button className="fv2-ibtn" aria-label={`Call ${name}`}><Phone size={15} /></button>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Steps({
  side, setSide, onGoOverview,
}: {
  side: "seller" | "buyer";
  setSide: (s: "seller" | "buyer") => void;
  onGoOverview: () => void;
}) {
  const sections = side === "seller" ? SELLER_SECTIONS : BUYER_SECTIONS;
  const pct = side === "seller" ? FILE.sellerPct : FILE.buyerPct;

  return (
    <div className="fv2-steps">
      <section className="fv2-steps-head glass-card">
        <div className="fv2-steps-head-top">
          <div>
            <h2 className="fv2-h2">Steps to exchange</h2>
            <p className="fv2-steps-sub">{FILE.stepsDone} of {FILE.stepsTotal} steps complete across both sides</p>
          </div>
          <span className="fv2-pct fv2-pct-lg fv2-tnum">{FILE.overall}%</span>
        </div>
        <div className="fv2-weighbar">
          <span className="fv2-weighbar-fill" style={{ ["--to" as string]: `${FILE.overall}%` }} />
        </div>

        <div className="fv2-segment" role="tablist">
          <button
            role="tab" aria-selected={side === "seller"}
            className={`fv2-seg${side === "seller" ? " is-active" : ""}`}
            onClick={() => setSide("seller")}
            style={{ ["--seg" as string]: SELLER }}
          >
            <span className="fv2-seg-dot" style={{ background: SELLER }} /> Seller
            <span className="fv2-seg-count fv2-tnum">{FILE.sellerPct}%</span>
          </button>
          <button
            role="tab" aria-selected={side === "buyer"}
            className={`fv2-seg${side === "buyer" ? " is-active" : ""}`}
            onClick={() => setSide("buyer")}
            style={{ ["--seg" as string]: BUYER }}
          >
            <span className="fv2-seg-dot" style={{ background: BUYER }} /> Buyer
            <span className="fv2-seg-count fv2-tnum">{FILE.buyerPct}%</span>
          </button>
        </div>
      </section>

      <div className="fv2-sections" key={side}>
        {sections.map((sec) => <SectionBlock key={sec.label} sec={sec} />)}
      </div>
    </div>
  );
}

function SectionBlock({ sec }: { sec: Section }) {
  const done = sec.steps.filter((s) => s.state === "done").length;
  const [open, setOpen] = useState(true);
  return (
    <section className="fv2-sec glass-card">
      <button className="fv2-sec-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="fv2-sec-dot" style={{ background: sec.color }} />
        <span className="fv2-sec-label">{sec.label}</span>
        <span className="fv2-sec-count fv2-tnum">{done}/{sec.steps.length}</span>
        <CaretRight size={14} weight="bold" className={`fv2-sec-caret${open ? " is-open" : ""}`} />
      </button>
      {open && (
        <ul className="fv2-rows">
          {sec.steps.map((st) => <StepRow key={st.name} st={st} accent={sec.color} />)}
        </ul>
      )}
    </section>
  );
}

function StepRow({ st, accent }: { st: Step; accent: string }) {
  return (
    <li className={`fv2-row is-${st.state}`}>
      <span className="fv2-row-mark">
        {st.state === "done" && <span className="fv2-mark-done"><Check size={12} weight="bold" /></span>}
        {st.state === "current" && <span className="fv2-mark-current" style={{ borderColor: accent }}><span style={{ background: accent }} /></span>}
        {st.state === "available" && <span className="fv2-mark-avail" />}
        {st.state === "locked" && <Lock size={13} className="fv2-mark-lock" />}
        {st.state === "nr" && <Minus size={13} className="fv2-mark-lock" />}
      </span>
      <span className="fv2-row-body">
        <span className="fv2-row-name">{st.name}</span>
        {st.by && <span className="fv2-row-by">{st.by}</span>}
        {st.meta && (
          <span className={`fv2-row-meta${st.state === "available" ? " is-avail" : ""}`}>{st.meta}</span>
        )}
      </span>
      {st.state === "available" && <button className="fv2-btn fv2-btn-mini fv2-row-cta">Confirm</button>}
      {st.state === "current" && <span className="fv2-row-tag" style={{ color: accent }}>Current</span>}
    </li>
  );
}

// ── Scoped styles (hover / responsive / motion — the rest is inline) ─────────
const CSS = `
.fv2-root { min-height: 100vh; padding: 20px 16px 72px; }
.fv2-shell { max-width: 1140px; margin: 0 auto; }
.fv2-tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.fv2-root ::selection { background: rgba(var(--agent-coral-rgb), 0.22); color: ${INK}; }
.fv2-root * { scrollbar-width: thin; scrollbar-color: rgba(var(--agent-shadow-rgb),0.25) transparent; }

.fv2-enter { animation: fv2-rise .42s cubic-bezier(.22,1,.36,1) both; }
@keyframes fv2-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* glass-card already carries surface + shadow; we only tune padding/radius */
.fv2-header, .fv2-journey, .fv2-next, .fv2-activity, .fv2-people, .fv2-fees,
.fv2-steps-head, .fv2-sec { border-radius: 18px; }

/* Top chrome */
.fv2-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.fv2-back { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600;
  color: ${INK2}; text-decoration: none; padding: 5px 9px 5px 7px; border-radius: 8px; transition: background .15s, color .15s; }
.fv2-back:hover { background: var(--agent-hover-shade); color: ${INK}; }
.fv2-handled { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: ${MUT}; }
.fv2-handled-name { color: ${INK2}; font-weight: 600; }
.fv2-ava { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center;
  font-size: 10.5px; font-weight: 700; letter-spacing: .02em; color: #fff;
  background: linear-gradient(135deg, var(--agent-coral-base, #FF8A65), ${CORAL}); }

/* Header */
.fv2-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
  padding: 22px 24px; margin-bottom: 14px; }
.fv2-address { font-size: 30px; line-height: 1.04; letter-spacing: -0.02em; font-weight: 600; color: ${INK}; margin: 0; }
.fv2-meta { display: flex; align-items: center; gap: 10px; margin-top: 9px; font-size: 13px; color: ${INK3}; }
.fv2-dot { width: 3px; height: 3px; border-radius: 999px; background: currentColor; opacity: .5; }
.fv2-parties { display: flex; align-items: center; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
.fv2-party { display: inline-flex; align-items: center; gap: 8px; }
.fv2-party-swatch { width: 9px; height: 9px; border-radius: 3px; }
.fv2-party-role { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; color: ${MUT}; }
.fv2-party-name { font-size: 14px; font-weight: 600; color: ${INK}; }
.fv2-party-arrow { color: ${MUT}; }
.fv2-header-aside { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; flex-shrink: 0; }
.fv2-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: ${GREEN};
  background: rgba(31,138,74,0.12); border: 1px solid rgba(31,138,74,0.30); border-radius: 999px; padding: 4px 11px 4px 9px; }
.fv2-status-dot { width: 7px; height: 7px; border-radius: 999px; background: ${GREEN}; box-shadow: 0 0 0 3px rgba(31,138,74,0.18); }
.fv2-service { font-size: 12px; color: ${MUT}; }

/* Tabs */
.fv2-tabs { display: flex; gap: 2px; margin-bottom: 16px; overflow-x: auto; border-bottom: 1px solid ${LINE};
  -ms-overflow-style: none; }
.fv2-tabs::-webkit-scrollbar { display: none; }
.fv2-tab { position: relative; background: none; border: 0; cursor: pointer; white-space: nowrap;
  font-size: 13.5px; font-weight: 600; color: ${MUT}; padding: 9px 13px 12px; border-radius: 8px 8px 0 0;
  transition: color .15s, background .15s; font-family: inherit; }
.fv2-tab:hover { color: ${INK2}; background: var(--agent-hover-shade); }
.fv2-tab.is-active { color: ${INK}; }
.fv2-tab-underline { position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; border-radius: 2px;
  background: ${CORAL}; animation: fv2-slide .2s ease-out both; }
@keyframes fv2-slide { from { transform: scaleX(.4); opacity: 0; } to { transform: none; opacity: 1; } }

/* Layout grid */
.fv2-grid { display: grid; grid-template-columns: minmax(0,1fr) 312px; gap: 14px; align-items: start; }
.fv2-col-main { display: flex; flex-direction: column; gap: 14px; }
.fv2-col-side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 16px; }
@media (max-width: 960px) {
  .fv2-grid { grid-template-columns: 1fr; }
  .fv2-col-side { position: static; }
  .fv2-header { flex-direction: column; }
  .fv2-header-aside { align-items: flex-start; flex-direction: row; align-items: center; }
}

.fv2-h2 { font-size: 20px; letter-spacing: -0.01em; font-weight: 600; color: ${INK}; margin: 0; }
.fv2-h3 { font-size: 14px; font-weight: 600; color: ${INK}; margin: 0; }

/* Journey band */
.fv2-journey { padding: 22px 24px 20px; }
.fv2-journey-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.fv2-journey-stat { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.fv2-pct { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1; }
.fv2-pct-lg { font-size: 34px; }
.fv2-pace { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${INK3}; }
.fv2-pace strong { color: ${INK2}; font-weight: 600; }
.fv2-pace-dot { width: 6px; height: 6px; border-radius: 999px; background: ${GREEN}; }

.fv2-stepper { list-style: none; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(74px, 1fr);
  margin: 18px 0 4px; padding: 10px 2px 4px; overflow-x: auto; scrollbar-width: none; }
.fv2-stepper::-webkit-scrollbar { display: none; }
.fv2-step { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 0 4px; animation: fv2-pop .4s cubic-bezier(.34,1.56,.64,1) both; animation-delay: var(--d); }
@keyframes fv2-pop { from { opacity: 0; transform: translateY(6px) scale(.9); } to { opacity: 1; transform: none; } }
.fv2-conn { position: absolute; top: 15px; right: 50%; width: 100%; height: 2px; background: ${LINE};
  z-index: 0; border-radius: 2px; }
.fv2-conn.is-done { background: rgba(31,138,74,0.55); }
.fv2-node { position: relative; z-index: 1; width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center;
  background: var(--agent-surface-elevated, #fff); border: 1.5px solid ${LINE}; color: ${MUT}; }
.fv2-step.is-complete .fv2-node { background: ${GREEN}; border-color: ${GREEN}; color: #fff;
  box-shadow: 0 2px 6px rgba(31,138,74,0.30); }
.fv2-step.is-current .fv2-node { background: ${CORAL}; border-color: ${CORAL}; color: #fff;
  box-shadow: 0 3px 10px rgba(var(--agent-coral-rgb),0.40); }
.fv2-step.is-upnext .fv2-node { border-color: rgba(var(--agent-coral-rgb),0.45); color: ${CORAL}; border-style: dashed; }
.fv2-node-pulse { position: absolute; inset: -4px; border-radius: 999px; border: 2px solid ${CORAL};
  animation: fv2-ring 1.8s ease-out infinite; }
@keyframes fv2-ring { 0% { opacity: .5; transform: scale(.85); } 70%,100% { opacity: 0; transform: scale(1.4); } }
.fv2-step-name { font-size: 12px; font-weight: 600; color: ${INK}; margin-top: 9px; }
.fv2-step.is-pending .fv2-step-name, .fv2-step.is-upnext .fv2-step-name { color: ${MUT}; }
.fv2-step-when { font-size: 10.5px; color: ${MUT}; margin-top: 2px; }
.fv2-step.is-current .fv2-step-when { color: ${CORAL}; font-weight: 600; }

.fv2-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px;
  padding-top: 20px; border-top: 1px solid ${LINE}; }
@media (max-width: 560px) {
  .fv2-sides { grid-template-columns: 1fr; }
  .fv2-journey-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .fv2-journey-stat { align-items: flex-start; }
  .fv2-stepper { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%); }
}
.fv2-track-head { display: flex; align-items: baseline; justify-content: space-between; }
.fv2-track-role { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: ${INK}; }
.fv2-track-dot { width: 8px; height: 8px; border-radius: 3px; }
.fv2-track-pct { font-size: 14px; font-weight: 700; }
.fv2-track-bar { height: 7px; border-radius: 999px; background: rgba(var(--agent-shadow-rgb),0.08); margin-top: 8px; overflow: hidden; }
.fv2-track-fill { display: block; height: 100%; width: var(--to); border-radius: 999px;
  animation: fv2-grow 1s cubic-bezier(.22,1,.36,1) .25s both; }
@keyframes fv2-grow { from { width: 0; } to { width: var(--to); } }
.fv2-track-note { display: block; font-size: 11px; color: ${MUT}; margin-top: 6px; }

/* Next action */
.fv2-next { padding: 18px 22px 20px; border: 1px solid rgba(var(--agent-coral-rgb),0.28);
  background: linear-gradient(180deg, rgba(var(--agent-coral-rgb),0.07), rgba(var(--agent-coral-rgb),0.02)); }
.fv2-next-top { display: flex; align-items: center; justify-content: space-between; }
.fv2-next-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em; color: ${CORAL};
  background: rgba(var(--agent-coral-rgb),0.12); border-radius: 999px; padding: 4px 10px; }
.fv2-next-stall { font-size: 12px; color: ${INK3}; }
.fv2-next-title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; color: ${INK}; margin: 12px 0 0; }
.fv2-next-meta { font-size: 13px; line-height: 1.5; color: ${INK2}; margin: 7px 0 0; max-width: 60ch; }
.fv2-next-actions { display: flex; gap: 9px; margin-top: 15px; flex-wrap: wrap; }
.fv2-next-also { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 14px;
  border-top: 1px solid rgba(var(--agent-coral-rgb),0.18); }
.fv2-also-icon { display: inline-flex; }
.fv2-also-text { font-size: 13px; color: ${INK2}; flex: 1; }
.fv2-also-text strong { color: ${INK}; font-weight: 600; }

/* Buttons */
.fv2-btn { display: inline-flex; align-items: center; gap: 7px; font-family: inherit; font-size: 13px; font-weight: 600;
  border-radius: 9px; padding: 8px 14px; cursor: pointer; border: 1px solid transparent; transition: all .15s; }
.fv2-btn:focus-visible { outline: none; box-shadow: var(--agent-focus-ring); }
.fv2-btn-primary { color: #fff; border: 0;
  background: linear-gradient(180deg, var(--agent-coral-base,#FF8A65), ${CORAL});
  box-shadow: 0 2px 8px rgba(var(--agent-coral-rgb),0.35); }
.fv2-btn-primary:hover { filter: brightness(1.04); box-shadow: 0 4px 14px rgba(var(--agent-coral-rgb),0.45); transform: translateY(-1px); }
.fv2-btn-ghost { color: ${INK2}; background: var(--agent-surface-elevated,#fff); border-color: ${LINE}; }
.fv2-btn-ghost:hover { background: var(--agent-hover-shade); color: ${INK}; }
.fv2-btn-mini { font-size: 12px; padding: 5px 12px; color: ${CORAL}; background: var(--agent-surface-elevated,#fff);
  border-color: rgba(var(--agent-coral-rgb),0.40); }
.fv2-btn-mini:hover { background: rgba(var(--agent-coral-rgb),0.08); }
.fv2-link { display: inline-flex; align-items: center; gap: 3px; background: none; border: 0; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: ${CORAL}; padding: 2px 4px; border-radius: 6px; }
.fv2-link:hover { background: rgba(var(--agent-coral-rgb),0.08); }

/* Activity feed */
.fv2-activity { padding: 18px 22px; }
.fv2-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.fv2-feed { list-style: none; margin: 8px 0 0; padding: 0; }
.fv2-feed-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid ${LINE}; }
.fv2-feed-row:last-child { border-bottom: 0; }
.fv2-feed-icon { display: inline-flex; flex-shrink: 0; }
.fv2-feed-text { flex: 1; font-size: 13px; color: ${INK2}; }
.fv2-feed-when { font-size: 11.5px; color: ${MUT}; flex-shrink: 0; }

/* Sidebar cards */
.fv2-people, .fv2-fees { padding: 16px 18px; }
.fv2-person { display: flex; align-items: center; gap: 11px; padding: 10px 0; border-bottom: 1px solid ${LINE}; }
.fv2-person:last-child { border-bottom: 0; }
.fv2-person-swatch { width: 9px; height: 9px; border-radius: 3px; border: 1.5px solid; flex-shrink: 0; }
.fv2-person-text { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.fv2-person-role { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: ${MUT}; }
.fv2-person-name { font-size: 13px; font-weight: 600; color: ${INK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv2-person-actions { display: flex; gap: 4px; }
.fv2-ibtn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
  border: 1px solid ${LINE}; background: var(--agent-surface-elevated,#fff); color: ${INK3}; transition: all .15s; }
.fv2-ibtn:hover { background: var(--agent-hover-shade); color: ${INK}; }
.fv2-ibtn:focus-visible { outline: none; box-shadow: var(--agent-focus-ring-tight); }
.fv2-fee-row { display: flex; align-items: baseline; justify-content: space-between; font-size: 13px; color: ${INK2}; padding: 7px 0; }
.fv2-fee-strong { font-size: 15px; font-weight: 700; color: ${INK}; }
.fv2-fee-sub { font-size: 11px; color: ${MUT}; margin-top: 2px; }
.fv2-people .fv2-h3, .fv2-fees .fv2-h3 { margin-bottom: 4px; }

/* Steps view */
.fv2-steps { display: flex; flex-direction: column; gap: 14px; }
.fv2-steps-head { padding: 20px 24px; }
.fv2-steps-head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.fv2-steps-sub { font-size: 13px; color: ${INK3}; margin: 5px 0 0; }
.fv2-weighbar { height: 9px; border-radius: 999px; background: rgba(var(--agent-shadow-rgb),0.08); margin-top: 16px; overflow: hidden; }
.fv2-weighbar-fill { display: block; height: 100%; width: var(--to); border-radius: 999px;
  background: linear-gradient(90deg, var(--agent-coral-base,#FF8A65), ${CORAL});
  animation: fv2-grow 1s cubic-bezier(.22,1,.36,1) .2s both; }
.fv2-segment { display: inline-flex; gap: 4px; margin-top: 18px; padding: 4px; border-radius: 11px;
  background: rgba(var(--agent-shadow-rgb),0.05); }
.fv2-seg { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-size: 13px; font-weight: 600;
  color: ${INK2}; background: none; border: 0; cursor: pointer; padding: 7px 14px; border-radius: 8px; transition: all .18s; }
.fv2-seg:hover { color: ${INK}; }
.fv2-seg.is-active { background: var(--agent-surface-elevated,#fff); color: ${INK};
  box-shadow: 0 1px 3px rgba(var(--agent-shadow-rgb),0.12); }
.fv2-seg-dot { width: 8px; height: 8px; border-radius: 3px; }
.fv2-seg-count { font-size: 11.5px; font-weight: 700; color: var(--seg); opacity: .9; }
.fv2-seg:not(.is-active) .fv2-seg-count { color: ${MUT}; }

.fv2-sections { display: flex; flex-direction: column; gap: 10px; animation: fv2-fade .3s ease-out both; }
@keyframes fv2-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.fv2-sec { padding: 4px 8px; overflow: hidden; }
.fv2-sec-head { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0; cursor: pointer;
  font-family: inherit; padding: 12px 12px; border-radius: 10px; transition: background .15s; }
.fv2-sec-head:hover { background: var(--agent-hover-shade); }
.fv2-sec-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
.fv2-sec-label { font-size: 14px; font-weight: 600; color: ${INK}; flex: 1; text-align: left; }
.fv2-sec-count { font-size: 12px; font-weight: 700; color: ${MUT}; }
.fv2-sec-caret { color: ${MUT}; transition: transform .2s; }
.fv2-sec-caret.is-open { transform: rotate(90deg); }
.fv2-rows { list-style: none; margin: 0; padding: 2px 4px 8px; }
.fv2-row { display: flex; align-items: center; gap: 12px; padding: 10px 10px; border-radius: 10px; transition: background .15s; }
.fv2-row:hover { background: var(--agent-hover-tint); box-shadow: var(--agent-hover-lift); }
.fv2-row-mark { width: 20px; display: grid; place-items: center; flex-shrink: 0; }
.fv2-mark-done { width: 19px; height: 19px; border-radius: 999px; background: ${GREEN}; color: #fff; display: grid; place-items: center; }
.fv2-mark-current { width: 18px; height: 18px; border-radius: 999px; border: 2px solid; display: grid; place-items: center; }
.fv2-mark-current span { width: 8px; height: 8px; border-radius: 999px; display: block; }
.fv2-mark-avail { width: 16px; height: 16px; border-radius: 999px; border: 2px dashed rgba(var(--agent-coral-rgb),0.6); }
.fv2-mark-lock { color: var(--agent-text-disabled, rgba(45,24,16,0.35)); }
.fv2-row-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.fv2-row-name { font-size: 13.5px; font-weight: 500; color: ${INK}; }
.fv2-row.is-locked .fv2-row-name { color: ${MUT}; font-weight: 400; }
.fv2-row.is-current .fv2-row-name { font-weight: 600; }
.fv2-row-by { font-size: 11.5px; color: ${MUT}; }
.fv2-row-meta { font-size: 11.5px; color: ${INK3}; }
.fv2-row-meta.is-avail { color: ${CORAL}; font-weight: 600; }
.fv2-row-tag { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.fv2-row-cta { flex-shrink: 0; }

@media (prefers-reduced-motion: reduce) {
  .fv2-enter, .fv2-step, .fv2-track-fill, .fv2-weighbar-fill, .fv2-tab-underline, .fv2-sections, .fv2-node-pulse
  { animation: none !important; }
  .fv2-track-fill, .fv2-weighbar-fill { width: var(--to); }
}
`;
