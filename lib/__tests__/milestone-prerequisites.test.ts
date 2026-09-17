/**
 * @jest-environment node
 *
 * Locks the contract-pack pair decision (2026-09-17) into the prerequisite
 * map: the buyer's "draft contract pack received" (PM7) must never be blocked
 * by money on account — a buyer who truly received the pack records the truth,
 * and the cross-side reflection completes the seller's "issued" (VM7) with it.
 * The funds gate lives on "searches ordered" (PM8) instead. If either edge is
 * "tidied" back, this fails noisily.
 */

import { DIRECT_PREREQUISITES } from "../milestone-prerequisites";

describe("contract-pack pair ordering", () => {
  it("pack received (PM7) has no prerequisites", () => {
    expect(DIRECT_PREREQUISITES.PM7).toBeUndefined();
  });

  it("searches ordered (PM8) requires BOTH pack received and money on account", () => {
    expect(DIRECT_PREREQUISITES.PM8).toEqual(expect.arrayContaining(["PM7", "PM4"]));
    expect(DIRECT_PREREQUISITES.PM8).toHaveLength(2);
  });

  it("pack issued (VM7) still follows the seller-side chain", () => {
    expect(DIRECT_PREREQUISITES.VM7).toEqual(["VM6"]);
  });
});
