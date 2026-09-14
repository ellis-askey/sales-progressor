// Phase 1 (agent-facing WhatsApp) — groups-only routing contract.
// Mocks Prisma to assert what ingest DOES and DOESN'T capture.
// See docs/active/whatsapp-agent-facing/SPEC.md §"Phase 1".

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outboundMessage: { findFirst: jest.fn(), create: jest.fn() },
    whatsAppPendingMessage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    whatsAppIgnoredChat: { findUnique: jest.fn() },
    whatsAppGroupMapping: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    propertyTransaction: { findMany: jest.fn(), findUnique: jest.fn() },
    contact: { findMany: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { ingestWhatsAppMessages, type BridgeMessage } from "@/lib/integrations/whatsapp/ingest";

const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;

const msg = (over: Partial<BridgeMessage>): BridgeMessage => ({
  waMessageId: "m1",
  waChatId: "c1@g.us",
  isGroup: true,
  groupName: null,
  fromMe: false,
  senderPhone: null,
  senderName: "Someone",
  body: "hi",
  timestamp: 1_700_000_000_000,
  media: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults: clean slate — not a duplicate, not ignored, not mapped, no file match.
  db.outboundMessage.findFirst.mockResolvedValue(null);
  db.outboundMessage.create.mockResolvedValue({});
  db.whatsAppPendingMessage.findUnique.mockResolvedValue(null);
  db.whatsAppPendingMessage.findMany.mockResolvedValue([]);
  db.whatsAppPendingMessage.create.mockResolvedValue({});
  db.whatsAppIgnoredChat.findUnique.mockResolvedValue(null);
  db.whatsAppGroupMapping.findUnique.mockResolvedValue(null);
  db.whatsAppGroupMapping.create.mockResolvedValue({});
  db.propertyTransaction.findMany.mockResolvedValue([]);
  db.propertyTransaction.findUnique.mockResolvedValue({
    agencyId: "a1",
    activeBuyerRoundId: null,
    assignedUserId: null,
    agentUserId: null,
  });
  db.contact.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
});

describe("groups-only ingest routing", () => {
  it("silently ignores a direct 1-to-1 chat (nothing stored, nothing queued)", async () => {
    const [r] = await ingestWhatsAppMessages([msg({ isGroup: false, waChatId: "dm@s.whatsapp.net" })]);
    expect(r.status).toBe("ignored");
    expect(r.reason).toBe("not_group");
    expect(db.outboundMessage.create).not.toHaveBeenCalled();
    expect(db.whatsAppPendingMessage.create).not.toHaveBeenCalled();
  });

  it("silently ignores a group not named 'Sale of / Purchase of' (no queue entry, no DB lookup)", async () => {
    const [r] = await ingestWhatsAppMessages([msg({ groupName: "Family" })]);
    expect(r.status).toBe("ignored");
    expect(r.reason).toBe("not_property");
    expect(db.whatsAppPendingMessage.create).not.toHaveBeenCalled();
    expect(db.propertyTransaction.findMany).not.toHaveBeenCalled();
  });

  it("queues a correctly-named property group that doesn't resolve to a file yet", async () => {
    db.propertyTransaction.findMany.mockResolvedValue([]);
    const [r] = await ingestWhatsAppMessages([msg({ groupName: "Sale of 5 Nowhere Lane" })]);
    expect(r.status).toBe("pending");
    expect(db.whatsAppPendingMessage.create).toHaveBeenCalledTimes(1);
  });

  it("captures a property group that matches one file, and records the mapping", async () => {
    db.propertyTransaction.findMany.mockResolvedValue([
      { id: "t1", status: "active", propertyAddress: "1 Test Street, Town, AB1 2CD" },
    ]);
    const [r] = await ingestWhatsAppMessages([msg({ groupName: "Sale of 1 Test Street" })]);
    expect(r.status).toBe("logged");
    expect(r.transactionId).toBe("t1");
    expect(db.whatsAppGroupMapping.create).toHaveBeenCalledTimes(1);
    expect(db.outboundMessage.create).toHaveBeenCalledTimes(1);
  });

  it("still honours an explicit prior mapping, even for a DM (deliberate assignment)", async () => {
    db.whatsAppGroupMapping.findUnique.mockResolvedValue({ transactionId: "t9", side: "SELLER" });
    const [r] = await ingestWhatsAppMessages([msg({ isGroup: false, waChatId: "dm@s.whatsapp.net" })]);
    expect(r.status).toBe("logged");
    expect(r.transactionId).toBe("t9");
    expect(db.outboundMessage.create).toHaveBeenCalledTimes(1);
  });
});
