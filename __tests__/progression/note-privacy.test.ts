/**
 * @jest-environment node
 *
 * Note privacy (Phase 6). Proves a progression-business private note
 * (businessOnly) is filtered OUT of the activity feed for an owning-agency
 * viewer (agencyId set) and kept IN for internal / business-member viewers
 * (agencyId null). Also proves the write mapping: businessOnly is never
 * client-visible. Zero-regression: the filter only applies businessOnly:false,
 * which is a no-op for every existing note.
 */
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/services/push", () => ({
  pushToTransaction: jest.fn(async () => {}),
  pushToContact: jest.fn(async () => {}),
  pushToUser: jest.fn(async () => {}),
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findFirst: jest.fn(), update: jest.fn() },
    milestoneCompletion: { findMany: jest.fn(async () => []) },
    outboundMessage: { findMany: jest.fn(async () => []), create: jest.fn(async (a: any) => ({ id: "m1", ...a.data })) },
    portalMessage: { findMany: jest.fn(async () => []) },
  },
}));

import { getActivityTimeline, createCommunicationRecord } from "@/lib/services/comms";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/security/access-scope";

const p = prisma as any;

const txRow = {
  id: "tx1",
  propertyAddress: "1 Test Street, BS1 4PN",
  activeBuyerRoundId: null,
  activeBuyerRound: null,
  agency: { name: "eXp" },
  contacts: [],
  vendorSolicitorContact: null,
  purchaserSolicitorContact: null,
};

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  (console.warn as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  p.propertyTransaction.findFirst.mockResolvedValue(txRow);
});

describe("getActivityTimeline — private-note filter", () => {
  it("hides businessOnly notes from an owning-agency viewer (agencyId set)", async () => {
    await getActivityTimeline("tx1", "ag_donna");
    const where = p.outboundMessage.findMany.mock.calls[0][0].where;
    expect(where.businessOnly).toBe(false);
  });

  it("keeps businessOnly notes for an internal / business-member viewer (agencyId null)", async () => {
    await getActivityTimeline("tx1", null);
    const where = p.outboundMessage.findMany.mock.calls[0][0].where;
    expect(where.businessOnly).toBeUndefined();
  });
});

describe("createCommunicationRecord — businessOnly write mapping", () => {
  const scope: AccessScope = { kind: "business", businessId: "biz_sarah" };
  const base = {
    transactionId: "tx1",
    type: "internal_note" as const,
    contactIds: [],
    content: "private note",
    createdById: "u_sarah",
    scope,
  };

  it("writes businessOnly=true when requested (and not client-visible)", async () => {
    await createCommunicationRecord({ ...base, businessOnly: true });
    const data = p.outboundMessage.create.mock.calls[0][0].data;
    expect(data.businessOnly).toBe(true);
    expect(data.visibleToClient).toBe(false);
  });

  it("never marks a client-visible note as businessOnly", async () => {
    await createCommunicationRecord({ ...base, businessOnly: true, visibleToClient: true });
    const data = p.outboundMessage.create.mock.calls[0][0].data;
    expect(data.businessOnly).toBe(false);
  });

  it("defaults businessOnly=false", async () => {
    await createCommunicationRecord({ ...base });
    const data = p.outboundMessage.create.mock.calls[0][0].data;
    expect(data.businessOnly).toBe(false);
  });
});
