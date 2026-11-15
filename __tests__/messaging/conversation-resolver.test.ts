/**
 * @jest-environment node
 *
 * getOrCreateConversation (Phase 0). Prisma is mocked, so these cover the
 * resolver's LOGIC: existing-conversation reuse, create-when-missing, the
 * buyer-round key (buyer → active round; seller → always null), buyer-round
 * isolation, and the concurrent-creation race (P2002 → re-read the winner). The
 * database-level uniqueness guarantee itself was verified live on staging.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { conversation: { findFirst: jest.fn(), create: jest.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getOrCreateConversation,
  buyerRoundIdForSide,
} from "@/lib/services/messaging/conversation";

const p = prisma as any;
beforeEach(() => jest.clearAllMocks());

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });
}

describe("buyerRoundIdForSide", () => {
  it("buyer side uses the active round; seller side is always null", () => {
    expect(buyerRoundIdForSide("buyer", "rNEW")).toBe("rNEW");
    expect(buyerRoundIdForSide("buyer", null)).toBeNull();
    expect(buyerRoundIdForSide("seller", "rNEW")).toBeNull();
    expect(buyerRoundIdForSide("seller", null)).toBeNull();
  });
});

describe("getOrCreateConversation", () => {
  it("reuses an existing conversation and does NOT create", async () => {
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    const res = await getOrCreateConversation({
      transactionId: "t1",
      side: "buyer",
      activeBuyerRoundId: "rNEW",
    });
    expect(res).toEqual({ id: "c1" });
    expect(p.conversation.create).not.toHaveBeenCalled();
    expect(p.conversation.findFirst).toHaveBeenCalledWith({
      where: { transactionId: "t1", side: "buyer", buyerRoundId: "rNEW" },
      select: { id: true },
    });
  });

  it("creates when none exists, scoping a BUYER conversation to the active round", async () => {
    p.conversation.findFirst.mockResolvedValue(null);
    p.conversation.create.mockResolvedValue({ id: "c2" });
    const res = await getOrCreateConversation({
      transactionId: "t1",
      side: "buyer",
      activeBuyerRoundId: "rNEW",
    });
    expect(res).toEqual({ id: "c2" });
    expect(p.conversation.create).toHaveBeenCalledWith({
      data: { transactionId: "t1", side: "buyer", buyerRoundId: "rNEW" },
      select: { id: true },
    });
  });

  it("a SELLER conversation never carries a round, even if one is passed", async () => {
    p.conversation.findFirst.mockResolvedValue(null);
    p.conversation.create.mockResolvedValue({ id: "c3" });
    await getOrCreateConversation({
      transactionId: "t1",
      side: "seller",
      activeBuyerRoundId: "rNEW",
    });
    expect(p.conversation.findFirst).toHaveBeenCalledWith({
      where: { transactionId: "t1", side: "seller", buyerRoundId: null },
      select: { id: true },
    });
    expect(p.conversation.create).toHaveBeenCalledWith({
      data: { transactionId: "t1", side: "seller", buyerRoundId: null },
      select: { id: true },
    });
  });

  it("buyer-round isolation: different active rounds resolve to different round keys", async () => {
    p.conversation.findFirst.mockResolvedValue(null);
    p.conversation.create
      .mockResolvedValueOnce({ id: "cOLD" })
      .mockResolvedValueOnce({ id: "cNEW" });
    await getOrCreateConversation({ transactionId: "t1", side: "buyer", activeBuyerRoundId: "rOLD" });
    await getOrCreateConversation({ transactionId: "t1", side: "buyer", activeBuyerRoundId: "rNEW" });
    expect(p.conversation.create).toHaveBeenNthCalledWith(1, {
      data: { transactionId: "t1", side: "buyer", buyerRoundId: "rOLD" },
      select: { id: true },
    });
    expect(p.conversation.create).toHaveBeenNthCalledWith(2, {
      data: { transactionId: "t1", side: "buyer", buyerRoundId: "rNEW" },
      select: { id: true },
    });
  });

  it("concurrent creation: loses the create race (P2002) and re-reads the winner", async () => {
    p.conversation.findFirst
      .mockResolvedValueOnce(null) // first lookup: nothing yet
      .mockResolvedValueOnce({ id: "cWinner" }); // after the race: the winner exists
    p.conversation.create.mockRejectedValue(p2002());
    const res = await getOrCreateConversation({
      transactionId: "t1",
      side: "buyer",
      activeBuyerRoundId: "rNEW",
    });
    expect(res).toEqual({ id: "cWinner" });
    expect(p.conversation.findFirst).toHaveBeenCalledTimes(2);
  });

  it("re-throws a P2002 if the winner still cannot be found (defensive)", async () => {
    p.conversation.findFirst.mockResolvedValue(null); // both reads miss
    p.conversation.create.mockRejectedValue(p2002());
    await expect(
      getOrCreateConversation({ transactionId: "t1", side: "buyer", activeBuyerRoundId: "rNEW" }),
    ).rejects.toBeTruthy();
  });

  it("re-throws a non-P2002 error without swallowing it (no second read)", async () => {
    p.conversation.findFirst.mockResolvedValueOnce(null);
    p.conversation.create.mockRejectedValue(new Error("db down"));
    await expect(
      getOrCreateConversation({ transactionId: "t1", side: "buyer", activeBuyerRoundId: "rNEW" }),
    ).rejects.toThrow("db down");
    expect(p.conversation.findFirst).toHaveBeenCalledTimes(1);
  });
});
