"use client";
/* Polish reference for /agent/comms — Stage 2.
 * Visual target for Stage 4 production swap.
 *
 * State toggles (pp-controls):
 *   state  — populated | empty | loading
 *   filter — all milestones | portal only  (mirrors production filter strip)
 *   rm     — prefers-reduced-motion override
 *
 * Night mode: no toggle in this test page. Filter strip uses
 * --agent-surface-overlay and --agent-surface-elevated which resolve
 * correctly under [data-night] on the shell root. Verify at Stage 4.
 *
 * agent-acc (day bucket animation): Stage 4 scope. Polish Gate item 8.
 * CommsActivityFeed imported as real component — hard conditional render
 * unchanged. Stage 4 adds agent-acc to CommsActivityFeed.tsx.
 *
 * Ghost preview: two variants — emerald (all-milestones) / violet (portal).
 * Stage 2 decision per inventory §13. Replaces the single coral ghost in
 * production which does not reflect actual entry appearance.
 */

import { useState } from "react";
import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CommsActivityFeed,
  type DayBucket,
} from "@/components/comms/CommsActivityFeed";

/* ─── Page-level CSS ─────────────────────────────────────────────────────── */
const CSS = `
  /* ── pp-controls (test-page chrome only — not production) ─────────── */
  .pp-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0; }
  .pp-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .pp-pill { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; }
  .pp-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }

  /* ── Comms filter bar (production-bound — promoted to Stage 4) ─────── */
  /* Tokens used:                                                           */
  /*   container bg: --agent-surface-overlay (new, extends surface-*)      */
  /*   active pill:  --agent-surface-elevated (existing)                   */
  /*   active shadow: rgba(--agent-shadow-rgb, 0.08) (existing token)      */
  .comms-filter-bar {
    display: flex; gap: 4px;
    background: var(--agent-surface-overlay);
    border-radius: 10px; padding: 3px;
  }
  .comms-filter-pill {
    font-size: 12px; font-weight: 500;
    padding: 6px 12px; border-radius: 7px;
    border: none; cursor: pointer; text-decoration: none;
    transition: background var(--agent-transition-fast), color var(--agent-transition-fast);
    background: transparent;
    color: var(--agent-text-secondary);
  }
  .comms-filter-pill.on {
    background: var(--agent-surface-elevated);
    color: var(--agent-text-primary);
    box-shadow: 0 1px 3px rgba(var(--agent-shadow-rgb), 0.08);
  }

  /* ── Loading skeleton ────────────────────────────────────────────────── */
  .comms-skel {
    background: var(--agent-glass-bg-subtle);
    border-radius: 6px;
    animation: agent-skeleton-pulse 1.5s ease-in-out infinite;
  }

  /* ── Reduced motion ──────────────────────────────────────────────────── */
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
`;

/* ─── Mock data ──────────────────────────────────────────────────────────── */

/* All milestones — mix of agent-confirmed and portal-confirmed entries */
const MOCK_ALL: DayBucket[] = [
  {
    label: "Today",
    defaultOpen: true,
    txGroups: [
      {
        transactionId: "tx1",
        transactionAddress: "14 Maple Close, Birmingham, B15 2QR",
        milestones: [
          {
            id: "m1",
            completedAtIso: new Date(Date.now() - 25 * 60_000).toISOString(),
            confirmedByPortal: true,
            side: "purchaser",
            milestoneName: "Mortgage offer received",
            completedByName: null,
          },
          {
            id: "m2",
            completedAtIso: new Date(Date.now() - 102 * 60_000).toISOString(),
            confirmedByPortal: false,
            side: "vendor",
            milestoneName: "Draft contract approved by vendor's solicitor",
            completedByName: "Sarah Jones",
          },
        ],
      },
      {
        transactionId: "tx2",
        transactionAddress: "7 Orchard Road, Bath, BA1 2NE",
        milestones: [
          {
            id: "m3",
            completedAtIso: new Date(Date.now() - 180 * 60_000).toISOString(),
            confirmedByPortal: false,
            side: "purchaser",
            milestoneName: "Survey booked",
            completedByName: "James Reid",
          },
        ],
      },
    ],
  },
  {
    label: "Yesterday",
    defaultOpen: true,
    txGroups: [
      {
        transactionId: "tx3",
        transactionAddress: "22 Clifton Park, Bristol, BS8 3HJ",
        milestones: [
          {
            id: "m4",
            completedAtIso: new Date(Date.now() - 28 * 3_600_000).toISOString(),
            confirmedByPortal: false,
            side: "vendor",
            milestoneName: "Legal pack sent to purchaser's solicitor",
            completedByName: "Sarah Jones",
          },
          {
            id: "m5",
            completedAtIso: new Date(Date.now() - 31 * 3_600_000).toISOString(),
            confirmedByPortal: true,
            side: "purchaser",
            milestoneName: "Search results obtained",
            completedByName: null,
          },
        ],
      },
    ],
  },
  {
    label: "Monday, 12 May",
    defaultOpen: false,
    txGroups: [
      {
        transactionId: "tx4",
        transactionAddress: "33 Park Street, Bristol, BS1 5NE",
        milestones: [
          {
            id: "m6",
            completedAtIso: new Date(Date.now() - 5 * 24 * 3_600_000).toISOString(),
            confirmedByPortal: false,
            side: "vendor",
            milestoneName: "Memorandum of sale issued",
            completedByName: "James Reid",
          },
        ],
      },
    ],
  },
];

/* Portal only — confirmedByPortal: true entries only */
const MOCK_PORTAL: DayBucket[] = [
  {
    label: "Today",
    defaultOpen: true,
    txGroups: [
      {
        transactionId: "tx1",
        transactionAddress: "14 Maple Close, Birmingham, B15 2QR",
        milestones: [
          {
            id: "m1",
            completedAtIso: new Date(Date.now() - 25 * 60_000).toISOString(),
            confirmedByPortal: true,
            side: "purchaser",
            milestoneName: "Mortgage offer received",
            completedByName: null,
          },
        ],
      },
    ],
  },
  {
    label: "Yesterday",
    defaultOpen: true,
    txGroups: [
      {
        transactionId: "tx3",
        transactionAddress: "22 Clifton Park, Bristol, BS8 3HJ",
        milestones: [
          {
            id: "m5",
            completedAtIso: new Date(Date.now() - 31 * 3_600_000).toISOString(),
            confirmedByPortal: true,
            side: "purchaser",
            milestoneName: "Search results obtained",
            completedByName: null,
          },
        ],
      },
    ],
  },
];

type ViewState = "populated" | "empty" | "loading";

export default function CommsPolishPage() {
  const [viewState, setViewState] = useState<ViewState>("populated");
  const [portal, setPortal] = useState(false);
  const [rm, setRm] = useState(false);

  const days = viewState === "populated" ? (portal ? MOCK_PORTAL : MOCK_ALL) : [];

  return (
    <div data-rm={rm ? "1" : undefined}>
      <style>{CSS}</style>

      {/* ── pp-controls ─────────────────────────────────────────────────── */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(30,45,74,0.08)",
        background: "rgba(30,45,74,0.03)",
        display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
      }}>
        <span className="pp-bar-label" style={{ fontWeight: 600 }}>comms — Stage 2</span>
        <div className="pp-bar">
          <span className="pp-bar-label">state</span>
          {(["populated", "empty", "loading"] as ViewState[]).map((s) => (
            <button key={s} type="button" className={`pp-pill${viewState === s ? " on" : ""}`} onClick={() => setViewState(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">filter</span>
          <button type="button" className={`pp-pill${!portal ? " on" : ""}`} onClick={() => setPortal(false)}>all milestones</button>
          <button type="button" className={`pp-pill${portal ? " on" : ""}`} onClick={() => setPortal(true)}>portal only</button>
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">opts</span>
          <button type="button" className={`pp-pill${rm ? " on" : ""}`} onClick={() => setRm((v) => !v)}>rm</button>
        </div>
      </div>

      {/* ── Production page ──────────────────────────────────────────────── */}
      <PageHeader title="Updates" subtitle="Milestone activity across all your files.">
        <div className="comms-filter-bar">
          <button type="button" className={`comms-filter-pill${!portal ? " on" : ""}`} onClick={() => setPortal(false)}>
            All milestones
          </button>
          <button type="button" className={`comms-filter-pill${portal ? " on" : ""}`} onClick={() => setPortal(true)}>
            Client confirmations
          </button>
        </div>
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-6">

        {/* Loading skeleton */}
        {viewState === "loading" && <CommsSkeleton />}

        {/* Empty state */}
        {viewState === "empty" && (
          <>
            <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ChartLine
                weight="regular"
                style={{
                  width: 32, height: 32,
                  color: "var(--agent-text-muted)",
                  margin: "0 auto 16px", display: "block", opacity: 0.45,
                }}
              />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {portal ? "No client confirmations yet" : "No milestone activity yet"}
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {portal
                  ? "Client confirmations will appear here when clients confirm their milestones via the portal."
                  : "Completed milestones across your files will appear here."}
              </p>
            </div>

            {/* Ghost preview — two variants per Stage 2 §13 decision */}
            <div style={{ opacity: 0.3, pointerEvents: "none" }}>
              <p style={{
                margin: "0 0 10px", fontSize: 11, fontWeight: 600,
                color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                Today
              </p>
              <div className="agent-glass-strong" style={{ borderRadius: 16, overflow: "hidden" }}>
                {/* Address row */}
                <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                    14 Maple Close, Birmingham
                  </p>
                </div>

                {portal ? (
                  /* Portal ghost: violet icon + "Client confirmed" badge — matches actual portal entry layout */
                  [
                    { name: "Mortgage offer received", side: "Purchaser" },
                    { name: "Search results obtained", side: "Purchaser" },
                  ].map(({ name, side }, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3" style={{
                      borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                    }}>
                      <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-violet-100">
                        <svg className="w-2.5 h-2.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900/80">{name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{side}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">Client confirmed</span>
                        </div>
                        <p className="text-xs text-slate-900/40 mt-0.5">Client</p>
                      </div>
                    </div>
                  ))
                ) : (
                  /* All-milestones ghost: emerald icon — matches actual agent-confirmed entry layout */
                  [
                    { name: "Mortgage offer received", time: "9:41 am" },
                    { name: "Search results obtained", time: "8:15 am" },
                  ].map(({ name, time }, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3" style={{
                      borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                    }}>
                      <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-100">
                        <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900/80">{name}</p>
                      </div>
                      <span className="text-[11px] text-slate-900/35 flex-shrink-0 mt-0.5">{time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Populated feed */}
        {viewState === "populated" && days.length > 0 && (
          <CommsActivityFeed days={days} />
        )}

      </div>
    </div>
  );
}

/* ─── Loading skeleton ────────────────────────────────────────────────────── */
/* Stage 4 transplants this to app/agent/comms/loading.tsx (Polish Gate 9).   */
function CommsSkeleton() {
  return (
    <div className="space-y-6">

      {/* Bucket 1 — Today */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="comms-skel h-2.5 flex-1" style={{ maxWidth: 48 }} />
          <div className="comms-skel h-5 w-7 rounded-full" />
          <div className="comms-skel w-3.5 h-3.5" />
        </div>
        <div className="space-y-3">
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/20">
              <div className="comms-skel h-2.5" style={{ maxWidth: 200 }} />
            </div>
            <div className="divide-y divide-white/15">
              {[180, 220, 150].map((w, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="comms-skel mt-0.5 w-5 h-5 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="comms-skel h-3" style={{ maxWidth: w }} />
                    <div className="comms-skel h-2.5" style={{ maxWidth: 72 }} />
                  </div>
                  <div className="comms-skel h-2.5 w-10 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bucket 2 — Yesterday */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="comms-skel h-2.5 flex-1" style={{ maxWidth: 80 }} />
          <div className="comms-skel h-5 w-6 rounded-full" />
          <div className="comms-skel w-3.5 h-3.5" />
        </div>
        <div className="space-y-3">
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/20">
              <div className="comms-skel h-2.5" style={{ maxWidth: 240 }} />
            </div>
            <div className="divide-y divide-white/15">
              {[190, 130].map((w, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="comms-skel mt-0.5 w-5 h-5 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="comms-skel h-3" style={{ maxWidth: w }} />
                    <div className="comms-skel h-2.5" style={{ maxWidth: 60 }} />
                  </div>
                  <div className="comms-skel h-2.5 w-10 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
