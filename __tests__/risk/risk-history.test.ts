/**
 * PR5 — Risk history (Data Optionality capture-now).
 *
 * Two load-bearing pieces:
 *  1. deriveRiskInput parity — it replicates the inline risk-input derivation in
 *     lib/services/transactions.ts (listTransactions) so the nightly history
 *     matches what the product renders. These fixtures lock the formula
 *     (on_track/at_risk/off_track bands, overdue/escalated counts, hold-frozen
 *     daysStuck, daysSinceLastActivity). If the render-path formula changes,
 *     update both and these assertions will flag the drift.
 *  2. riskChanged — the change-only gate: first eval (baseline), level change,
 *     and factor-set change all write; an unchanged level + factor set does not.
 */

import { deriveRiskInput, type RiskInputTx } from "@/lib/services/risk-input";
import { riskChanged } from "@/lib/services/risk-history";

const NOW = new Date("2026-09-12T12:00:00Z");
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

function baseTx(overrides: Partial<RiskInputTx> = {}): RiskInputTx {
  return {
    status: "active",
    createdAt: daysAgo(84), // 12 weeks → expectedPercent 100
    lastActivityAt: null,
    chaseTasks: [],
    completedMilestoneDates: [],
    completedCount: 0,
    holdPeriods: [],
    activeRoundCreatedAt: null,
    ...overrides,
  };
}

describe("deriveRiskInput parity", () => {
  it("off_track + counts + stuck + stale, 12 weeks in with 1/50 done", () => {
    const input = deriveRiskInput(
      baseTx({
        completedCount: 1,
        completedMilestoneDates: [daysAgo(30)],
        lastActivityAt: daysAgo(25),
        chaseTasks: [
          { dueDate: daysAgo(3), priority: "escalated" },
          { dueDate: daysAgo(1), priority: "normal" },
          { dueDate: new Date(NOW.getTime() + 5 * DAY), priority: "normal" }, // future → not overdue
        ],
      }),
      50,
      NOW,
    );
    expect(input).toEqual({
      onTrack: "off_track", // actual 2% vs expected 100% → diff -98
      escalatedTaskCount: 1,
      overdueTaskCount: 2,
      daysSinceLastActivity: 25,
      daysStuckOnMilestone: 30,
    });
  });

  it("on_hold freezes daysStuckOnMilestone and forces onTrack=on_hold", () => {
    const input = deriveRiskInput(
      baseTx({
        status: "on_hold",
        completedCount: 5,
        completedMilestoneDates: [daysAgo(40)],
        lastActivityAt: daysAgo(3),
      }),
      50,
      NOW,
    );
    expect(input.onTrack).toBe("on_hold");
    expect(input.daysStuckOnMilestone).toBeNull();
    expect(input.daysSinceLastActivity).toBe(3);
  });

  it("unknown when nothing completed yet", () => {
    const input = deriveRiskInput(baseTx({ completedCount: 0 }), 50, NOW);
    expect(input.onTrack).toBe("unknown");
  });

  it("clamps daysStuck forward to the active round's createdAt (relist is progress)", () => {
    const input = deriveRiskInput(
      baseTx({
        completedCount: 2,
        completedMilestoneDates: [daysAgo(50)], // older than the relist
        activeRoundCreatedAt: daysAgo(10),
      }),
      50,
      NOW,
    );
    expect(input.daysStuckOnMilestone).toBe(10); // clamped to the round start, not 50
  });
});

describe("riskChanged", () => {
  const factorsLow = [{ label: "Single overdue task", impact: "low" as const }];

  it("writes a baseline row when there is no prior row", () => {
    expect(riskChanged(null, "low", [])).toBe(true);
  });

  it("does not write when level and factor set are unchanged", () => {
    expect(riskChanged({ toLevel: "low", factors: factorsLow }, "low", factorsLow)).toBe(false);
  });

  it("writes when the level changes", () => {
    expect(riskChanged({ toLevel: "low", factors: factorsLow }, "medium", factorsLow)).toBe(true);
  });

  it("writes when the triggered-factor set changes at the same level", () => {
    const next = [{ label: "No recent activity", impact: "medium" as const }];
    expect(riskChanged({ toLevel: "medium", factors: factorsLow }, "medium", next)).toBe(true);
  });

  it("is order-independent on the factor set", () => {
    const a = [
      { label: "A", impact: "low" as const },
      { label: "B", impact: "low" as const },
    ];
    const b = [
      { label: "B", impact: "low" as const },
      { label: "A", impact: "low" as const },
    ];
    expect(riskChanged({ toLevel: "medium", factors: a }, "medium", b)).toBe(false);
  });
});
