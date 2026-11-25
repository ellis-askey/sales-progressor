"use client";

import { useState } from "react";
import { Section } from "./_shell";
import { SectionHead } from "../ui";
import { useBeacon } from "../analytics-client";

interface Stage {
  id: string;
  label: string;
  short: string;
  why: string;
  contribution: string;
  connects: string;
  measure: string;
}

const STAGES: Stage[] = [
  {
    id: "marketing",
    label: "Marketing",
    short: "More agencies discover TSP.",
    why: "Awareness is where the cycle starts — agencies can't adopt what they haven't found.",
    contribution: "Direct outreach, demonstrations, events, case studies and chain invitations bring agencies to the platform.",
    connects: "Every agency that discovers TSP becomes a candidate to adopt it.",
    measure: "Reach, demo requests, cost per acquisition, conversion.",
  },
  {
    id: "adoption",
    label: "Adoption",
    short: "More live transactions.",
    why: "Live transactions are the raw material for everything downstream.",
    contribution: "Each agency brings real sales, real chains and genuine day-to-day usage.",
    connects: "More live sales means more connected chains and more operational data.",
    measure: "Active agencies, live transactions, activation rate.",
  },
  {
    id: "insight",
    label: "Insight",
    short: "Historical data & connected chains.",
    why: "Historical transaction data and chain relationships take time to accumulate — and aren't quickly copied.",
    contribution: "Milestone histories, delay reasons and chain structures build up across the network.",
    connects: "Richer data makes forecasting and automation meaningfully better.",
    measure: "Data coverage, chain completeness, forecast accuracy.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    short: "Better automation & functionality.",
    why: "Better software and AI turn accumulated data into an advantage agencies can feel.",
    contribution: "Improved forecasting, blocker detection and automation built on real patterns.",
    connects: "Smarter functionality makes the platform more valuable to keep using.",
    measure: "Feature adoption, time saved, blockers resolved.",
  },
  {
    id: "value",
    label: "Value",
    short: "Stronger retention & more reasons to join.",
    why: "A platform that's more useful is harder to leave and easier to recommend.",
    contribution: "Stronger retention, more reasons to join, and word of mouth between agencies.",
    connects: "Retained, growing customers produce more revenue.",
    measure: "Retention, referrals, account expansion.",
  },
  {
    id: "revenue",
    label: "Revenue",
    short: "Reinvest in growth & development.",
    why: "Revenue funds the next turn of the wheel.",
    contribution: "Reinvested into marketing and product development.",
    connects: "More investment brings more agencies — back to the start of the cycle.",
    measure: "Revenue, gross margin, reinvestment rate.",
  },
];

export function FlywheelSection() {
  const { track } = useBeacon();
  const [activeIdx, setActiveIdx] = useState(0);
  const active = STAGES[activeIdx];

  const pick = (i: number) => {
    setActiveIdx(i);
    track("section_expand", { sectionId: "flywheel", detail: `stage:${STAGES[i].id}` });
  };

  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const R = 128;

  const nodePos = (i: number) => {
    const angle = (-90 + i * (360 / STAGES.length)) * (Math.PI / 180);
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  };

  return (
    <Section id="flywheel" alt>
      <SectionHead
        eyebrow="06 — The growth flywheel"
        title={
          <>
            The advantage that grows with every transaction<span className="prop-stop">.</span>
          </>
        }
        lead="Software is increasingly quick to build. Historical insight, relationships and an active network take time to accumulate. Several parts of this cycle run at once — Boardwalk informs the product, marketing brings in agencies, and those agencies create more connected transactions."
      />

      <div className="prop-fly">
        <div className="prop-fly-diagram">
          <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 400 }} role="img" aria-label="Growth flywheel diagram">
            {/* ring */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--prop-line-strong)" strokeWidth="1.5" strokeDasharray="2 6" />
            {/* directional arcs between consecutive nodes */}
            {STAGES.map((_, i) => {
              const a = nodePos(i);
              const b = nodePos((i + 1) % STAGES.length);
              return (
                <path
                  key={i}
                  d={`M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`}
                  fill="none"
                  stroke={i === activeIdx ? "var(--prop-coral)" : "var(--prop-line)"}
                  strokeWidth={i === activeIdx ? 3 : 2}
                  style={{ transition: "stroke 0.2s ease" }}
                />
              );
            })}
            {/* centre */}
            <circle cx={cx} cy={cy} r={58} fill="var(--prop-navy)" />
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--prop-navy-ink)">TSP</text>
            <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8.5" fill="var(--prop-navy-ink-2)">Compounding value</text>
            {/* nodes */}
            {STAGES.map((s, i) => {
              const p = nodePos(i);
              const on = i === activeIdx;
              return (
                <g key={s.id} style={{ cursor: "pointer" }} onClick={() => pick(i)}>
                  <circle cx={p.x} cy={p.y} r={on ? 24 : 20} fill={on ? "var(--prop-coral)" : "var(--prop-surface)"} stroke={on ? "var(--prop-coral)" : "var(--prop-line-strong)"} strokeWidth="1.5" style={{ transition: "all 0.18s ease" }} />
                  <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={on ? "#fff" : "var(--prop-ink-3)"}>
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="prop-fly-chips">
            {STAGES.map((s, i) => (
              <button key={s.id} type="button" className="prop-seg-btn" data-active={i === activeIdx} onClick={() => pick(i)}
                style={i === activeIdx ? { background: "var(--prop-coral)", color: "#fff" } : undefined}>
                {i + 1}. {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="prop-card prop-card--pad-lg prop-fly-detail" aria-live="polite">
          <p className="prop-eyebrow" style={{ marginBottom: 6 }}>Stage {activeIdx + 1}</p>
          <h3 className="prop-h2" style={{ marginBottom: "0.4rem" }}>{active.label}</h3>
          <p className="prop-lead" style={{ fontSize: "1.05rem", marginBottom: "1.4rem" }}>{active.short}</p>
          <dl className="prop-fly-dl">
            <Row term="Why it matters" desc={active.why} />
            <Row term="How it contributes" desc={active.contribution} />
            <Row term="How it connects" desc={active.connects} />
            <Row term="What we'd measure" desc={active.measure} />
          </dl>
        </div>
      </div>

      <p className="prop-fnote" style={{ marginTop: "1.5rem" }}>
        A potential compounding advantage — not a guarantee. It depends on adoption, data quality and permitted use. The software
        itself can be replicated; cross-agency benchmarking and product insight require appropriately authorised and, where
        necessary, effectively anonymised data. Customer data is not unrestricted intellectual property.
      </p>

      <style>{`
        .prop-fly { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: clamp(1.25rem, 3vw, 2.5rem); margin-top: 2rem; align-items: center; }
        .prop-fly-diagram { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .prop-fly-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .prop-fly-dl { display: grid; gap: 1rem; margin: 0; }
        @media (max-width: 860px) { .prop-fly { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}

function Row({ term, desc }: { term: string; desc: string }) {
  return (
    <div>
      <dt className="prop-eyebrow" style={{ color: "var(--prop-ink-3)", marginBottom: 4 }}>{term}</dt>
      <dd className="prop-body prop-body-ink" style={{ margin: 0, fontSize: "0.9375rem" }}>{desc}</dd>
    </div>
  );
}
