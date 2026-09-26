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

function gate(over: Partial<EnquirySatisfiedGate>): EnquirySatisfiedGate {
  return {
    currentlyWith: "buyer_solicitor",
    openedAt: new Date(NOW.getTime() - 40 * DAY), // raised well over 3 weeks ago
    flipToBuyerAt: new Date(NOW.getTime() - 14 * DAY), // replies landed 2 weeks ago
    ...over,
  };
}

describe("enquirySatisfiedChaseAllowed", () => {
  test("no tracker → not allowed (can't confirm the ball is with the buyer)", () => {
    expect(enquirySatisfiedChaseAllowed(null, NOW)).toBe(false);
  });

  test("ball in the seller's court → never allowed", () => {
    expect(enquirySatisfiedChaseAllowed(gate({ currentlyWith: "seller_solicitor" }), NOW)).toBe(false);
  });

  test("within 3 weeks of being raised → not allowed", () => {
    expect(enquirySatisfiedChaseAllowed(gate({ openedAt: new Date(NOW.getTime() - 10 * DAY) }), NOW)).toBe(false);
  });

  test("ball with buyer but no recorded flip → not allowed", () => {
    expect(enquirySatisfiedChaseAllowed(gate({ flipToBuyerAt: null }), NOW)).toBe(false);
  });

  test("fewer than 5 working days since replies landed → not allowed", () => {
    expect(enquirySatisfiedChaseAllowed(gate({ flipToBuyerAt: new Date(NOW.getTime() - 1 * DAY) }), NOW)).toBe(false);
  });

  test("ball with buyer, raised 40d ago, replies landed 2 weeks ago → allowed", () => {
    expect(enquirySatisfiedChaseAllowed(gate({}), NOW)).toBe(true);
  });
});

describe("enquirySatisfiedDeferUntil", () => {
  test("ball with seller → parks in the future (never before the 3-week floor)", () => {
    const d = enquirySatisfiedDeferUntil(gate({ currentlyWith: "seller_solicitor" }), NOW);
    expect(d.getTime()).toBeGreaterThan(NOW.getTime());
  });

  test("no tracker → parks in the future", () => {
    expect(enquirySatisfiedDeferUntil(null, NOW).getTime()).toBeGreaterThan(NOW.getTime());
  });

  test("ball with buyer, replies just landed → defers to ~5 working days after the flip", () => {
    const flip = new Date(NOW.getTime() - 1 * DAY);
    const d = enquirySatisfiedDeferUntil(gate({ flipToBuyerAt: flip, openedAt: new Date(NOW.getTime() - 40 * DAY) }), NOW);
    // Must be in the future (replies landed only yesterday) and past the raised floor.
    expect(d.getTime()).toBeGreaterThan(NOW.getTime());
  });

  test("ball with buyer, raised recently → defers at least to the 3-week floor", () => {
    const openedAt = new Date(NOW.getTime() - 5 * DAY); // only 5 days ago
    const d = enquirySatisfiedDeferUntil(gate({ openedAt, flipToBuyerAt: new Date(NOW.getTime() - 1 * DAY) }), NOW);
    expect(d.getTime()).toBeGreaterThanOrEqual(openedAt.getTime() + 21 * DAY);
  });
});
