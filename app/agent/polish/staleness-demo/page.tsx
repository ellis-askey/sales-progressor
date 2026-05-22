"use client";

// Polish-pass demo for the "Awaiting N days" staleness badge — visibility
// pass #5. Static, no DB, no actions wired up. Confirm / N/R / Undo
// buttons will misbehave if clicked (mock IDs); purpose is to eyeball
// the BADGE rendering against the existing slowness badge for visual
// distinctness, not to interact.
//
// Unlike the slowness badge (Change 3, gated behind MEDIANS_READY), the
// staleness badge is safe to show today: its threshold is the
// configured ReminderRule.graceDays, NOT a learned median. The badge
// says "this has been sitting longer than your chase rule allows" —
// a fact derived from config Ellis already set, not an inference from
// data we don't have.

import { MilestoneRow } from "@/components/milestones/MilestoneRow";
import type { SlownessSignal, StalenessSignal } from "@/lib/services/milestone-staleness";
import type { MilestoneDefinition, MilestoneCompletion } from "@prisma/client";

// ─── Mock factories ──────────────────────────────────────────────────────────

type EnrichedDef = Omit<MilestoneDefinition, "weight"> & {
  weight: number;
  completion: MilestoneCompletion | null;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
};

function mockDef(overrides: Partial<EnrichedDef> & { code: string; name: string }): EnrichedDef {
  return {
    id: `def_${overrides.code}`,
    side: "purchaser" as const,
    orderIndex: 0,
    blocksExchange: true,
    eventDateRequired: false,
    predecessorCode: null,
    canBeMarkedNr: "never" as const,
    summaryTemplate: "",
    weight: 1,
    createdAt: new Date("2026-01-01"),
    completion: null,
    isComplete: false,
    isNotRequired: false,
    isAvailable: true,
    ...overrides,
  };
}

function mockCompletion(state: "complete" | "available" | "locked", completedAt?: Date): MilestoneCompletion {
  return {
    id: "comp_mock",
    transactionId: "txn_mock",
    milestoneDefinitionId: "def_mock",
    state,
    completedAt: completedAt ?? null,
    eventDate: null,
    expectedDate: null,
    notRequiredReason: null,
    completedById: null,
    confirmedByPortal: false,
    summaryText: null,
    reconciledAtExchange: false,
    reconciledAtClaim: false,
    outOfOrderCompletion: false,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
  };
}

// ─── Scenarios ────────────────────────────────────────────────────────────────
//
// Each row gets BOTH props in scope so we can show how the two badges
// coexist where they would on a real file. Most scenarios only fire one
// or the other — there's also a "both" scenario showing the order.

type Scenario = {
  label: string;
  def: EnrichedDef;
  staleness: StalenessSignal | null;
  slowness: SlownessSignal | null; // shown null in most cases to isolate staleness
};

const SCENARIOS: Scenario[] = [
  {
    label: "1. Stale (badge fires): PM8 graceDays 5, on day 9 → Awaiting 9 days",
    def: mockDef({
      code: "PM8",
      name: "Buyer's solicitor has ordered searches",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    staleness: { stale: true, daysAwaiting: 9, graceDays: 5 },
    slowness: null,
  },
  {
    label: "2. Mildly stale: PM5 graceDays 3, on day 4 → Awaiting 4 days (just over threshold)",
    def: mockDef({
      code: "PM5",
      name: "Buyer has submitted their mortgage application",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    staleness: { stale: true, daysAwaiting: 4, graceDays: 3 },
    slowness: null,
  },
  {
    label: "3. Severely stale: PM13 graceDays 7, on day 28 → Awaiting 28 days",
    def: mockDef({
      code: "PM13",
      name: "Buyer's solicitor has received the search results",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    staleness: { stale: true, daysAwaiting: 28, graceDays: 7 },
    slowness: null,
  },
  {
    label: "4. Under threshold (no badge): PM8 graceDays 5, on day 5 — exactly at grace, not over",
    def: mockDef({
      code: "PM8",
      name: "Buyer's solicitor has ordered searches",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    staleness: null,
    slowness: null,
  },
  {
    label: "5. No active reminder rule for this code (no badge — graceDays unknown)",
    def: mockDef({
      code: "PM21",
      name: "Buyer has received the final report from their solicitor",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    staleness: null,
    slowness: null,
  },
  {
    label: "6. Both badges firing — staleness sits after slowness, distinct colour (orange vs amber)",
    def: mockDef({
      code: "PM7",
      name: "Buyer's solicitor received draft contract pack",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    staleness: { stale: true, daysAwaiting: 22, graceDays: 5 },
    slowness: { slow: true, daysOver: 9, median: 13, daysAvailable: 22 },
  },
  {
    label: "7. Blocked (no badges — row not available): PM13, prereq incomplete",
    def: mockDef({
      code: "PM13",
      name: "Buyer's solicitor has received the search results",
      isAvailable: false,
      completion: mockCompletion("locked"),
    }),
    staleness: null,
    slowness: null,
  },
  {
    label: "8. Completed (no badges — row is done)",
    def: mockDef({
      code: "PM7",
      name: "Buyer's solicitor received draft contract pack",
      isComplete: true,
      isAvailable: false,
      completion: mockCompletion("complete", new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)),
    }),
    staleness: null,
    slowness: null,
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StalenessDemoPage() {
  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 880, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Staleness badge &mdash; visibility pass #5
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          Eight scenarios. Every state combination the &ldquo;Awaiting N days&rdquo; badge appears in (or is suppressed in). Hover the badge for the grace-days + day-count tooltip. The Confirm / N/R / Undo controls on these rows are not wired to a real transaction &mdash; clicking them will error harmlessly.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          Helpers: <code>lib/services/milestone-staleness.ts</code> (<code>computeStaleness</code>) &middot; <code>lib/services/reminders.ts</code> (<code>getGraceDaysByMilestoneCode</code>). Threshold: <code>ReminderRule.graceDays</code> from active rules with <code>targetMilestoneCode === code</code>, smallest wins. Safe to show without MEDIANS_READY (config-driven, not data-inferred).
        </p>
      </header>

      <div
        style={{
          border: "0.5px solid var(--agent-border-default)",
          borderRadius: 12,
          background: "var(--agent-surface-elevated)",
          overflow: "hidden",
        }}
      >
        {SCENARIOS.map((s, i) => (
          <div key={i} style={{ borderBottom: i < SCENARIOS.length - 1 ? "0.5px solid var(--agent-border-default)" : "none" }}>
            <p
              style={{
                margin: 0,
                padding: "9px 16px",
                background: "rgba(30, 45, 74, 0.04)",
                borderBottom: "0.5px solid var(--agent-border-default)",
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(30, 45, 74, 0.6)",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {s.label}
            </p>
            <MilestoneRow
              def={s.def}
              transactionId="txn_mock"
              slownessSignal={s.slowness}
              stalenessSignal={s.staleness}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 16, background: "rgba(30, 45, 74, 0.04)", borderRadius: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>How it differs from the slowness badge:</strong>
        </p>
        <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <li><strong>Threshold source:</strong> <code>ReminderRule.graceDays</code> (seeded config), not <code>MILESTONE_DURATION_MEDIANS</code> (currently hand-set range midpoints).</li>
          <li><strong>What it claims:</strong> &ldquo;This has been sitting longer than the chase rule allows.&rdquo; A fact about your config and the file&apos;s actual clock. No comparison to typical behaviour, no implied authority over what other files do.</li>
          <li><strong>Visibility gate:</strong> none. Slowness is hidden behind <code>MEDIANS_READY</code> until learned data accumulates. Staleness fires today on real files.</li>
          <li><strong>Colour:</strong> orange (<code>orange-50 / orange-200 / orange-700</code>) to stay visually distinct from the amber slowness badge. When both fire on the same row, slowness shows first (left), staleness second (right). See scenario 6.</li>
        </ul>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Where the threshold comes from:</strong> on each transaction-detail page load, <code>getGraceDaysByMilestoneCode()</code> queries active <code>ReminderRule</code> rows with a non-null <code>targetMilestoneCode</code>, returning a <code>code &rarr; smallest graceDays</code> map. Smallest wins because that&apos;s the first chase that fires &mdash; the earliest moment the milestone is officially overdue. The map flows to <code>MilestonePanel</code> as a prop, which calls <code>computeStaleness(code, completionLookup, graceDays)</code> per row.
        </p>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>What stays the same as slowness:</strong> the <code>becameAvailableAt</code> proxy &mdash; latest <code>completedAt</code> across the milestone&apos;s <code>DIRECT_PREREQUISITES</code>. Same v1 limitation: top-of-tree milestones (VM1, VM2, PM1, PM2) get no badge because they have no prereqs to anchor from.
        </p>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Surfaces:</strong> agent file (<code>/agent/transactions/[id]</code>) and internal-dashboard file (<code>/transactions/[id]</code>). Buyer/seller portal explicitly excluded &mdash; the portal&apos;s milestone view (<code>components/portal/</code>) doesn&apos;t render <code>MilestonePanel</code>.
        </p>
      </div>
    </div>
  );
}
