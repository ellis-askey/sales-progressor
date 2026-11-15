/**
 * @jest-environment node
 *
 * Staff messaging server actions (Phase 1). Proves the THREE-part guard
 * (pilot-staff allowlist, pilot-file allowlist, access-scope ownership), correct
 * Buyer/Seller conversation selection, buyer-round isolation (seller conversations
 * never carry a round), idempotent send input, and that non-pilot staff/files
 * never reach the database write path.
 */

jest.mock("@/lib/session", () => ({ requireSession: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findFirst: jest.fn() },
    conversation: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    message: { upsert: jest.fn() },
    messageReceipt: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  sendStaffMessageAction,
  markStaffConversationReadAction,
} from "@/app/actions/messaging";

const rs = requireSession as jest.Mock;
const p = prisma as any;

const ENV = [
  "MESSAGES_PILOT_STAFF_IDS",
  "MESSAGES_PILOT_TRANSACTION_IDS",
  "MESSAGES_CLIENT_ACTIVE_TX_IDS",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.MESSAGES_PILOT_STAFF_IDS = "ellis";
  process.env.MESSAGES_PILOT_TRANSACTION_IDS = "tx_pilot";
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function sessionAs(id: string) {
  rs.mockResolvedValue({
    user: { id, role: "sales_progressor", agencyId: null, email: "ellis@thesalesprogressor.co.uk", name: "Ellis" },
  });
}
function txFound(activeBuyerRoundId: string | null = "round1") {
  p.propertyTransaction.findFirst.mockResolvedValue({ id: "tx_pilot", activeBuyerRoundId });
}
function conversationResolvesToNew(id: string) {
  p.conversation.findFirst.mockResolvedValue(null);
  p.conversation.create.mockResolvedValue({ id });
  p.conversation.update.mockResolvedValue({ id });
  p.messageReceipt.findFirst.mockResolvedValue(null);
  p.messageReceipt.create.mockResolvedValue({ id: "r1" });
}
function upsertReturns(over: Record<string, unknown> = {}) {
  p.message.upsert.mockResolvedValue({
    id: "m1",
    clientMsgId: "c1",
    body: "hello",
    senderKind: "staff",
    createdAt: new Date("2026-11-15T10:00:00Z"),
    senderUser: { name: "Ellis" },
    ...over,
  });
}

describe("sendStaffMessageAction: permissions (fail closed)", () => {
  it("refuses a non-pilot staff user before any DB access", async () => {
    sessionAs("intruder");
    const res = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "buyer", body: "hi", clientMsgId: "c1" });
    expect(res).toEqual({ ok: false, error: "forbidden" });
    expect(p.propertyTransaction.findFirst).not.toHaveBeenCalled();
    expect(p.message.upsert).not.toHaveBeenCalled();
  });

  it("refuses a non-pilot FILE even for pilot staff", async () => {
    sessionAs("ellis");
    const res = await sendStaffMessageAction({ transactionId: "tx_other", side: "buyer", body: "hi", clientMsgId: "c1" });
    expect(res).toEqual({ ok: false, error: "forbidden" });
    expect(p.propertyTransaction.findFirst).not.toHaveBeenCalled();
    expect(p.message.upsert).not.toHaveBeenCalled();
  });

  it("refuses a file outside the viewer's access scope (scopeOwnershipWhere miss)", async () => {
    sessionAs("ellis");
    p.propertyTransaction.findFirst.mockResolvedValue(null);
    const res = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "buyer", body: "hi", clientMsgId: "c1" });
    expect(res).toEqual({ ok: false, error: "forbidden" });
    expect(p.message.upsert).not.toHaveBeenCalled();
  });
});

describe("sendStaffMessageAction: sending + conversation selection", () => {
  it("sends on the BUYER side, scoping the conversation to the active round", async () => {
    sessionAs("ellis");
    txFound("round1");
    conversationResolvesToNew("conv_b");
    upsertReturns();
    const res = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "buyer", body: "  hello  ", clientMsgId: "c1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.message.body).toBe("hello");
      expect(res.message.mine).toBe(true);
      expect(res.message.senderKind).toBe("staff");
      expect(res.message.senderName).toBe("Ellis");
    }
    expect(p.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { transactionId: "tx_pilot", side: "buyer", buyerRoundId: "round1" } }),
    );
    expect(p.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ senderKind: "staff", senderUserId: "ellis", body: "hello", clientMsgId: "c1" }),
        update: {},
      }),
    );
  });

  it("buyer-round isolation: a SELLER-side message never carries a round", async () => {
    sessionAs("ellis");
    txFound("round1");
    conversationResolvesToNew("conv_s");
    upsertReturns({ id: "m2", clientMsgId: "c2", body: "hi" });
    await sendStaffMessageAction({ transactionId: "tx_pilot", side: "seller", body: "hi", clientMsgId: "c2" });
    expect(p.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { transactionId: "tx_pilot", side: "seller", buyerRoundId: null } }),
    );
  });

  it("rejects an empty body without writing", async () => {
    sessionAs("ellis");
    txFound();
    const res = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "buyer", body: "   ", clientMsgId: "c1" });
    expect(res).toEqual({ ok: false, error: "empty" });
    expect(p.message.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-buyer/seller side", async () => {
    sessionAs("ellis");
    txFound();
    const res = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "solicitor", body: "hi", clientMsgId: "c1" });
    expect(res).toEqual({ ok: false, error: "bad_side" });
    expect(p.message.upsert).not.toHaveBeenCalled();
  });
});

describe("sendStaffMessageAction: duplicate prevention (idempotent)", () => {
  it("a retried send with the same clientMsgId upserts on the same key, never inserting a duplicate", async () => {
    sessionAs("ellis");
    txFound("round1");
    conversationResolvesToNew("conv_b");
    upsertReturns({ id: "m1", clientMsgId: "dup1", body: "hi" });

    const first = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "buyer", body: "hi", clientMsgId: "dup1" });
    const second = await sendStaffMessageAction({ transactionId: "tx_pilot", side: "buyer", body: "hi", clientMsgId: "dup1" });

    expect(first.ok && second.ok).toBe(true);
    // Both go through upsert on the SAME compound key with an empty update; the
    // DB @@unique([conversationId, clientMsgId]) guarantees a single row.
    expect(p.message.upsert).toHaveBeenCalledTimes(2);
    for (const call of p.message.upsert.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: { conversationId_clientMsgId: { conversationId: "conv_b", clientMsgId: "dup1" } },
          update: {},
        }),
      );
    }
    if (first.ok && second.ok) expect(first.message.id).toBe(second.message.id);
  });
});

describe("markStaffConversationReadAction: guard", () => {
  it("is a silent no-op for a non-pilot staff user", async () => {
    sessionAs("intruder");
    await markStaffConversationReadAction({ transactionId: "tx_pilot", side: "buyer" });
    expect(p.propertyTransaction.findFirst).not.toHaveBeenCalled();
    expect(p.conversation.findFirst).not.toHaveBeenCalled();
  });
});
