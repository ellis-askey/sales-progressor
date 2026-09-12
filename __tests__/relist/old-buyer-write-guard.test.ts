/**
 * @jest-environment node
 *
 * Old-buyer write protection (audit P1-4).
 *
 * Relist does NOT rotate a superseded buyer's portal token, so their token still
 * resolves. The server actions behind the portal must refuse to let that
 * fallen-through buyer mutate the CURRENT buyer's live round. assertLivePortalRound
 * is the shared guard applied to all six write paths; these tests cover the guard
 * directly plus wiring on two representative actions (one that returns {ok:false},
 * one that throws).
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findUnique: jest.fn(), findFirst: jest.fn() },
    propertyTransaction: { findUnique: jest.fn(), update: jest.fn() },
    portalMessage: { create: jest.fn() },
  },
}));

import { assertLivePortalRound, PORTAL_DEAD_ROUND_ERROR } from "@/lib/portal/round-guard";
import { portalSaveCostsAction } from "@/app/actions/portal";
import { sendClientPortalMessage } from "@/lib/services/portal-messages";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

function supersededPurchaser() {
  p.contact.findUnique.mockResolvedValue({
    roleType: "purchaser", buyerRoundId: "round_OLD", propertyTransactionId: "t1",
    id: "c_old", name: "Old Buyer", transaction: { id: "t1", activeBuyerRoundId: "round_NEW" },
  });
  p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: "round_NEW" });
}

beforeEach(() => jest.clearAllMocks());

describe("assertLivePortalRound (shared dead-round guard)", () => {
  it("throws for a superseded purchaser (round no longer active)", async () => {
    supersededPurchaser();
    await expect(assertLivePortalRound("tok")).rejects.toThrow(PORTAL_DEAD_ROUND_ERROR);
  });

  it("allows the live purchaser (round matches active)", async () => {
    p.contact.findUnique.mockResolvedValue({ roleType: "purchaser", buyerRoundId: "round_NEW", propertyTransactionId: "t1" });
    p.propertyTransaction.findUnique.mockResolvedValue({ activeBuyerRoundId: "round_NEW" });
    await expect(assertLivePortalRound("tok")).resolves.toBeUndefined();
  });

  it("is a no-op for a vendor (file-level, no round)", async () => {
    p.contact.findUnique.mockResolvedValue({ roleType: "vendor", buyerRoundId: null, propertyTransactionId: "t1" });
    await expect(assertLivePortalRound("tok")).resolves.toBeUndefined();
    expect(p.propertyTransaction.findUnique).not.toHaveBeenCalled();
  });

  it("is a no-op for an unknown token", async () => {
    p.contact.findUnique.mockResolvedValue(null);
    await expect(assertLivePortalRound("tok")).resolves.toBeUndefined();
  });
});

describe("portal write actions reject a superseded buyer", () => {
  it("portalSaveCostsAction returns {ok:false} and does NOT overwrite the live buyer's figures", async () => {
    supersededPurchaser();
    const res = await portalSaveCostsAction({ token: "tok", depositGBP: 50000, mortgageGBP: 200000 });
    expect(res).toEqual({ ok: false });
    expect(p.propertyTransaction.update).not.toHaveBeenCalled();
  });

  it("sendClientPortalMessage throws and does NOT create a message on the live round", async () => {
    supersededPurchaser();
    await expect(sendClientPortalMessage("tok", "hello from the old buyer")).rejects.toThrow(PORTAL_DEAD_ROUND_ERROR);
    expect(p.portalMessage.create).not.toHaveBeenCalled();
  });
});
