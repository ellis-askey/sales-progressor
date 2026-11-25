"use client";

import { useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Chip, cx } from "../ui";
import { useBeacon } from "../analytics-client";

const STAGES = [
  { n: 1, title: "Identify", meta: "Boardwalk identifies a genuine operational requirement." },
  { n: 2, title: "Develop", meta: "TSP builds a secure, production-ready solution." },
  { n: 3, title: "Use", meta: "Boardwalk incorporates it into day-to-day operations." },
  { n: 4, title: "Refine", meta: "We resolve issues and improve the experience where needed." },
  { n: 5, title: "Release", meta: "Once we're happy, it becomes available to the wider industry." },
  { n: 6, title: "Reinvest", meta: "Revenue and feedback inform the next round of development." },
];

interface Example {
  id: string;
  label: string;
  status: "prototype" | "opportunity";
  stages: string[];
}

const EXAMPLES: Example[] = [
  {
    id: "forms",
    label: "Forms & questionnaires",
    status: "prototype",
    stages: [
      "Boardwalk needs branded fact-finds, feedback and vendor forms — without yet another subscription.",
      "TSP builds a form builder that writes straight into the platform and property files.",
      "Boardwalk runs its real forms through it, day to day.",
      "We tighten the logic, validation and respondent experience from real use.",
      "TSP Forms is offered to other agencies at £29/month.",
      "Subscription revenue and feedback fund the next form capabilities.",
    ],
  },
  {
    id: "tasks",
    label: "Task management",
    status: "prototype",
    stages: [
      "The team needs shared tasks tied to actual sales and staff, not a generic to-do app.",
      "TSP builds Tasks, linked to property files, transactions and people.",
      "Boardwalk coordinates work across the office inside one system.",
      "We refine recurrence, assignment and views from daily use.",
      "TSP Tasks is released at £29/month, or £49 bundled with Forms.",
      "Revenue and usage shape team-coordination features next.",
    ],
  },
  {
    id: "onboarding",
    label: "Staff onboarding",
    status: "opportunity",
    stages: [
      "New joiners need a consistent path — accounts, training and checklists.",
      "TSP could build structured onboarding flows for agency teams.",
      "Boardwalk onboards its own hires through it.",
      "We refine the steps around real onboarding experience.",
      "Offered to agencies that struggle to onboard consistently.",
      "Adoption informs wider team and people tooling.",
    ],
  },
  {
    id: "reporting",
    label: "Management reporting",
    status: "opportunity",
    stages: [
      "Directors want clearer operational reporting across branches and staff.",
      "TSP could build reporting on the data the platform already holds.",
      "Boardwalk's directors use it to run the business.",
      "We refine the metrics that actually matter in practice.",
      "Released as a reporting layer for agency groups.",
      "Revenue funds deeper analytics and forecasting.",
    ],
  },
  {
    id: "automation",
    label: "Workflow automation",
    status: "opportunity",
    stages: [
      "Repetitive steps — chasing, follow-ups, record-keeping — should run themselves.",
      "TSP could build authorised automation across the platform.",
      "Boardwalk automates its routine operational steps.",
      "We refine triggers and guardrails from real workflows.",
      "Released as configurable automation for the wider market.",
      "Revenue and feedback expand what can be safely automated.",
    ],
  },
];

export function CycleSection() {
  const { track } = useBeacon();
  const [exampleId, setExampleId] = useState("forms");
  const [stage, setStage] = useState(0);
  const example = EXAMPLES.find((e) => e.id === exampleId)!;

  const pickExample = (id: string) => {
    setExampleId(id);
    setStage(0);
    track("section_expand", { sectionId: "cycle", detail: `example:${id}` });
  };

  return (
    <Section id="cycle" alt>
      <SectionHead
        eyebrow="04 — Build once"
        title={
          <>
            Build once. Create value across the industry<span className="prop-stop">.</span>
          </>
        }
        lead="Boardwalk's operational needs become the starting point for reusable, commercial software. We are not building bespoke software exclusively for one agency — we are developing capabilities that work across different agency models."
      />

      <div className="prop-card prop-card--pad-lg" style={{ marginTop: "2rem" }}>
        <div className="prop-field-label" style={{ marginBottom: "0.7rem" }}>Follow an operational requirement through the cycle</div>
        <div className="prop-flex-wrap" style={{ marginBottom: "1.5rem" }}>
          {EXAMPLES.map((e) => (
            <button
              key={e.id}
              type="button"
              className="prop-seg-btn"
              data-active={e.id === exampleId}
              style={
                e.id === exampleId
                  ? { background: "var(--prop-coral)", color: "#fff", border: "1px solid var(--prop-coral)" }
                  : { border: "1px solid var(--prop-line-strong)" }
              }
              onClick={() => pickExample(e.id)}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="prop-flex-wrap" style={{ marginBottom: "1.25rem" }}>
          <Chip tone={example.status === "prototype" ? "coral" : undefined}>
            {example.status === "prototype" ? "Early prototype exists" : "Potential opportunity — not a committed build"}
          </Chip>
        </div>

        {/* Stage stepper */}
        <div className="prop-cycle">
          {STAGES.map((s, i) => (
            <button
              key={s.n}
              type="button"
              className={cx("prop-cycle-node")}
              data-active={i === stage}
              data-done={i < stage}
              onClick={() => setStage(i)}
              aria-label={`Stage ${s.n}: ${s.title}`}
            >
              <span className="prop-cycle-num">{s.n}</span>
              <span className="prop-cycle-title">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="prop-card prop-card--quiet" style={{ marginTop: "1.4rem" }} aria-live="polite">
          <div className="prop-between" style={{ alignItems: "baseline", marginBottom: "0.5rem" }}>
            <h3 className="prop-h3">
              {STAGES[stage].n}. {STAGES[stage].title}
            </h3>
            <span className="prop-caption">{example.label}</span>
          </div>
          <p className="prop-body prop-body-ink" style={{ marginBottom: "0.6rem" }}>{example.stages[stage]}</p>
          <p className="prop-caption">{STAGES[stage].meta}</p>
          <div className="prop-flex" style={{ marginTop: "1.1rem", gap: 8 }}>
            <button className="prop-btn prop-btn--ghost prop-btn--sm" onClick={() => setStage((s) => Math.max(0, s - 1))} disabled={stage === 0}>
              Previous
            </button>
            <button
              className="prop-btn prop-btn--primary prop-btn--sm"
              onClick={() => setStage((s) => Math.min(STAGES.length - 1, s + 1))}
              disabled={stage === STAGES.length - 1}
            >
              Next stage
            </button>
          </div>
        </div>
      </div>

      <p className="prop-fnote" style={{ marginTop: "1.25rem" }}>
        Boardwalk receives properly developed functionality, not a series of experiments. Private configurations and customer
        data stay separate; the reusable capabilities belong within the TSP platform and are released once ready. Future
        examples are illustrative opportunities, not commitments.
      </p>

      <style>{`
        .prop-cycle { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; }
        .prop-cycle-node { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
          background: transparent; border: 0; cursor: pointer; font-family: inherit; padding: 0.4rem 0.2rem; }
        .prop-cycle-node::after { content: ""; position: absolute; top: 18px; left: 50%; width: 100%; height: 2px; background: var(--prop-line); z-index: 0; }
        .prop-cycle-node:last-child::after { display: none; }
        .prop-cycle-num { position: relative; z-index: 1; width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center;
          background: var(--prop-surface); border: 1.5px solid var(--prop-line-strong); color: var(--prop-ink-3); font-weight: 700; font-size: 0.9rem; transition: all 0.18s ease; }
        .prop-cycle-title { font-size: 0.75rem; color: var(--prop-ink-3); text-align: center; transition: color 0.15s ease; }
        .prop-cycle-node[data-done="true"] .prop-cycle-num { border-color: var(--prop-coral); color: var(--prop-coral-strong); }
        .prop-cycle-node[data-active="true"] .prop-cycle-num { background: var(--prop-coral); border-color: var(--prop-coral); color: #fff; transform: scale(1.08); }
        .prop-cycle-node[data-active="true"] .prop-cycle-title { color: var(--prop-ink); font-weight: 600; }
        @media (max-width: 680px) {
          .prop-cycle { grid-template-columns: repeat(3, 1fr); gap: 0.75rem 0.4rem; }
          .prop-cycle-node::after { display: none; }
        }
      `}</style>
    </Section>
  );
}
