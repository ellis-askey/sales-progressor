"use client";

import { useState } from "react";
import { Section } from "./_shell";
import { SectionHead, cx } from "../ui";

interface Phase {
  n: string;
  title: string;
  product: string[];
  commercial: string[];
  unlocks: string;
}

const PHASES: Phase[] = [
  {
    n: "01",
    title: "Establish the foundation",
    product: ["Onboard Boardwalk", "Agree success measures", "Refine migration & core progression workflows"],
    commercial: ["Agree partnership & funding", "Begin marketing TSP immediately"],
    unlocks: "A credible product and a launchpad for growth.",
  },
  {
    n: "02",
    title: "Expand operational tools",
    product: ["Review subscriptions & workflows", "Release production-ready Forms, Tasks & modules", "Expand integrations & the progressor network"],
    commercial: ["Build credibility & grow the customer base", "Gather feedback", "Introduce competitively-priced modules"],
    unlocks: "More reasons to adopt, and greater customer value.",
  },
  {
    n: "03",
    title: "Scale nationally",
    product: ["Strengthen onboarding, support & reliability", "Advance AI & automation", "Recruit where justified"],
    commercial: ["Establish repeatable acquisition", "Demonstrate outcomes & case studies", "Track sustainable margins"],
    unlocks: "Repeatable, sustainable commercial growth.",
  },
  {
    n: "04",
    title: "Build the wider ecosystem",
    product: ["Extend commercially-proven modules", "Secure MCP across authorised workflows"],
    commercial: ["Grow the professional network", "Establish TSP's industry position"],
    unlocks: "A broader agency operating platform.",
  },
];

export function RoadmapSection() {
  const [active, setActive] = useState(0);
  const phase = PHASES[active];

  return (
    <Section id="roadmap" alt>
      <SectionHead
        eyebrow="16 — Roadmap"
        title={
          <>
            A phased route to the wider vision<span className="prop-stop">.</span>
          </>
        }
        lead="Build in the right order, while growing the existing business from the outset. Product development and commercial growth run as parallel workstreams. Proposed phases, not fixed deadlines."
      />

      <div className="prop-rm-track" role="tablist" aria-label="Roadmap phases">
        {PHASES.map((p, i) => (
          <button
            key={p.n}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={cx("prop-rm-node")}
            data-active={i === active}
            data-done={i < active}
            onClick={() => setActive(i)}
          >
            <span className="prop-rm-num">{p.n}</span>
            <span className="prop-rm-title">{p.title}</span>
          </button>
        ))}
      </div>

      <div className="prop-card prop-card--pad-lg" style={{ marginTop: "1.5rem" }} aria-live="polite">
        <div className="prop-grid prop-grid-2" style={{ gap: "1.75rem" }}>
          <div>
            <p className="prop-eyebrow" style={{ marginBottom: "0.9rem" }}>Product & operations</p>
            <ul className="prop-stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {phase.product.map((x) => (
                <Bullet key={x}>{x}</Bullet>
              ))}
            </ul>
          </div>
          <div>
            <p className="prop-eyebrow" style={{ marginBottom: "0.9rem" }}>Commercial</p>
            <ul className="prop-stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {phase.commercial.map((x) => (
                <Bullet key={x}>{x}</Bullet>
              ))}
            </ul>
          </div>
        </div>
        <div className="prop-panel" style={{ marginTop: "1.6rem", padding: "1.1rem 1.4rem" }}>
          <span className="prop-eyebrow" style={{ color: "var(--prop-coral-soft)" }}>Unlocks</span>
          <p className="prop-h3" style={{ color: "var(--prop-navy-ink)", marginTop: 6 }}>{phase.unlocks}</p>
        </div>
      </div>

      <style>{`
        .prop-rm-track { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 2rem; }
        .prop-rm-node { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; text-align: left;
          background: transparent; border: 0; cursor: pointer; font-family: inherit; padding: 0 0 1rem; border-bottom: 2px solid var(--prop-line); transition: border-color 0.2s ease; }
        .prop-rm-node[data-active="true"] { border-color: var(--prop-coral); }
        .prop-rm-node[data-done="true"] { border-color: var(--prop-coral-soft); }
        .prop-rm-num { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; font-weight: 700; font-size: 0.8rem;
          background: var(--prop-surface); border: 1.5px solid var(--prop-line-strong); color: var(--prop-ink-3); transition: all 0.18s ease; }
        .prop-rm-node[data-active="true"] .prop-rm-num { background: var(--prop-coral); border-color: var(--prop-coral); color: #fff; }
        .prop-rm-title { font-size: 0.875rem; font-weight: 600; color: var(--prop-ink-3); }
        .prop-rm-node[data-active="true"] .prop-rm-title { color: var(--prop-ink); }
        @media (max-width: 760px) { .prop-rm-track { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </Section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="prop-flex" style={{ gap: 10, alignItems: "flex-start" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ marginTop: 3, flexShrink: 0 }}>
        <path d="M3.5 8.5l3 3 6-7" stroke="var(--prop-coral)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="prop-body prop-body-ink" style={{ fontSize: "0.9375rem" }}>{children}</span>
    </li>
  );
}
