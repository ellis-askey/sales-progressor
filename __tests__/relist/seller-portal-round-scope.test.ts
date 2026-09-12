/**
 * @jest-environment node
 *
 * Relist round-scoping for the SELLER portal (audit P1-3 + related P2 docs).
 *
 * Scenario: old buyer → progression → fall-through → relist → new buyer.
 * After the relist the transaction still carries the previous buyer's PM
 * milestone rows and shared documents (stamped with the OLD buyerRoundId).
 *
 * Before the fix the vendor's timeline completion query used `{}` (no round
 * filter), so the seller saw the previous buyer's progress, and the vendor's
 * Documents tab showed the previous buyer's shared uploads. These tests prove
 * both vendor reads are now scoped to the ACTIVE buyer round, so the seller
 * only sees the current buyer's information. Historical rows are untouched in
 * the DB — they are simply filtered out of the live seller view.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findMany: jest.fn(), findUnique: jest.fn() },
    milestoneCompletion: { findMany: jest.fn() },
    outboundMessage: { findMany: jest.fn() },
    transactionDocument: { findMany: jest.fn() },
    propertyTransaction: { findUnique: jest.fn() },
  },
}));

import { getPortalTimeline } from "@/lib/services/portal";
import { getPortalDocuments } from "@/lib/services/portal-documents";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
const ACTIVE_ROUND = "round_new_buyer";
const OLD_ROUND = "round_old_buyer";

beforeEach(() => {
  jest.clearAllMocks();
  p.contact.findMany.mockResolvedValue([]); // vendor contact ids (messages)
  p.milestoneCompletion.findMany.mockResolvedValue([]);
  p.outboundMessage.findMany.mockResolvedValue([]);
  p.transactionDocument.findMany.mockResolvedValue([]);
});

describe("seller timeline is scoped to the active buyer round", () => {
  it("vendor completion query scopes to the active round only (not every round)", async () => {
    await getPortalTimeline("tx1", "vendor", "vendorContact", {
      buyerRoundId: null,
      activeBuyerRoundId: ACTIVE_ROUND,
    });

    expect(p.milestoneCompletion.findMany).toHaveBeenCalledTimes(1);
    const where = p.milestoneCompletion.findMany.mock.calls[0][0].where;
    // Scoped: vendor file-level (VM) rows + the ACTIVE round's PM rows.
    expect(where.OR).toEqual([{ buyerRoundId: null }, { buyerRoundId: ACTIVE_ROUND }]);
    // Crucially, the previous buyer's round is NOT included.
    const ids = JSON.stringify(where.OR);
    expect(ids).not.toContain(OLD_ROUND);
  });

  it("purchaser (new buyer) still sees only their own round", async () => {
    await getPortalTimeline("tx1", "purchaser", "newBuyerContact", {
      buyerRoundId: ACTIVE_ROUND,
      activeBuyerRoundId: ACTIVE_ROUND,
    });
    const where = p.milestoneCompletion.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ buyerRoundId: null }, { buyerRoundId: ACTIVE_ROUND }]);
  });
});

describe("seller Documents tab only shows the active round's shared buyer docs", () => {
  it("vendor other-side shared-doc query is scoped to the active round", async () => {
    p.contact.findUnique.mockResolvedValue({
      id: "vendorContact", roleType: "vendor", buyerRoundId: null, propertyTransactionId: "tx1",
    });
    p.propertyTransaction.findUnique.mockResolvedValue({ tenure: "freehold", activeBuyerRoundId: ACTIVE_ROUND });

    await getPortalDocuments("vendor-token");

    expect(p.transactionDocument.findMany).toHaveBeenCalledTimes(1);
    const where = p.transactionDocument.findMany.mock.calls[0][0].where;
    // where.OR = [ { contactId: null }, ownWhere, otherShared ]
    const otherShared = where.OR[2];
    expect(otherShared).toMatchObject({
      contact: { roleType: "purchaser" },
      sharedWithOtherSide: true,
      buyerRoundId: ACTIVE_ROUND,
    });
    expect(JSON.stringify(where.OR)).not.toContain(OLD_ROUND);
  });
});
