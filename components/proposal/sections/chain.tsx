"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, Disclosure, Readout, Note, num } from "../ui";
import { pct } from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

const STEPS = [
  "Boardwalk adds its sales to the platform.",
  "Those sales form part of property chains.",
  "Other agents in each chain are invited to collaborate.",
  "Some invited agents become TSP customers.",
  "Those customers add their own sales.",
  "Further connected chains and invitations are generated.",
];

export function ChainSection() {
  const { track } = useBeacon();
  const [step, setStep] = useState(0);

  // Optional acquisition model
  const [agencies, setAgencies] = useState(20);
  const [avgSales, setAvgSales] = useState(10);
  const [invitesPerSale, setInvitesPerSale] = useState(1.5);
  const [uniqueRate, setUniqueRate] = useState(0.6);
  const [conversion, setConversion] = useState(0.1);
  const [calcTouched, setCalcTouched] = useState(false);

  const model = useMemo(() => {
    const gross = agencies * avgSales * invitesPerSale;
    const unique = gross * uniqueRate;
    const customers = unique * conversion;
    return { gross, unique, customers };
  }, [agencies, avgSales, invitesPerSale, uniqueRate, conversion]);

  const onCalc = () => {
    if (!calcTouched) {
      setCalcTouched(true);
      track("calculator_open", { detail: "chain-acquisition", sectionId: "chain" });
    }
  };

  return (
    <Section id="chain">
      <SectionHead
        eyebrow="07 — Organic reach"
        title={
          <>
            Every chain creates another introduction<span className="prop-stop">.</span>
          </>
        }
        lead="A route to customer acquisition built into the transactions agencies already manage. When Boardwalk adds a sale, other agents in the chain can be invited to collaborate — experiencing TSP through a transaction they already care about."
      />

      <div className="prop-chainwrap">
        <div className="prop-card prop-card--pad-lg">
          <ChainDiagram step={step} />
        </div>
        <div className="prop-card prop-card--pad-lg prop-chain-steps">
          <p className="prop-eyebrow" style={{ marginBottom: 10 }}>Step {step + 1} of {STEPS.length}</p>
          <p className="prop-lead" style={{ fontSize: "1.1rem", minHeight: "3.2em" }}>{STEPS[step]}</p>
          {step === STEPS.length - 1 && (
            <p className="prop-body" style={{ marginTop: "0.5rem" }}>
              Authorised backend automation could request missing chain details, follow up on outstanding updates and help
              complete connected records — a potential organic route alongside direct marketing.
            </p>
          )}
          <div className="prop-flex" style={{ marginTop: "1.4rem" }}>
            <button className="prop-btn prop-btn--ghost prop-btn--sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
            <button className="prop-btn prop-btn--primary prop-btn--sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>
              {step === STEPS.length - 1 ? "Complete" : "Next"}
            </button>
          </div>
          <div className="prop-chain-dots" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className="prop-chain-dot" data-on={i <= step} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "1.75rem" }}>
        <Disclosure title="Explore the acquisition model (illustrative)" onOpen={onCalc}>
          <p className="prop-body" style={{ marginBottom: "1.4rem" }}>
            A rough feel for how chain invitations could compound — not a forecast, and not validated. It accounts for duplicate
            invitations and overlapping agencies rather than treating every connection as a unique opportunity.
          </p>
          <div className="prop-grid prop-grid-2" style={{ gap: "1.5rem" }}>
            <div className="prop-stack-lg">
              <Slider label="Participating agencies" value={agencies} min={1} max={500} step={1} onChange={(v) => { onCalc(); setAgencies(v); }} />
              <Slider label="Avg active sales / agency" value={avgSales} min={1} max={60} step={1} onChange={(v) => { onCalc(); setAvgSales(v); }} />
              <Slider label="Invitation opportunities / sale" value={invitesPerSale} min={0} max={4} step={0.1} onChange={(v) => { onCalc(); setInvitesPerSale(v); }} format={(v) => v.toFixed(1)} />
              <Slider label="Unique (non-duplicate) rate" value={uniqueRate} min={0} max={1} step={0.05} onChange={(v) => { onCalc(); setUniqueRate(v); }} format={(v) => pct(v, 0)} />
              <Slider label="Invitation → customer conversion" value={conversion} min={0} max={0.5} step={0.01} onChange={(v) => { onCalc(); setConversion(v); }} format={(v) => pct(v, 0)} />
            </div>
            <div className="prop-stack">
              <Readout label="Gross invitation opportunities / month" value={num(Math.round(model.gross))} />
              <Readout label="After removing duplicates" value={num(Math.round(model.unique))} />
              <Readout label="Illustrative new customers / month" value={num(Math.round(model.customers))} coral hint="Hypothetical conversion — not validated" />
            </div>
          </div>
          <Note>
            Entirely illustrative. Conversion rates are hypothetical and do not imply guaranteed viral growth. Access is always
            limited to the information each participant is authorised to see; the network above uses fictional agencies.
          </Note>
        </Disclosure>
      </div>

      <style>{`
        .prop-chainwrap { display: grid; grid-template-columns: 1.3fr 1fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: stretch; }
        .prop-chain-steps { display: flex; flex-direction: column; }
        .prop-chain-dots { display: flex; gap: 6px; margin-top: auto; padding-top: 1.4rem; }
        .prop-chain-dot { width: 100%; height: 3px; border-radius: 2px; background: var(--prop-line); transition: background 0.2s ease; }
        .prop-chain-dot[data-on="true"] { background: var(--prop-coral); }
        @media (max-width: 820px) { .prop-chainwrap { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}

function ChainDiagram({ step }: { step: number }) {
  // step gates visibility: 0 Boardwalk, 1 chain lines, 2 invited agencies,
  // 3 one converts, 4 their sales, 5 full.
  const invitedVisible = step >= 2;
  const linesVisible = step >= 1;
  const convertVisible = step >= 3;
  const furtherVisible = step >= 4;
  const op = (on: boolean) => ({ opacity: on ? 1 : 0.12, transition: "opacity 0.4s ease" });

  const invited = [
    { x: 80, converted: false },
    { x: 210, converted: true },
    { x: 340, converted: true },
  ];

  return (
    <svg width="100%" viewBox="0 0 420 320" role="img" aria-label={`Chain network, step ${step + 1}`}>
      {/* Boardwalk */}
      <g>
        <rect x={150} y={18} width={120} height={46} rx={10} fill="var(--prop-navy)" />
        <text x={210} y={38} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--prop-navy-ink)">Boardwalk</text>
        <text x={210} y={54} textAnchor="middle" fontSize="9" fill="var(--prop-navy-ink-2)">Active agency</text>
      </g>

      {/* lines to invited */}
      <g stroke="var(--prop-line-strong)" strokeWidth="1.3" style={op(linesVisible)}>
        {invited.map((n, i) => (
          <path key={i} d={`M 210 64 C 210 110, ${n.x + 20} 110, ${n.x + 20} 150`} fill="none" />
        ))}
      </g>

      {/* invited agencies */}
      {invited.map((n, i) => {
        const on = invitedVisible;
        const converted = convertVisible && n.converted;
        return (
          <g key={i} style={op(on)}>
            <rect x={n.x} y={150} width={40} height={40} rx={9}
              fill={converted ? "var(--prop-coral-tint)" : "var(--prop-surface)"}
              stroke={converted ? "var(--prop-coral)" : "var(--prop-line-strong)"} strokeWidth="1.4" />
            {/* house glyph */}
            <path d={`M ${n.x + 10} ${176} l 10 -9 l 10 9 v 9 h -20 z`} fill="none"
              stroke={converted ? "var(--prop-coral-strong)" : "var(--prop-ink-3)"} strokeWidth="1.4" strokeLinejoin="round" />
            <text x={n.x + 20} y={206} textAnchor="middle" fontSize="8.5" fill="var(--prop-ink-3)">
              {converted ? "TSP customer" : "Invited"}
            </text>
            {/* further chains */}
            <g style={op(furtherVisible && n.converted)} stroke="var(--prop-line)" strokeWidth="1.1">
              <path d={`M ${n.x + 10} 206 C ${n.x + 10} 240, ${n.x - 6} 240, ${n.x - 6} 266`} fill="none" />
              <path d={`M ${n.x + 30} 206 C ${n.x + 30} 240, ${n.x + 46} 240, ${n.x + 46} 266`} fill="none" />
              <circle cx={n.x - 6} cy={276} r={9} fill="none" stroke="var(--prop-ink-3)" strokeWidth="1.2" />
              <circle cx={n.x + 46} cy={276} r={9} fill="none" stroke="var(--prop-ink-3)" strokeWidth="1.2" />
            </g>
          </g>
        );
      })}
      {furtherVisible && (
        <text x={210} y={308} textAnchor="middle" fontSize="9" fill="var(--prop-ink-3)">Further connected chains</text>
      )}
    </svg>
  );
}
