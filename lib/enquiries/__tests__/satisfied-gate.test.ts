/**
 * @jest-environment node
 */
// Tests for the PM20 "enquiries satisfied" chase gate (critique #63).

import {
  enquirySatisfiedChaseAllowed,
  enquirySatisfiedDeferUntil,
  type EnquirySatisfiedGate,
} from "@/lib/enquiries/satisfied-gate";

const DAY = 86_400_000;
const NOW = new Date("2026-07-06T10:00:00Z"); // a Monday, no nearby UK bank holidays

// Default = an ENGAGED, ready-to-chase file (>=1 movement, ball with the buyer,
// raised 40d ago, replies landed 2 weeks ago).
function gate(over: Partial<EnquirySatisfiedGate>): EnquirySatisfiedGate {
  return {
    currentlyWith: "buyer_solicitor",
    openedAt: new Date(NOW.getTime() - 40 * DAY),
    flipToBuyerAt: new Date(NOW.getTime() - 14 * DAY),
    movementCount: 1,
    ...over,
  };
}

describe("enquirySatisfiedChaseAllowed", () => {
  test("no tracker → allowed (fall back to default; don't silently hold)", () => {
    expect(enquirySatisfiedChaseAllowed(null, NOW)).toBe(true);
  });

  describe("hands-off (0 movements)", () => {
    test("under 4 weeks since raised → not yet", () => {
      const g = gate({ movementCount: 0, openedAt: new Date(NOW.getTime() - 20 * DAY) });
      expect(enquirySatisfiedChaseAllowed(g, NOW)).toBe(false);
    });
    test("4+ weeks since raised → fires regardless of court", () => {
      const g = gate({ movementCount: 0, currentlyWith: "seller_solicitor", flipToBuyerAt: null, openedAt: new Date(NOW.getTime() - 29 * DAY) });
      expect(enquirySatisfiedChaseAllowed(g, NOW)).toBe(true);
    });
  });

  describe("engaged (>=1 movement)", () => {
    test("ball in the seller's court → never", () => {
      expect(enquirySatisfiedChaseAllowed(gate({ currentlyWith: "seller_solicitor" }), NOW)).toBe(false);
    });
    test("within 3 weeks of raised → not yet", () => {
      expect(enquirySatisfiedChaseAllowed(gate({ openedAt: new Date(NOW.getTime() - 10 * DAY) }), NOW)).toBe(false);
    });
    test("ball with buyer but no recorded flip → not yet", () => {
      expect(enquirySatisfiedChaseAllowed(gate({ flipToBuyerAt: null }), NOW)).toBe(false);
    });
    test("fewer than 5 working days since replies landed → not yet", () => {
      expect(enquirySatisfiedChaseAllowed(gate({ flipToBuyerAt: new Date(NOW.getTime() - 1 * DAY) }), NOW)).toBe(false);
    });
    test("ball with buyer, 40d since raised, replies landed 2 weeks ago → allowed", () => {
      expect(enquirySatisfiedChaseAllowed(gate({}), NOW)).toBe(true);
    });
  });
});

describe("enquirySatisfiedDeferUntil", () => {
  test("no tracker → now (nothing to defer)", () => {
    expect(enquirySatisfiedDeferUntil(null, NOW).getTime()).toBe(NOW.getTime());
  });

  test("hands-off → parks exactly at 4 weeks after raised", () => {
    const openedAt = new Date(NOW.getTime() - 5 * DAY);
    const d = enquirySatisfiedDeferUntil(gate({ movementCount: 0, openedAt }), NOW);
    expect(d.getTime()).toBe(openedAt.getTime() + 28 * DAY);
  });

  test("engaged, ball with seller → parks far out (waits for the flip)", () => {
    const d = enquirySatisfiedDeferUntil(gate({ currentlyWith: "seller_solicitor" }), NOW);
    expect(d.getTime()).toBeGreaterThan(NOW.getTime() + 300 * DAY);
  });

  test("engaged, ball with buyer, replies just landed → defers to the future", () => {
    const d = enquirySatisfiedDeferUntil(gate({ flipToBuyerAt: new Date(NOW.getTime() - 1 * DAY) }), NOW);
    expect(d.getTime()).toBeGreaterThan(NOW.getTime());
  });

  test("engaged, ball with buyer, raised recently → at least the 3-week floor", () => {
    const openedAt = new Date(NOW.getTime() - 5 * DAY);
    const d = enquirySatisfiedDeferUntil(gate({ openedAt, flipToBuyerAt: new Date(NOW.getTime() - 1 * DAY) }), NOW);
    expect(d.getTime()).toBeGreaterThanOrEqual(openedAt.getTime() + 21 * DAY);
  });
});
