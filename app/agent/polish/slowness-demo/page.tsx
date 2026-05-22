"use client";

// Polish-pass demo for the "X days slower than typical" badge shipped in
// commit 07c21ff (visibility pass #3). Static — no DB, no actions wired up.
// The Confirm / N/R / Undo buttons will misbehave if clicked (mock IDs);
// purpose of this page is to eyeball the BADGE rendering, not interact.

import { MilestoneRow } from "@/components/milestones/MilestoneRow";
import type { SlownessSignal } from "@/lib/services/milestone-staleness";
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

// Six scenarios — covers every state combination the badge can appear in
// or be suppressed in.
const SCENARIOS: { label: string; def: EnrichedDef; signal: SlownessSignal | null }[] = [
  {
    label: "1. Slow (badge fires): PM7 typical 13d, on day 22 → 9 days slower",
    def: mockDef({
      code: "PM7",
      name: "Buyer's solicitor received draft contract pack",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    signal: { slow: true, daysOver: 9, median: 13, daysAvailable: 22 },
  },
  {
    label: "2. Slow (badge fires) + Exchange gate: PM25 typical 2d, on day 8 → 6 days slower",
    def: mockDef({
      code: "PM25",
      name: "Buyer's solicitor has confirmed readiness to exchange",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    signal: { slow: true, daysOver: 6, median: 2, daysAvailable: 8 },
  },
  {
    label: "3. Available but on-pace (no badge): PM7 typical 13d, on day 5",
    def: mockDef({
      code: "PM7",
      name: "Buyer's solicitor received draft contract pack",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    signal: null,
  },
  {
    label: "4. Top-of-tree (no badge possible — null proxy): PM1, no prereqs",
    def: mockDef({
      code: "PM1",
      name: "Buyer has instructed their solicitor",
      isAvailable: true,
      completion: mockCompletion("available"),
    }),
    signal: null,
  },
  {
    label: "5. Blocked (no badge — row not available): PM13, prereq incomplete",
    def: mockDef({
      code: "PM13",
      name: "Buyer's solicitor received search results",
      isAvailable: false,
      completion: mockCompletion("locked"),
    }),
    signal: null,
  },
  {
    label: "6. Completed (no badge — row is done)",
    def: mockDef({
      code: "PM7",
      name: "Buyer's solicitor received draft contract pack",
      isComplete: true,
      isAvailable: false,
      completion: mockCompletion("complete", new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)),
    }),
    signal: null,
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SlownessDemoPage() {
  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 880, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Slowness badge — visibility pass #3
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          Six scenarios. Every state combination the &ldquo;X days slower than typical&rdquo; badge appears in (or is suppressed in). Hover the badge to see the median + day-count tooltip. The Confirm / N/R / Undo controls on these rows are not wired to a real transaction — clicking them will error harmlessly.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          Live commit: <code>07c21ff</code> · helper: <code>lib/services/milestone-staleness.ts</code> · threshold: 1.5× <code>MILESTONE_DURATION_MEDIANS</code>.
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
              slownessSignal={s.signal}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 16, background: "rgba(30, 45, 74, 0.04)", borderRadius: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>What you&apos;re looking at:</strong> Same component (<code>MilestoneRow</code>) that renders on the live agent file detail page. The only thing different from production: the <code>slownessSignal</code> prop is hard-coded per scenario rather than computed from real completion data. The badge itself is the same DOM, same classes (amber-50 / amber-200 inline tailwind to match the existing &ldquo;Exchange gate&rdquo; badge in scenario 2).
        </p>
      </div>
    </div>
  );
}
