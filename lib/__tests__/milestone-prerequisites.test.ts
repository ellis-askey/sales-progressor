/**
 * @jest-environment node
 *
 * Locks two founder decisions into the prerequisite map:
 *
 * Contract-pack pair (2026-09-17): the buyer's "draft contract pack received"
 * (PM7) must never be blocked by money on account — a buyer who truly received
 * the pack records the truth, and the cross-side reflection completes the
 * seller's "issued" (VM7) with it.
 *
 * Searches unlock (2026-10-20): "searches ordered" (PM8) needs ONLY money on
 * account (PM4) — a proactive solicitor buys the title themselves and orders
 * searches as soon as they're in funds, before the pack arrives. Chasing stays
 * anchored on PM7 via the explicit rule anchors; this edge governs what CAN be
 * confirmed. If either edge is "tidied" back, this fails noisily.
 */

import { DIRECT_PREREQUISITES } from "../milestone-prerequisites";

describe("contract-pack pair ordering", () => {
  it("pack received (PM7) has no prerequisites", () => {
    expect(DIRECT_PREREQUISITES.PM7).toBeUndefined();
  });

  it("searches ordered (PM8) requires ONLY money on account", () => {
    expect(DIRECT_PREREQUISITES.PM8).toEqual(["PM4"]);
  });

  it("pack issued (VM7) still follows the seller-side chain", () => {
    expect(DIRECT_PREREQUISITES.VM7).toEqual(["VM6"]);
  });
});
