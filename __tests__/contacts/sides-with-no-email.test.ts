/**
 * @jest-environment node
 */

// The per-SIDE missing-email rule behind the automated-emails coverage + needs
// view. A side is a gap only when it has active-round contacts and NONE of them
// is emailable — a couple with one address between them is reachable (the chase
// lands on the partner who has one), so it must NOT be flagged.

import { sidesWithNoEmail } from "@/lib/contacts/round-scope";

const c = (roleType: string, email: string | null, buyerRoundId: string | null = null) => ({ roleType, email, buyerRoundId });

it("a couple with one email between them is reachable (not a gap)", () => {
  // The exact prod false-positive: Jennifer HAS, David has NONE, same side.
  expect(sidesWithNoEmail([c("vendor", "jen@x.com"), c("vendor", null)], null)).toEqual([]);
});

it("flags a side only when NO contact on it has an email", () => {
  expect(sidesWithNoEmail([c("vendor", null), c("vendor", "")], null)).toEqual(["vendor"]);
});

it("flags each unreachable side independently", () => {
  expect(sidesWithNoEmail([c("vendor", null), c("purchaser", "buy@x.com")], null)).toEqual(["vendor"]);
  expect(sidesWithNoEmail([c("vendor", "sell@x.com"), c("purchaser", null)], null)).toEqual(["purchaser"]);
});

it("a side with no contacts at all is not a gap (nothing to chase)", () => {
  expect(sidesWithNoEmail([c("vendor", "sell@x.com")], null)).toEqual([]);
});

it("ignores an archived previous buyer — only the active round counts", () => {
  // Old buyer (round-1, no email) is off the active round; new buyer HAS email.
  const contacts = [c("purchaser", null, "round-1"), c("purchaser", "new@x.com", "round-2")];
  expect(sidesWithNoEmail(contacts, "round-2")).toEqual([]);
});

it("treats whitespace-only emails as no email", () => {
  expect(sidesWithNoEmail([c("purchaser", "   ")], null)).toEqual(["purchaser"]);
});
