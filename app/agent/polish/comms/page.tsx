"use client";
/* Polish reference for /agent/comms — Stage 2 (revised).
 * Visual target for Stage 4 production swap.
 *
 * Day groups: agent-glass card with agent-acc-hdr + agent-acc / agent-acc-in.
 * Animation (200ms open / 150ms close) comes from the canonical class — no
 * bespoke keyframes or transitions.
 *
 * State toggles:
 *   state  — populated | empty | loading
 *   filter — all milestones | portal only
 *   theme  — 6 production themes via data-theme on .agent-bg
 *   night  — adds data-night to .agent-shell-root via useEffect
 *   rm     — prefers-reduced-motion override
 *
 * Sub-decisions (recorded for inventory §14):
 *   Day label: agent-acc-title default (semibold, primary colour, no uppercase)
 *   Count:     agent-acc-summary plain text "N milestones" — no pill chip
 *   Ghost:     abstract agent-skeleton bars only, filter-neutral
 *   Loading:   mirrors new card structure, agent-skeleton bars throughout
 *
 * Interactive state inventory:
 *   - .comms-filter-pill — hover + focus-visible defined below (deliberate
 *     exception to .agent-segment-pill: lighter chip treatment, token-based)
 *   - .comms-tx-link    — block address link with token-based hover
 *   - .agent-acc-hdr    — canonical class; hover/focus/active from agent-system.css
 */

import { useState, useEffect } from "react";
import { CaretDown, ChartLine } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";

/* ─── Types (mirrored from CommsActivityFeed — Stage 4 keeps in sync) ───── */

type MilestoneRow = {
  id: string;
  completedAtIso: string;
  confirmedByPortal: boolean;
  side: string;
  milestoneName: string;
  completedByName: string | null;
};

type TxGroup = {
  transactionId: string;
  transactionAddress: string;
  milestones: MilestoneRow[];
};

type DayBucket = {
  label: string;
  txGroups: TxGroup[];
  defaultOpen: boolean;
};

/* ─── Relative timestamp (mirrored from CommsActivityFeed) ──────────────── */

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type ThemeName = "sunset" | "coastal" | "heritage" | "slate" | "emerald" | "claret";
const THEME_NAMES: ThemeName[] = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"];

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
  .comms-filter-bar {
    display: flex; gap: 4px;
    background: var(--agent-surface-overlay);
    border-radius: 10px; padding: 3px;
  }
  .comms-filter-pill {
    font-size: 12px; font-weight: 500;
    padding: 6px 12px; border-radius: 7px;
    border: none; cursor: pointer; outline: none;
    transition: background var(--agent-transition-fast),
                color var(--agent-transition-fast),
                box-shadow var(--agent-transition-fast);
    background: transparent;
    color: var(--agent-text-secondary);
  }
  .comms-filter-pill:not(.on):hover {
    background: var(--agent-hover-tint);
    color: var(--agent-text-primary);
  }
  .comms-filter-pill:focus-visible {
    outline: none;
    box-shadow: var(--agent-focus-ring);
  }
  .comms-filter-pill.on {
    background: var(--agent-surface-elevated);
    color: var(--agent-text-primary);
    box-shadow: 0 1px 3px rgba(var(--agent-shadow-rgb), 0.08);
  }
  .comms-filter-pill.on:focus-visible {
    box-shadow: var(--agent-focus-ring);
  }

  /* ── Transaction address link (production-bound — promoted to Stage 4) */
  .comms-tx-link {
    display: block;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.20);
    text-decoration: none;
    transition: background var(--agent-transition-fast);
    outline: none;
  }
  .comms-tx-link:hover {
    background: var(--agent-hover-tint);
  }
  .comms-tx-link:focus-visible {
    box-shadow: inset 0 0 0 1.5px var(--agent-border-focus);
  }

  /* ── Reduced motion ──────────────────────────────────────────────────── */
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  /* agent-acc has a multi-value transition shorthand (150ms, 100ms) that needs
     an explicit named override — the universal * rule above does not win against
     the more-specific .agent-acc.open (0,2,0,0) vs * (0,1,0,0) among !important. */
  [data-rm="1"] .agent-acc,
  [data-rm="1"] .agent-acc.open {
    transition: none !important;
  }
`;

/* ─── Mock data ──────────────────────────────────────────────────────────── */

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

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function CommsPolishPage() {
  const [viewState, setViewState] = useState<ViewState>("populated");
  const [portal, setPortal] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("sunset");
  const [night, setNight] = useState(false);
  const [rm, setRm] = useState(false);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({
    "Today": true,
    "Yesterday": true,
    "Monday, 12 May": false,
  });

  /* Apply / remove data-night on the shell root so real tokens resolve */
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!shell) return;
    if (night) shell.setAttribute("data-night", "");
    else shell.removeAttribute("data-night");
    return () => { shell.removeAttribute("data-night"); };
  }, [night]);

  function toggleDay(label: string) {
    setOpenDays((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  const days = viewState === "populated" ? (portal ? MOCK_PORTAL : MOCK_ALL) : [];

  return (
    <>
      <style>{CSS}</style>

      {/* ── pp-controls (test chrome — outside agent-bg so not theme-scoped) */}
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
          <span className="pp-bar-label">theme</span>
          {THEME_NAMES.map((t) => (
            <button key={t} type="button" className={`pp-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
        <div className="pp-bar">
          <span className="pp-bar-label">opts</span>
          <button type="button" className={`pp-pill${night ? " on" : ""}`} onClick={() => setNight((v) => !v)}>night</button>
          <button type="button" className={`pp-pill${rm ? " on" : ""}`} onClick={() => setRm((v) => !v)}>rm</button>
        </div>
      </div>

      {/* ── Production content — self-contained theme scope (matches transaction-detail pattern) */}
      <div className="agent-bg" data-theme={theme} data-rm={rm ? "1" : undefined}>

      <PageHeader title="Updates" subtitle="What's happened across your files.">
        <div className="comms-filter-bar">
          <button type="button" className={`comms-filter-pill${!portal ? " on" : ""}`} onClick={() => setPortal(false)}>
            All milestones
          </button>
          <button type="button" className={`comms-filter-pill${portal ? " on" : ""}`} onClick={() => setPortal(true)}>
            Client confirmations
          </button>
        </div>
      </PageHeader>

      {/*
        MOCKED: CommsActivityFeed — production import at components/comms/CommsActivityFeed.tsx.
        This inline implementation is the Stage 4 structural contract.
        Stage 4 must rebuild production CommsActivityFeed to match this structure exactly.
        Day group = agent-glass > agent-acc-hdr + agent-acc > agent-acc-in > agent-acc-body.
      */}
      <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">

        {viewState === "loading" && <CommsSkeleton />}

        {viewState === "empty" && (
          <>
            {/* Empty state card */}
            <div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ChartLine
                weight="regular"
                style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }}
              />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                {portal ? "No client confirmations yet" : "No completed steps yet"}
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {portal
                  ? "When clients confirm steps themselves, they'll appear here."
                  : "Confirmed steps appear here as they happen."}
              </p>
            </div>

            {/* Ghost preview — abstract skeleton shapes, filter-neutral */}
            <CommsGhost />
          </>
        )}

        {viewState === "populated" && days.map((bucket) => (
          <DayGroup
            key={bucket.label}
            bucket={bucket}
            open={openDays[bucket.label] ?? bucket.defaultOpen}
            onToggle={() => toggleDay(bucket.label)}
            rm={rm}
          />
        ))}

      </div>

      {/* ── Mobile 375px frame ───────────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid rgba(30,45,74,0.08)",
        marginTop: 8,
        padding: "20px 16px 32px",
      }}>
        <p className="pp-bar-label" style={{ fontWeight: 600, marginBottom: 12 }}>Mobile — 375px</p>
        <div
          className="m-frame"
          style={{
            width: 375,
            maxWidth: "100%",
            border: "1px solid rgba(30,45,74,0.12)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Filter strip */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(30,45,74,0.08)" }}>
            <div className="comms-filter-bar">
              <button type="button" className={`comms-filter-pill${!portal ? " on" : ""}`} onClick={() => setPortal(false)}>
                All milestones
              </button>
              <button type="button" className={`comms-filter-pill${portal ? " on" : ""}`} onClick={() => setPortal(true)}>
                Client confirmations
              </button>
            </div>
          </div>
          {/* Content */}
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {viewState === "loading" && <CommsSkeleton />}
            {viewState === "empty" && <CommsGhost />}
            {viewState === "populated" && days.slice(0, 2).map((bucket) => (
              <DayGroup
                key={`m-${bucket.label}`}
                bucket={bucket}
                open={openDays[bucket.label] ?? bucket.defaultOpen}
                onToggle={() => toggleDay(bucket.label)}
                rm={rm}
              />
            ))}
          </div>
        </div>
      </div>

      </div>{/* ── /agent-bg ──────────────────────────────────────────────── */}
    </>
  );
}

/* ─── Day group card (agent-glass + agent-acc-hdr + agent-acc) ───────────── */

function DayGroup({ bucket, open, onToggle, rm }: {
  bucket: DayBucket;
  open: boolean;
  onToggle: () => void;
  rm?: boolean;
}) {
  const milestoneCount = bucket.txGroups.reduce((n, tx) => n + tx.milestones.length, 0);
  const countLabel = `${milestoneCount} milestone${milestoneCount !== 1 ? "s" : ""}`;

  return (
    <div className="agent-glass" style={{ overflow: "hidden" }}>
      <div
        className="agent-acc-hdr"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      >
        <span className="agent-acc-title">{bucket.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="agent-acc-summary">{countLabel}</span>
          <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>
      </div>

      <div className={`agent-acc${open ? " open" : ""}`} style={rm ? { transition: "none" } : undefined}>
        <div className="agent-acc-in">
          <div className="agent-acc-body">
            {bucket.txGroups.map((tx) => (
              <TxCard key={tx.transactionId} tx={tx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Transaction card ───────────────────────────────────────────────────── */

function TxCard({ tx }: { tx: TxGroup }) {
  return (
    <div className="glass-card overflow-hidden">
      <a
        href={`/agent/transactions/${tx.transactionId}`}
        className="comms-tx-link"
      >
        <p className="text-xs font-semibold text-slate-900/70 truncate">{tx.transactionAddress}</p>
      </a>
      <div className="divide-y divide-white/15">
        {tx.milestones.map((m) => (
          <MilestoneEntry key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

/* ─── Milestone entry row ────────────────────────────────────────────────── */

function MilestoneEntry({ m }: { m: MilestoneRow }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${m.confirmedByPortal ? "bg-violet-100" : "bg-emerald-100"}`}>
        <svg className={`w-3 h-3 ${m.confirmedByPortal ? "text-violet-600" : "text-emerald-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900/80">{m.milestoneName}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.side === "vendor" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-700"}`}>
            {m.side === "vendor" ? "Vendor" : "Purchaser"}
          </span>
          {m.confirmedByPortal && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
              Client confirmed
            </span>
          )}
        </div>
        {!m.confirmedByPortal && m.completedByName && (
          <p className="text-xs text-slate-900/40 mt-0.5">{m.completedByName}</p>
        )}
      </div>
      <span className="text-[11px] text-slate-900/35 flex-shrink-0 mt-0.5">{relativeDate(m.completedAtIso)}</span>
    </div>
  );
}

/* ─── Loading skeleton — mirrors day-group-as-card structure ─────────────── */
/* Stage 4 transplants this to app/agent/comms/loading.tsx (Polish Gate 9).  */

function CommsSkeleton() {
  return (
    <div className="space-y-4">

      {/* Skeleton card 1 — open (Today) */}
      <div className="agent-glass" style={{ overflow: "hidden" }}>
        <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
          <div className="agent-skeleton" style={{ width: 48, height: 11, borderRadius: 4 }} />
          <div className="agent-skeleton" style={{ width: 72, height: 11, borderRadius: 4 }} />
        </div>
        <div className="agent-acc open">
          <div className="agent-acc-in">
            <div className="agent-acc-body">
              {/* Skeleton transaction card */}
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/20">
                  <div className="agent-skeleton" style={{ width: 200, height: 10, borderRadius: 4 }} />
                </div>
                <div className="divide-y divide-white/15">
                  {[180, 220, 150].map((w, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="agent-skeleton mt-0.5 w-5 h-5 flex-shrink-0" style={{ borderRadius: "50%" }} />
                      <div className="flex-1 space-y-2">
                        <div className="agent-skeleton h-3" style={{ maxWidth: w, borderRadius: 4 }} />
                        <div className="agent-skeleton h-2.5" style={{ maxWidth: 72, borderRadius: 4 }} />
                      </div>
                      <div className="agent-skeleton h-2.5 w-10 flex-shrink-0" style={{ borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skeleton card 2 — collapsed (Yesterday) */}
      <div className="agent-glass" style={{ overflow: "hidden" }}>
        <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
          <div className="agent-skeleton" style={{ width: 80, height: 11, borderRadius: 4 }} />
          <div className="agent-skeleton" style={{ width: 60, height: 11, borderRadius: 4 }} />
        </div>
        {/* No content — collapsed state implied by absence of open body */}
      </div>

    </div>
  );
}

/* ─── Empty state ghost — abstract skeleton shapes, filter-neutral ─────────── */

function CommsGhost() {
  return (
    <div style={{ opacity: 0.4, pointerEvents: "none" }}>
      <div className="agent-glass" style={{ overflow: "hidden" }}>
        {/* Header shape */}
        <div className="agent-acc-hdr">
          <div className="agent-skeleton" style={{ width: 56, height: 11, borderRadius: 4 }} />
          <div className="agent-skeleton" style={{ width: 68, height: 11, borderRadius: 4 }} />
        </div>
        {/* Body — always shown open in ghost */}
        <div className="agent-acc open">
          <div className="agent-acc-in">
            <div className="agent-acc-body">
              {/* Placeholder transaction card */}
              <div className="glass-card overflow-hidden">
                {/* Address row */}
                <div className="px-4 py-2.5 border-b border-white/20">
                  <div className="agent-skeleton" style={{ width: 156, height: 10, borderRadius: 4 }} />
                </div>
                {/* Two milestone row shapes */}
                {[148, 190].map((w, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3" style={{
                    borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                  }}>
                    <div className="agent-skeleton mt-0.5 w-5 h-5 flex-shrink-0" style={{ borderRadius: "50%" }} />
                    <div className="flex-1 space-y-2">
                      <div className="agent-skeleton h-3" style={{ maxWidth: w, borderRadius: 4 }} />
                      <div className="agent-skeleton h-2.5" style={{ maxWidth: 52, borderRadius: 4 }} />
                    </div>
                    <div className="agent-skeleton h-2.5 w-8 flex-shrink-0" style={{ borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
