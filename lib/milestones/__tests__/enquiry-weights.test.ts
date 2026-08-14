// Enquiries rework guards (Stage 1.3).
//
// Two invariants that must hold after the milestone collapse:
//   1. Structure — the retired enquiry sub-steps are gone from the prerequisite
//      graph, and the two survivors point where they should. Reads the REAL
//      exported map, so a regression in lib/milestone-prerequisites.ts fails here.
//   2. Weights — each side's canonical weights (mirroring docs/MILESTONES_WEIGHTS_v1.md)
//      still sum to 100.00, with the enquiries cluster concentrated onto the survivors.

import { DIRECT_PREREQUISITES, RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";

describe("enquiries rework: prerequisite structure", () => {
  it("PM20 (satisfied) depends directly on PM14 (raised), not the old chain", () => {
    expect(DIRECT_PREREQUISITES.PM20).toEqual(["PM14"]);
  });

  it("VM21 (seller reflection) depends on VM10 (received)", () => {
    expect(DIRECT_PREREQUISITES.VM21).toEqual(["VM10"]);
  });

  it("no retired code is a prerequisite key", () => {
    for (const code of RETIRED_ENQUIRY_CODES) {
      expect(DIRECT_PREREQUISITES[code]).toBeUndefined();
    }
  });

  it("no active milestone lists a retired code as its prerequisite", () => {
    for (const [code, prereqs] of Object.entries(DIRECT_PREREQUISITES)) {
      for (const p of prereqs) {
        expect(RETIRED_ENQUIRY_CODES.has(p)).toBe(false); // offending: `${code}` -> `${p}`
      }
    }
  });
});

describe("enquiries rework: weight sums (mirror of MILESTONES_WEIGHTS_v1.md)", () => {
  // Canonical per-side weights. Keep in lockstep with the weights doc and the seed.
  const VENDOR: Record<string, number> = {
    VM1: 6, VM2: 3, VM3: 4, VM4: 3, VM5: 4, VM6: 8, VM7: 8, VM8: 3, VM9: 3,
    VM10: 8, VM11: 0, VM12: 0, VM13: 0, VM14: 0, VM15: 0, VM21: 16,
    VM16: 4, VM17: 8, VM18: 8, VM19: 9, VM20: 5,
  };
  const PURCHASER: Record<string, number> = {
    PM1: 5, PM2: 3, PM3: 2, PM4: 6, PM5: 4, PM6: 2, PM7: 3, PM8: 3, PM9: 4,
    PM10: 3, PM11: 6, PM12: 2, PM13: 3, PM14: 6, PM15: 0, PM16: 0, PM17: 0,
    PM18: 0, PM19: 0, PM20: 14, PM21: 3, PM22: 3, PM23: 6, PM24: 3, PM25: 6,
    PM26: 8, PM27: 5,
  };
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

  it("vendor side sums to 100", () => {
    expect(sum(VENDOR)).toBe(100);
  });

  it("purchaser side sums to 100", () => {
    expect(sum(PURCHASER)).toBe(100);
  });

  it("the enquiries weight is concentrated on the survivors", () => {
    expect(VENDOR.VM10).toBe(8);
    expect(VENDOR.VM21).toBe(16);
    expect(PURCHASER.PM14).toBe(6);
    expect(PURCHASER.PM20).toBe(14);
    for (const c of RETIRED_ENQUIRY_CODES) {
      expect({ ...VENDOR, ...PURCHASER }[c]).toBe(0);
    }
  });
});
