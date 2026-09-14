// Phase 4 — WhatsApp promises routing.
// The internal number keeps internal self-assigned to-dos; an agency's own
// connection produces agency-visible to-dos only when the agency opted in.
// See docs/active/whatsapp-agent-facing/SPEC.md §"Phase 4".

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outboundMessage: { findMany: jest.fn(), update: jest.fn() },
    manualTask: { count: jest.fn() },
    agency: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/anthropic", () => ({ callClaude: jest.fn() }));
jest.mock("@/lib/services/manual-tasks", () => ({ createManualTask: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { createManualTask } from "@/lib/services/manual-tasks";
import { scanWhatsAppPromises } from "@/lib/services/whatsapp-promises";

const db = prisma as unknown as {
  outboundMessage: Record<string, jest.Mock>;
  manualTask: Record<string, jest.Mock>;
  agency: Record<string, jest.Mock>;
};
const claude = callClaude as unknown as jest.Mock;
const create = createManualTask as unknown as jest.Mock;

// A dated, first-person promise so PROMISE_HINT passes and extractPromises returns one.
const PROMISE_TEXT = "I'll chase the solicitor tomorrow";

function message(over: Record<string, unknown>) {
  return {
    id: "m1",
    content: PROMISE_TEXT,
    sentAt: new Date("2026-09-14T10:00:00Z"),
    createdAt: new Date("2026-09-14T10:00:00Z"),
    transactionId: "tx1",
    createdById: "owner1",
    agencyId: null,
    providerWebhookData: null,
    transaction: { assignedUserId: "owner1", agentUserId: null },
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  db.outboundMessage.update.mockResolvedValue({});
  db.manualTask.count.mockResolvedValue(0);
  db.agency.findUnique.mockResolvedValue(null);
  create.mockResolvedValue({ id: "task1" });
  claude.mockResolvedValue(JSON.stringify({ promises: [{ title: "Chase solicitor", when: "tomorrow", time: "" }] }));
});

it("internal number (no connectionId) creates an internal self-assigned task", async () => {
  db.outboundMessage.findMany.mockResolvedValue([message({})]);
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(1);
  const arg = create.mock.calls[0][0];
  expect(arg.isInternalSelfAssigned).toBe(true);
  expect(arg.agencyId).toBeNull();
  expect(db.agency.findUnique).not.toHaveBeenCalled();
});

it("agency connection with tasks enabled creates an agency-visible task", async () => {
  db.outboundMessage.findMany.mockResolvedValue([
    message({ agencyId: "A", providerWebhookData: { connectionId: "conn1" } }),
  ]);
  db.agency.findUnique.mockResolvedValue({ whatsAppTasksEnabled: true });
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(1);
  const arg = create.mock.calls[0][0];
  expect(arg.isInternalSelfAssigned).toBe(false);
  expect(arg.agencyId).toBe("A");
  expect(arg.assignedToId).toBe("owner1");
});

it("agency connection with tasks disabled creates nothing (never falls into the internal pile)", async () => {
  db.outboundMessage.findMany.mockResolvedValue([
    message({ agencyId: "A", providerWebhookData: { connectionId: "conn1" } }),
  ]);
  db.agency.findUnique.mockResolvedValue({ whatsAppTasksEnabled: false });
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(0);
  expect(create).not.toHaveBeenCalled();
  // Still stamped as scanned so it isn't retried forever.
  expect(db.outboundMessage.update).toHaveBeenCalledTimes(1);
});
