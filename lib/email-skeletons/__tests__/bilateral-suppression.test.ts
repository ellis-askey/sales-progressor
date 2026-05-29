/**
 * @jest-environment node
 */

// Tests for the bilateral pair-complete suppression rule.
//
// Per SHAPE-NOTES (docs/active/email-snapshots/SHAPE-NOTES.md): on the
// second confirmation of a bilateral pair, only the side that just acted
// is emailed. The side that acted first is never re-notified.
//
// computeBilateralSuppressedRecipient encodes that rule as a pure
// derivation from (milestoneCode, direction). The fan-out in
// lib/services/portal.ts:sendRichMilestoneEmails consumes the result.

import {
  computeBilateralSuppressedRecipient,
  BILATERAL_HANDOFF_CODES,
  BILATERAL_PAIR_OF,
} from "@/lib/email-skeletons/journey-order";

describe("computeBilateralSuppressedRecipient", () => {
  describe("returns null when no suppression applies", () => {
    test("non-bilateral code, no direction (e.g. PM1)", () => {
      expect(computeBilateralSuppressedRecipient("PM1", undefined)).toBeNull();
    });

    test("non-bilateral code, even with direction set (defensive)", () => {
      expect(computeBilateralSuppressedRecipient("PM1", "default")).toBeNull();
      expect(computeBilateralSuppressedRecipient("PM1", "inverse")).toBeNull();
    });

    test("bilateral code, default direction (natural opener, no suppression yet)", () => {
      expect(computeBilateralSuppressedRecipient("PM14", "default")).toBeNull();
      expect(computeBilateralSuppressedRecipient("VM10", "default")).toBeNull();
      expect(computeBilateralSuppressedRecipient("VM7",  "default")).toBeNull();
      expect(computeBilateralSuppressedRecipient("PM7",  "default")).toBeNull();
    });

    test("bilateral code with undefined direction (non-bilateral send context)", () => {
      expect(computeBilateralSuppressedRecipient("PM14", undefined)).toBeNull();
    });

    test("agent-only readiness/exchange/completion codes are never suppressed", () => {
      // These pairs are NOT in BILATERAL_PAIR_OF, so the lookup misses
      // and the helper returns null. Per SHAPE-NOTES, agent-confirm pairs
      // fire to both sides with no bilateral suppression.
      const agentOnlyCodes = ["VM18", "PM25", "VM19", "PM26", "VM20", "PM27"];
      for (const code of agentOnlyCodes) {
        expect(computeBilateralSuppressedRecipient(code, "inverse")).toBeNull();
      }
    });
  });

  describe("suppresses the first-actor side on inverse-direction completion", () => {
    // Worked example from SHAPE-NOTES Event 4 (inverse contract pack):
    // PM7 confirmed first (buyer logged receipt), then VM7 fires
    // (seller side confirms issuance). The buyer was emailed at PM7
    // and must not be re-notified at VM7.
    test("VM7 inverse: suppresses purchaser (PM7's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM7", "inverse")).toBe("purchaser");
    });

    // Event 2 (natural completion of contract pack pair): VM7 fired
    // first; PM7 fires second in default direction — no suppression
    // because default doesn't mean "counterpart complete." But Event 2
    // PM7 is just default. The fan-out separately handles "PM7 natural-
    // order complete → suppress vendor" via this same rule when PM7
    // fires in INVERSE direction.
    test("PM7 inverse: suppresses vendor (VM7's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM7", "inverse")).toBe("vendor");
    });

    // Worked example from SHAPE-NOTES "the worked example you asked about":
    // VM10 confirmed first (seller's solicitor received enquiries),
    // then PM14 (buyer's side ticked off the raise). The seller was
    // emailed at VM10 and must NOT receive an email at PM14.
    test("PM14 inverse: suppresses vendor (VM10's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM14", "inverse")).toBe("vendor");
    });

    test("VM10 inverse: suppresses purchaser (PM14's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM10", "inverse")).toBe("purchaser");
    });

    test("VM12 inverse: suppresses purchaser (PM15's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM12", "inverse")).toBe("purchaser");
    });

    test("PM15 inverse: suppresses vendor (VM12's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM15", "inverse")).toBe("vendor");
    });

    test("PM17 inverse: suppresses vendor (VM13's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM17", "inverse")).toBe("vendor");
    });

    test("VM13 inverse: suppresses purchaser (PM17's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM13", "inverse")).toBe("purchaser");
    });

    test("VM15 inverse: suppresses purchaser (PM18's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM15", "inverse")).toBe("purchaser");
    });

    test("PM18 inverse: suppresses vendor (VM15's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM18", "inverse")).toBe("vendor");
    });
  });

  describe("symmetry invariant", () => {
    // For every bilateral pair (X, Y) where X is in BILATERAL_HANDOFF_CODES:
    // - X inverse suppresses Y's acted side.
    // - The suppressed side equals the V*/P* prefix of Y, mapped to
    //   "vendor"/"purchaser".
    test("every BILATERAL_HANDOFF_CODES entry suppresses its counterpart's acted side under inverse", () => {
      for (const code of BILATERAL_HANDOFF_CODES) {
        const counterpart = BILATERAL_PAIR_OF[code];
        expect(counterpart).toBeDefined();

        const expectedSide = counterpart.startsWith("V") ? "vendor" : "purchaser";
        expect(computeBilateralSuppressedRecipient(code, "inverse")).toBe(expectedSide);
      }
    });

    // Sanity check: a code and its counterpart never suppress the SAME
    // side under inverse. (If they did, both events firing would silence
    // one party twice and the other never.)
    test("a code and its counterpart suppress opposite sides under inverse", () => {
      for (const code of BILATERAL_HANDOFF_CODES) {
        const counterpart = BILATERAL_PAIR_OF[code];
        const codeSuppresses = computeBilateralSuppressedRecipient(code, "inverse");
        const counterpartSuppresses = computeBilateralSuppressedRecipient(counterpart, "inverse");
        expect(codeSuppresses).not.toBe(counterpartSuppresses);
      }
    });
  });
});
