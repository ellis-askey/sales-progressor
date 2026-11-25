"use client";

import { useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Chip, cx } from "../ui";

type Status = "live" | "developing" | "future";

const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  developing: "In development",
  future: "On the roadmap",
};

interface Capability {
  id: string;
  title: string;
  status: Status;
  summary: string;
  points: string[];
}

const CAPABILITIES: Capability[] = [
  {
    id: "transactions",
    title: "Sales progression",
    status: "live",
    summary: "The operational core: every sale tracked from offer-accepted to completion.",
    points: ["Property files, milestones and live timelines", "Next actions, reminders and automated chasing", "Task management across the team"],
  },
  {
    id: "client",
    title: "Client experience",
    status: "live",
    summary: "Buyers and sellers stay informed without a single chasing call.",
    points: ["Buyer and seller portals", "Configurable milestone updates and documents", "Professional referral functionality"],
  },
  {
    id: "chain",
    title: "Chain collaboration",
    status: "live",
    summary: "The whole chain, visible — across agencies and professionals.",
    points: ["Connected sales and chain management", "Cross-agency collaboration", "Shared professional contacts"],
  },
  {
    id: "oversight",
    title: "Agency oversight",
    status: "live",
    summary: "Directors see risk and forecast before problems surface.",
    points: ["Risk indicators on every sale", "Exchange forecasting", "Reporting and pipeline visibility"],
  },
  {
    id: "comms",
    title: "Communications",
    status: "live",
    summary: "Email and messaging, managed inside the transaction.",
    points: ["Email integrations", "Communication management", "Everything tied to the file"],
  },
  {
    id: "onboarding",
    title: "Progressor onboarding",
    status: "live",
    summary: "Independent progression businesses run bounded books on the platform.",
    points: ["Independent progressor workspaces", "Memo-of-sale extraction", "Bulk migration of existing sales"],
  },
  {
    id: "ai",
    title: "AI-assisted drafting",
    status: "developing",
    summary: "Drafting, summarisation and blocker analysis — existing and developing functionality.",
    points: ["Chase and update drafting", "Correspondence analysis", "Memo extraction and blocker detection"],
  },
  {
    id: "mcp",
    title: "Operational modules & MCP",
    status: "future",
    summary: "Wider operational tooling and secure AI connectivity — the proposed roadmap.",
    points: ["Forms, tasks and further modules", "Secure MCP access for AI assistants", "Deeper integrations"],
  },
];

export function PlatformSection() {
  const [activeId, setActiveId] = useState(CAPABILITIES[0].id);
  const active = CAPABILITIES.find((c) => c.id === activeId)!;

  return (
    <Section id="platform" alt>
      <SectionHead
        eyebrow="02 — The platform"
        title={
          <>
            The business already exists<span className="prop-stop">.</span>
          </>
        }
        lead="A working platform, built around the realities of property transactions. Established in 2024 and developed around real experience with agents, solicitors, buyers and sellers."
      />

      <div className="prop-plat">
        <ul className="prop-plat-list" aria-label="Platform capabilities">
          {CAPABILITIES.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={cx("prop-plat-item")}
                data-active={c.id === activeId}
                onClick={() => setActiveId(c.id)}
              >
                <span className={cx("prop-plat-dot", `prop-plat-dot--${c.status}`)} aria-hidden />
                <span className="prop-plat-item-title">{c.title}</span>
                <span className="prop-plat-item-status">{STATUS_LABEL[c.status]}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="prop-card prop-card--pad-lg prop-plat-detail" aria-live="polite">
          <div className="prop-flex-wrap" style={{ marginBottom: "0.9rem" }}>
            <Chip tone={active.status === "live" ? "live" : undefined} dot={active.status === "live"}>
              {STATUS_LABEL[active.status]}
            </Chip>
          </div>
          <h3 className="prop-h2" style={{ marginBottom: "0.6rem" }}>{active.title}</h3>
          <p className="prop-body" style={{ marginBottom: "1.2rem" }}>{active.summary}</p>
          <ul className="prop-stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {active.points.map((p) => (
              <li key={p} className="prop-flex" style={{ gap: 10, alignItems: "flex-start" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ marginTop: 3, flexShrink: 0 }}>
                  <path d="M3.5 8.5l3 3 6-7" stroke="var(--prop-coral)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="prop-body prop-body-ink" style={{ fontSize: "0.9375rem" }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="prop-fnote" style={{ marginTop: "1.5rem" }}>
        A live product shown with sanitised, illustrative descriptions — no real customer data appears here, and readers can't
        act on the live application. Status markers distinguish shipped functionality from what is developing or proposed.
      </p>

      <style>{`
        .prop-plat { display: grid; grid-template-columns: 300px minmax(0,1fr); gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2.25rem; }
        .prop-plat-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
        .prop-plat-item { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem;
          background: transparent; border: 1px solid transparent; border-radius: 10px; padding: 0.7rem 0.8rem; cursor: pointer;
          font-family: inherit; text-align: left; transition: background 0.15s ease, border-color 0.15s ease; }
        .prop-plat-item:hover { background: var(--prop-surface); }
        .prop-plat-item[data-active="true"] { background: var(--prop-surface); border-color: var(--prop-line); box-shadow: var(--prop-shadow-sm); }
        .prop-plat-item-title { font-size: 0.9375rem; font-weight: 600; color: var(--prop-ink); }
        .prop-plat-item-status { font-size: 0.6875rem; color: var(--prop-ink-3); text-transform: uppercase; letter-spacing: 0.04em; }
        .prop-plat-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
        .prop-plat-dot--live { background: var(--prop-good); }
        .prop-plat-dot--developing { background: var(--prop-warn); }
        .prop-plat-dot--future { background: var(--prop-ink-3); }
        @media (max-width: 760px) { .prop-plat { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}
