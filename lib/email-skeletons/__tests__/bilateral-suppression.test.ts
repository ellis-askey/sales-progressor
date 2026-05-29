/**
 * @jest-environment node
 */

// Tests for the bilateral pair-complete suppression rule.
//
// Per SHAPE-NOTES (docs/active/email-snapshots/SHAPE-NOTES.md): on the
// second confirmation of a bilateral pair, only the side that just acted
// is emailed. The side that acted first is never re-notified.
//
// computeBilateralSuppressedRecipient encodes that rule. Note that
// "direction = inverse" does NOT cleanly map to "second confirmation":
//   - For natural-first-actor codes (VM7/PM14/VM12/PM17/VM15): direction
//     = inverse ↔ second confirmation (counterpart already fired).
//   - For natural-second-actor codes (PM7/VM10/PM15/VM13/PM18): direction
//     = default ↔ second confirmation; direction = inverse ↔ first
//     confirmation (going first out of natural order).
// Suppression applies only on second-confirmation cases.

import {
  computeBilateralSuppressedRecipient,
  BILATERAL_HANDOFF_CODES,
  BILATERAL_PAIR_OF,
  HANDOFF_DEFAULT_ACTOR,
} from "@/lib/email-skeletons/journey-order";

const NATURAL_FIRST_ACTORS = ["VM7", "PM14", "VM12", "PM17", "VM15"] as const;
const NATURAL_SECOND_ACTORS = ["PM7", "VM10", "PM15", "VM13", "PM18"] as const;

describe("computeBilateralSuppressedRecipient", () => {
  describe("returns null when no suppression applies", () => {
    test("non-bilateral code, no direction (e.g. PM1)", () => {
      expect(computeBilateralSuppressedRecipient("PM1", undefined)).toBeNull();
    });

    test("non-bilateral code, even with direction set (defensive)", () => {
      expect(computeBilateralSuppressedRecipient("PM1", "default")).toBeNull();
      expect(computeBilateralSuppressedRecipient("PM1", "inverse")).toBeNull();
    });

    test("undefined direction (non-bilateral send context)", () => {
      expect(computeBilateralSuppressedRecipient("PM14", undefined)).toBeNull();
      expect(computeBilateralSuppressedRecipient("VM7",  undefined)).toBeNull();
    });

    test("natural first-actor + default direction (first confirmation, natural opener)", () => {
      // VM7 default: VM7 fires first, no counterpart yet. Both sides emailed.
      for (const code of NATURAL_FIRST_ACTORS) {
        expect(computeBilateralSuppressedRecipient(code, "default")).toBeNull();
      }
    });

    test("natural second-actor + inverse direction (first confirmation, out of natural order)", () => {
      // PM7 inverse: PM7 fires first (out of natural order), counterpart
      // VM7 not yet complete. Both sides emailed; VM7's acted side hasn't
      // been notified yet, so no suppression.
      for (const code of NATURAL_SECOND_ACTORS) {
        expect(computeBilateralSuppressedRecipient(code, "inverse")).toBeNull();
      }
    });

    test("agent-only readiness/exchange/completion codes never suppress", () => {
      // These pairs are NOT in BILATERAL_PAIR_OF, so the lookup misses
      // and the helper returns null. Per SHAPE-NOTES, agent-confirm pairs
      // fire to both sides with no bilateral suppression.
      const agentOnlyCodes = ["VM18", "PM25", "VM19", "PM26", "VM20", "PM27"];
      for (const code of agentOnlyCodes) {
        expect(computeBilateralSuppressedRecipient(code, "default")).toBeNull();
        expect(computeBilateralSuppressedRecipient(code, "inverse")).toBeNull();
      }
    });
  });

  describe("suppresses the first-actor side on second confirmation", () => {
    // Worked example from SHAPE-NOTES Event 4 (inverse contract pack):
    // PM7 confirmed first (buyer logged receipt), then VM7 fires
    // (seller side confirms issuance). The buyer was emailed at PM7
    // and must not be re-notified at VM7.
    test("VM7 inverse: suppresses purchaser (PM7's acted side)", () => {
      // VM7 is natural first-actor; inverse direction means PM7 fired first.
      expect(computeBilateralSuppressedRecipient("VM7", "inverse")).toBe("purchaser");
    });

    test("PM7 default: suppresses vendor (VM7's acted side)", () => {
      // PM7 is natural second-actor; default direction means VM7 already
      // fired (natural completion). The seller was emailed at VM7.
      expect(computeBilateralSuppressedRecipient("PM7", "default")).toBe("vendor");
    });

    // Worked example from SHAPE-NOTES "the worked example you asked about":
    // VM10 confirmed first (seller's solicitor received enquiries),
    // then PM14 (buyer's side ticked off the raise). The seller was
    // emailed at VM10 and must NOT receive an email at PM14.
    test("PM14 inverse: suppresses vendor (VM10's acted side)", () => {
      // PM14 is natural first-actor; inverse means VM10 fired first.
      expect(computeBilateralSuppressedRecipient("PM14", "inverse")).toBe("vendor");
    });

    test("VM10 default: suppresses purchaser (PM14's acted side)", () => {
      // VM10 is natural second-actor; default means PM14 already fired.
      expect(computeBilateralSuppressedRecipient("VM10", "default")).toBe("purchaser");
    });

    test("VM12 inverse: suppresses purchaser (PM15's acted side)", () => {
      // VM12 is natural first-actor.
      expect(computeBilateralSuppressedRecipient("VM12", "inverse")).toBe("purchaser");
    });

    test("PM15 default: suppresses vendor (VM12's acted side)", () => {
      // PM15 is natural second-actor.
      expect(computeBilateralSuppressedRecipient("PM15", "default")).toBe("vendor");
    });

    test("PM17 inverse: suppresses vendor (VM13's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM17", "inverse")).toBe("vendor");
    });

    test("VM13 default: suppresses purchaser (PM17's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM13", "default")).toBe("purchaser");
    });

    test("VM15 inverse: suppresses purchaser (PM18's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("VM15", "inverse")).toBe("purchaser");
    });

    test("PM18 default: suppresses vendor (VM15's acted side)", () => {
      expect(computeBilateralSuppressedRecipient("PM18", "default")).toBe("vendor");
    });
  });

  describe("symmetry invariants", () => {
    // For each bilateral pair, exactly one (code, direction) combination
    // out of {(natural-first, inverse), (natural-second, default)}
    // suppresses — that's the second-confirmation case for that pair.
    test("each bilateral code has exactly one second-confirmation direction that suppresses", () => {
      for (const code of BILATERAL_HANDOFF_CODES) {
        const defaultResult = computeBilateralSuppressedRecipient(code, "default");
        const inverseResult = computeBilateralSuppressedRecipient(code, "inverse");
        const suppressingDirections = [defaultResult, inverseResult].filter((r) => r !== null);
        expect(suppressingDirections).toHaveLength(1);
      }
    });

    // The side suppressed is always the counterpart code's acted side
    // (V* → vendor; P* → purchaser).
    test("second-confirmation suppression always targets the counterpart's acted side", () => {
      for (const code of BILATERAL_HANDOFF_CODES) {
        const counterpart = BILATERAL_PAIR_OF[code];
        const expected = counterpart.startsWith("V") ? "vendor" : "purchaser";
        // Try both directions; the second-confirmation one suppresses, the
        // other returns null. Combine into a non-null assertion.
        const result =
          computeBilateralSuppressedRecipient(code, "default") ??
          computeBilateralSuppressedRecipient(code, "inverse");
        expect(result).toBe(expected);
      }
    });

    // A code and its counterpart, both in their second-confirmation
    // direction, never suppress the SAME side. (If they did, both events
    // firing would silence one party twice and never the other.)
    test("a code and its counterpart suppress opposite sides on second-confirmation completion", () => {
      for (const code of BILATERAL_HANDOFF_CODES) {
        const counterpart = BILATERAL_PAIR_OF[code];
        const codeSuppresses =
          computeBilateralSuppressedRecipient(code, "default") ??
          computeBilateralSuppressedRecipient(code, "inverse");
        const counterpartSuppresses =
          computeBilateralSuppressedRecipient(counterpart, "default") ??
          computeBilateralSuppressedRecipient(counterpart, "inverse");
        expect(codeSuppresses).not.toBe(counterpartSuppresses);
      }
    });

    test("the suppressing direction matches the natural-first-actor pattern", () => {
      // First-actors suppress on inverse; second-actors suppress on default.
      for (const code of BILATERAL_HANDOFF_CODES) {
        const pairFirstActor = HANDOFF_DEFAULT_ACTOR[code];
        const actedSide = code.startsWith("V") ? "vendor" : "purchaser";
        const isFirstActor = pairFirstActor === actedSide;
        if (isFirstActor) {
          expect(computeBilateralSuppressedRecipient(code, "inverse")).not.toBeNull();
          expect(computeBilateralSuppressedRecipient(code, "default")).toBeNull();
        } else {
          expect(computeBilateralSuppressedRecipient(code, "default")).not.toBeNull();
          expect(computeBilateralSuppressedRecipient(code, "inverse")).toBeNull();
        }
      }
    });
  });
});
