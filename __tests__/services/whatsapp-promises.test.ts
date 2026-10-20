// WhatsApp promises routing — intention rebuild (2026-10-19).
// Certain+dated promises become to-dos; undated/unsure become quiet possibles;
// stale dated promises (7-day look-back) are skipped; connection-scoped
// messages are skipped entirely while the founder test gate is on.

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
import { scanWhatsAppPromises, resolveDue, startOfTodayUK } from "@/lib/services/whatsapp-promises";

const db = prisma as unknown as {
  outboundMessage: Record<string, jest.Mock>;
  manualTask: Record<string, jest.Mock>;
  agency: Record<string, jest.Mock>;
};
const claude = callClaude as unknown as jest.Mock;
const create = createManualTask as unknown as jest.Mock;

const PROMISE_TEXT = "I'll chase the solicitor tomorrow";
// Sent an hour ago, so "tomorrow" is comfortably in the future.
const RECENT = new Date(Date.now() - 60 * 60 * 1000);

function message(over: Record<string, unknown>) {
  return {
    id: "m1",
    content: PROMISE_TEXT,
    sentAt: RECENT,
    createdAt: RECENT,
    transactionId: "tx1",
    createdById: "owner1",
    agencyId: null,
    providerWebhookData: { waChatId: "chat1@g.us" },
    transaction: {
      assignedUserId: "owner1",
      agentUserId: null,
      propertyAddress: "4 Quennell House, Sheldon Way, Berkhamsted",
      contacts: [{ name: "Sarah Harvey" }],
    },
    ...over,
  };
}

// The scan query is the FIRST findMany; each message then fetches context with
// another findMany (default empty).
function primeMessages(msgs: unknown[]) {
  db.outboundMessage.findMany.mockReset();
  db.outboundMessage.findMany.mockResolvedValueOnce(msgs).mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.WHATSAPP_PROMISES_INTERNAL_ONLY;
  db.outboundMessage.update.mockResolvedValue({});
  db.manualTask.count.mockResolvedValue(0);
  db.agency.findUnique.mockResolvedValue(null);
  create.mockResolvedValue({ id: "task1" });
  claude.mockResolvedValue(
    JSON.stringify({ promises: [{ title: "Chase solicitor", when: "tomorrow", time: "", certainty: "certain" }] }),
  );
});

it("internal number: a certain, dated promise becomes an internal self-assigned to-do", async () => {
  primeMessages([message({})]);
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(1);
  expect(res.possibles).toBe(0);
  const arg = create.mock.calls[0][0];
  expect(arg.isInternalSelfAssigned).toBe(true);
  expect(arg.isPossible).toBe(false);
  expect(arg.agencyId).toBeNull();
});

it("an undated promise becomes a quiet possible, never a listed to-do", async () => {
  claude.mockResolvedValue(
    JSON.stringify({ promises: [{ title: "Chase the solicitor", when: "", time: "", certainty: "certain" }] }),
  );
  primeMessages([message({ content: "I'll chase the solicitor" })]);
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(0);
  expect(res.possibles).toBe(1);
  const arg = create.mock.calls[0][0];
  expect(arg.isPossible).toBe(true);
  expect(arg.dueDate).toBeUndefined();
});

it("an unsure promise becomes a possible even when dated", async () => {
  claude.mockResolvedValue(
    JSON.stringify({ promises: [{ title: "Maybe send something", when: "tomorrow", time: "", certainty: "unsure" }] }),
  );
  primeMessages([message({})]);
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(0);
  expect(res.possibles).toBe(1);
  expect(create.mock.calls[0][0].isPossible).toBe(true);
});

it("a stale dated promise (look-back after an outage) creates nothing at all", async () => {
  // Sent five days ago promising "tomorrow" — due four days ago. Old news.
  const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  primeMessages([message({ sentAt: old, createdAt: old })]);
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(0);
  expect(res.possibles).toBe(0);
  expect(create).not.toHaveBeenCalled();
  // Still stamped so it isn't retried forever.
  expect(db.outboundMessage.update).toHaveBeenCalledTimes(1);
});

it("a pointless message (pleasantry) is stamped without an AI read", async () => {
  primeMessages([message({ content: "Thanks 🙏" })]);
  const res = await scanWhatsAppPromises();
  expect(claude).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(res.scanned).toBe(1);
  expect(db.outboundMessage.update).toHaveBeenCalledTimes(1);
});

it("FOUNDER GATE: connection-captured messages are stamped and skipped entirely", async () => {
  primeMessages([message({ agencyId: "A", providerWebhookData: { connectionId: "conn1", waChatId: "c@g.us" } })]);
  db.agency.findUnique.mockResolvedValue({ whatsAppTasksEnabled: true });
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(0);
  expect(create).not.toHaveBeenCalled();
  expect(db.agency.findUnique).not.toHaveBeenCalled(); // gate fires before the toggle
  expect(db.outboundMessage.update).toHaveBeenCalledTimes(1);
});

it("with the gate lifted, an opted-in agency connection creates an agency-visible task", async () => {
  process.env.WHATSAPP_PROMISES_INTERNAL_ONLY = "false";
  primeMessages([message({ agencyId: "A", providerWebhookData: { connectionId: "conn1", waChatId: "c@g.us" } })]);
  db.agency.findUnique.mockResolvedValue({ whatsAppTasksEnabled: true });
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(1);
  const arg = create.mock.calls[0][0];
  expect(arg.isInternalSelfAssigned).toBe(false);
  expect(arg.agencyId).toBe("A");
  expect(arg.assignedToId).toBe("owner1");
});

it("with the gate lifted, a non-opted-in agency connection creates nothing", async () => {
  process.env.WHATSAPP_PROMISES_INTERNAL_ONLY = "false";
  primeMessages([message({ agencyId: "A", providerWebhookData: { connectionId: "conn1", waChatId: "c@g.us" } })]);
  db.agency.findUnique.mockResolvedValue({ whatsAppTasksEnabled: false });
  const res = await scanWhatsAppPromises();
  expect(res.created).toBe(0);
  expect(create).not.toHaveBeenCalled();
});

it("redacted context lines are passed to the model (Them: redacted, You: verbatim)", async () => {
  db.outboundMessage.findMany.mockReset();
  db.outboundMessage.findMany
    .mockResolvedValueOnce([message({ content: "Yep, first thing tomorrow" })])
    .mockResolvedValueOnce([
      { type: "inbound", content: "Sarah Harvey here - can you chase the solicitor about 4 Quennell House?" },
    ]);
  await scanWhatsAppPromises();
  const userMessage = claude.mock.calls[0][1] as string;
  expect(userMessage).toContain('Them: "');
  expect(userMessage).not.toContain("Sarah");
  expect(userMessage).not.toContain("Quennell");
  expect(userMessage).toContain("chase the solicitor");
  expect(userMessage).toContain("Yep, first thing tomorrow");
});

describe("startOfTodayUK + resolveDue staleness interplay", () => {
  it("a promise for later today is not stale", () => {
    const due = resolveDue(new Date(), "today", "17:00");
    expect(due).not.toBeNull();
    expect(due!.getTime()).toBeGreaterThanOrEqual(startOfTodayUK().getTime());
  });

  it("yesterday's 'today' promise is stale", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const due = resolveDue(yesterday, "today", "");
    expect(due!.getTime()).toBeLessThan(startOfTodayUK().getTime());
  });
});
