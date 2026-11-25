"use client";

import { useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Chip } from "../ui";
import { useBeacon } from "../analytics-client";

const AREAS = ["Property files", "Transactions", "Chains", "Tasks", "Forms", "Documents", "Communications", "Reporting", "Contacts", "Workflows"];

interface Example {
  id: string;
  prompt: string;
  response: string;
  trace: string;
  write: boolean;
}
const EXAMPLES: Example[] = [
  {
    id: "attention",
    prompt: "Review every active sale and tell me which ones need attention.",
    response:
      "4 of 23 active sales need attention: two stalled on enquiries for over 14 days, one awaiting a mortgage offer past its target date, and one with no update in 10 days. Everything else is on track.",
    trace: "Reads active transactions and applies the risk rules. Read-only — nothing changes.",
    write: false,
  },
  {
    id: "drafts",
    prompt: "Draft an update for every buyer waiting on searches.",
    response:
      "Drafted 6 buyer updates for sales awaiting search results. Each is personalised to its file and queued for your review — nothing is sent until you approve it.",
    trace: "Reads the 6 relevant files, drafts copy, and holds each for human approval before any send.",
    write: false,
  },
  {
    id: "forecast",
    prompt: "Which chains are likely to exchange this month?",
    response:
      "3 chains look likely to exchange this month, 2 are borderline pending replies to enquiries, and 1 is at risk. Based on milestone progress and historical timings.",
    trace: "Reads chain and milestone data and runs the forecast. Read-only.",
    write: false,
  },
  {
    id: "tasks",
    prompt: "Create tasks for outstanding enquiries that haven't been chased.",
    response:
      "Found 5 enquiries with no chase in 7+ days and created a task for each, assigned to the file owner and due tomorrow.",
    trace: "Reads enquiries, then writes 5 tasks — a sensitive action, so it's permissioned, logged and reversible.",
    write: true,
  },
  {
    id: "delays",
    prompt: "Show me the most common causes of delays across our transactions.",
    response:
      "Across 142 completed sales, the top delay causes were management packs (28%), enquiry turnaround (24%) and mortgage offers (19%).",
    trace: "Aggregates historical data, effectively anonymised where needed. Read-only.",
    write: false,
  },
];

export function AiSection() {
  const { track } = useBeacon();
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const active = EXAMPLES.find((e) => e.id === activeId)!;

  const pick = (id: string) => {
    setActiveId(id);
    track("section_expand", { sectionId: "ai", detail: `demo:${id}` });
  };

  return (
    <Section id="ai" wide>
      <SectionHead
        eyebrow="13 — AI & the source of truth"
        title={
          <>
            The operational source of truth<span className="prop-stop">.</span>
          </>
        }
      />
      <p className="prop-serif" style={{ fontSize: "clamp(1.3rem, 2.8vw, 2rem)", lineHeight: 1.3, color: "var(--prop-coral-strong)", maxWidth: "26ch", margin: "0 0 2.5rem" }}>
        We&rsquo;re not trying to build a better AI assistant. We&rsquo;re building the infrastructure that makes AI useful within
        estate agency.
      </p>

      {/* Architecture */}
      <div className="prop-ai-arch">
        <div className="prop-ai-assistants">
          <div className="prop-card prop-ai-box">Claude</div>
          <div className="prop-card prop-ai-box">ChatGPT</div>
        </div>
        <Arrow />
        <div className="prop-ai-mcp">Secure MCP · authorised access, permissions, audit trail</div>
        <Arrow />
        <div className="prop-ai-core">
          <div className="prop-h2" style={{ color: "#fff" }}>TSP</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem", marginTop: 4 }}>Data · Business logic · Permissions · Audit history</div>
        </div>
        <div className="prop-ai-areas">
          {AREAS.map((a) => (
            <span key={a} className="prop-ai-area">{a}</span>
          ))}
        </div>
        <Arrow />
        <div className="prop-ai-interfaces">
          <div className="prop-card prop-ai-box" style={{ display: "block", textAlign: "center" }}>
            <strong style={{ color: "var(--prop-ink)" }}>Agency interface</strong>
            <div className="prop-caption">Directors, staff and progressors</div>
          </div>
          <div className="prop-card prop-ai-box" style={{ display: "block", textAlign: "center" }}>
            <strong style={{ color: "var(--prop-ink)" }}>Client & partner portals</strong>
            <div className="prop-caption">Buyers, sellers and authorised professionals</div>
          </div>
        </div>
      </div>

      {/* Interactive examples */}
      <div style={{ marginTop: "3rem" }}>
        <h3 className="prop-h3" style={{ marginBottom: "1.2rem" }}>What that could feel like</h3>
        <div className="prop-ai-demo">
          <div className="prop-ai-prompts">
            {EXAMPLES.map((e) => (
              <button key={e.id} type="button" className="prop-ai-prompt" data-active={e.id === activeId} onClick={() => pick(e.id)}>
                <span style={{ color: "var(--prop-coral-strong)", flexShrink: 0 }}>&rsaquo;</span>
                <span>{e.prompt}</span>
              </button>
            ))}
          </div>
          <div className="prop-card prop-card--pad-lg prop-ai-response" aria-live="polite">
            <div className="prop-flex" style={{ gap: 10, alignItems: "flex-start", marginBottom: "1rem" }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--prop-coral)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>AI</span>
              <p className="prop-body prop-body-ink" style={{ fontSize: "0.9375rem" }}>{active.prompt}</p>
            </div>
            <div className="prop-card prop-card--quiet" style={{ marginBottom: "1rem" }}>
              <p className="prop-body prop-body-ink">{active.response}</p>
            </div>
            <p className="prop-caption" style={{ marginBottom: "0.9rem" }}><strong style={{ color: "var(--prop-ink-2)" }}>How TSP handles it:</strong> {active.trace}</p>
            <div className="prop-flex-wrap">
              <Chip>Authorised</Chip>
              <Chip>Tenant-isolated</Chip>
              <Chip>Audited</Chip>
              {active.write && <Chip tone="coral">Human approval</Chip>}
            </div>
          </div>
        </div>
        <p className="prop-fnote" style={{ marginTop: "1.25rem" }}>
          Deterministic demonstrations on fictional data — not live AI requests, and not evidence every capability exists today.
          MCP is a future capability. Permissions, tenant isolation, auditability and human approval for sensitive actions are
          essential.
        </p>
      </div>

      <style>{`
        .prop-ai-arch { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .prop-ai-assistants, .prop-ai-interfaces { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%; max-width: 620px; }
        .prop-ai-box { display: grid; place-items: center; font-weight: 600; min-height: 56px; }
        .prop-ai-mcp { background: var(--prop-navy-2); color: var(--prop-navy-ink); border-radius: var(--prop-r); padding: 0.75rem 1.25rem; font-size: 0.8125rem; text-align: center; width: 100%; max-width: 620px; }
        .prop-ai-core { background: linear-gradient(135deg, var(--prop-coral-soft), var(--prop-coral)); color: #fff; border-radius: var(--prop-r); padding: 1.3rem; text-align: center; width: 100%; max-width: 620px; }
        .prop-ai-areas { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; max-width: 680px; margin: 0.4rem 0; }
        .prop-ai-area { font-size: 0.75rem; color: var(--prop-ink-2); background: var(--prop-surface); border: 1px solid var(--prop-line); border-radius: 999px; padding: 0.3rem 0.7rem; }
        .prop-ai-demo { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: clamp(1rem, 2.5vw, 1.5rem); align-items: start; }
        .prop-ai-prompts { display: flex; flex-direction: column; gap: 6px; }
        .prop-ai-prompt { display: flex; gap: 8px; text-align: left; font-family: inherit; font-size: 0.9375rem; color: var(--prop-ink-2); background: var(--prop-surface); border: 1px solid var(--prop-line); border-radius: 10px; padding: 0.75rem 0.9rem; cursor: pointer; transition: all 0.15s ease; }
        .prop-ai-prompt:hover { border-color: var(--prop-line-strong); }
        .prop-ai-prompt[data-active="true"] { border-color: var(--prop-coral); box-shadow: 0 0 0 1px var(--prop-coral); color: var(--prop-ink); }
        @media (max-width: 760px) { .prop-ai-demo { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}

function Arrow() {
  return (
    <svg width="16" height="24" viewBox="0 0 16 24" fill="none" aria-hidden>
      <path d="M8 0v18m0 0l-4-4m4 4l4-4" stroke="var(--prop-coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
