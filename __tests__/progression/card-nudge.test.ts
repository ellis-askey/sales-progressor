/**
 * @jest-environment node
 *
 * Item 9 — the add-a-card escalation state machine. The stage climbs prompt (day 0-2)
 * → warn (day 3-6) → blocked (day 7+), counted from the oldest owed-but-unpaid sale,
 * and is "none" whenever collection is dark, a card is on file, or nothing's owed.
 */
jest.mock("@/lib/progression/flags", () => ({ progressionBillingCollectEnabled: jest.fn(() => true) }));
jest.mock("@/lib/progression/business-stripe", () => ({ businessBillingActive: jest.fn(async () => false) }));
jest.mock("@/lib/prisma", () => ({
  prisma: { propertyTransaction: { findMany: jest.fn(), count: jest.fn() } },
}));

import { getBusinessCardNudge, shouldHoldAgentIntake } from "@/lib/progression/card-nudge";
import { progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { businessBillingActive } from "@/lib/progression/business-stripe";
import { prisma } from "@/lib/prisma";

const p = prisma as unknown as { propertyTransaction: { findMany: jest.Mock; count: jest.Mock } };
const NOW = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

beforeEach(() => {
  jest.clearAllMocks();
  (progressionBillingCollectEnabled as jest.Mock).mockReturnValue(true);
  (businessBillingActive as jest.Mock).mockResolvedValue(false);
  p.propertyTransaction.findMany.mockResolvedValue([]);
  p.propertyTransaction.count.mockResolvedValue(0);
});

it("is 'none' when collection is dark", async () => {
  (progressionBillingCollectEnabled as jest.Mock).mockReturnValue(false);
  expect((await getBusinessCardNudge("b1", NOW)).stage).toBe("none");
});

it("is 'none' when a card is on file", async () => {
  (businessBillingActive as jest.Mock).mockResolvedValue(true);
  expect((await getBusinessCardNudge("b1", NOW)).stage).toBe("none");
});

it("is 'none' when nothing is owed and nothing is held", async () => {
  const n = await getBusinessCardNudge("b1", NOW);
  expect(n.stage).toBe("none");
  expect(n.needsCard).toBe(false);
});

it("is 'prompt' on day 0 and does not hold", async () => {
  p.propertyTransaction.findMany.mockResolvedValue([{ createdAt: daysAgo(0) }]);
  const n = await getBusinessCardNudge("b1", NOW);
  expect(n.stage).toBe("prompt");
  expect(n.owedCount).toBe(1);
  expect(await shouldHoldAgentIntake("b1", NOW)).toBe(false);
});

it("is 'warn' from day 3", async () => {
  p.propertyTransaction.findMany.mockResolvedValue([{ createdAt: daysAgo(3) }, { createdAt: daysAgo(1) }]);
  expect((await getBusinessCardNudge("b1", NOW)).stage).toBe("warn");
});

it("is 'blocked' from day 7 and holds new intake", async () => {
  p.propertyTransaction.findMany.mockResolvedValue([{ createdAt: daysAgo(7) }]);
  const n = await getBusinessCardNudge("b1", NOW);
  expect(n.stage).toBe("blocked");
  expect(n.deadline).toEqual(new Date(daysAgo(7).getTime() + 7 * 86_400_000));
  expect(await shouldHoldAgentIntake("b1", NOW)).toBe(true);
});

it("surfaces the held (waiting) count", async () => {
  p.propertyTransaction.findMany.mockResolvedValue([{ createdAt: daysAgo(8) }]);
  p.propertyTransaction.count.mockResolvedValue(3);
  const n = await getBusinessCardNudge("b1", NOW);
  expect(n.waitingCount).toBe(3);
  expect(n.stage).toBe("blocked");
});
