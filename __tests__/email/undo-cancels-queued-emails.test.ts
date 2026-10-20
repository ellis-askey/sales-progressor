/**
 * @jest-environment node
 *
 * Undo tears up queued-but-unsent milestone emails (audit full-audit-2026-10,
 * finding MILE-002).
 *
 * Exchange/completion/celebration emails and portal confirmations are enqueued
 * for quiet-hours delivery. Before the fix, undoing the milestone left those
 * rows in the queue, so a mistaken "contracts exchanged" still emailed the
 * clients and the whole chain when the drain ran. These tests prove the
 * cancellation helper deletes exactly the unsent rows for the undone steps and
 * never touches sent rows (sent email cannot be recalled, and sent rows carry
 * the redo dedup).
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/email", () => ({
  sendChainEmail: jest.fn(),
  sendEmail: jest.fn(),
  isUserEmailSuppressed: jest.fn(),
  isContactEmailSuppressed: jest.fn(),
  buildOutboundMessageId: jest.fn(),
  isTransientSendError: jest.fn(),
  isSenderIdentityError: jest.fn(),
  MAX_SEND_RETRY_MS: 24 * 60 * 60 * 1000,
}));
jest.mock("@/lib/command/events/write", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/email/compose-queue", () => ({ AGENT_COMPOSE_TYPE: "agent_compose" }));

import { cancelQueuedEmailsForReversedMilestones } from "@/lib/email/outboundQueue";

function mockDb(over: Record<string, any> = {}) {
  return {
    outboundEmailQueue: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    chainNeighbourUpdate: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    propertyTransaction: { findUnique: jest.fn().mockResolvedValue({ chainLinkId: null }) },
    chainLink: { findUnique: jest.fn().mockResolvedValue(null) },
    propertyChain: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ...over,
  } as any;
}

beforeEach(() => jest.clearAllMocks());

describe("cancelQueuedEmailsForReversedMilestones", () => {
  it("does nothing when no codes were reversed", async () => {
    const db = mockDb();
    await cancelQueuedEmailsForReversedMilestones("t1", [], db);
    expect(db.outboundEmailQueue.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes only UNSENT per-milestone client emails, keyed transactionId:code", async () => {
    const db = mockDb();
    await cancelQueuedEmailsForReversedMilestones("t1", ["PM10"], db);
    expect(db.outboundEmailQueue.deleteMany).toHaveBeenCalledWith({
      where: {
        emailType: { in: ["MILESTONE_CONFIRMATION", "COMPLETION_PACK"] },
        sourceId: { in: ["t1:PM10"] },
        sentAt: null,
      },
    });
    // Non-exchange code: no chain lookups, no chain-mate deletions.
    expect(db.propertyTransaction.findUnique).not.toHaveBeenCalled();
  });

  it("deletes unsent onward-neighbour updates for the undone steps", async () => {
    const db = mockDb();
    await cancelQueuedEmailsForReversedMilestones("t1", ["PM10"], db);
    expect(db.chainNeighbourUpdate.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: "t1", milestoneCode: { in: ["PM10"] }, sentAt: null },
    });
  });

  it("undoing an exchange tears up the chain-mate EXCHANGE rows for this link", async () => {
    const db = mockDb({
      propertyTransaction: { findUnique: jest.fn().mockResolvedValue({ chainLinkId: "link1" }) },
    });
    await cancelQueuedEmailsForReversedMilestones("t1", ["VM19", "PM26"], db);
    expect(db.outboundEmailQueue.deleteMany).toHaveBeenCalledWith({
      where: { emailType: { in: ["EXCHANGE"] }, sourceId: "link1", sentAt: null },
    });
    // Exchange undo alone never touches the celebration guard.
    expect(db.propertyChain.updateMany).not.toHaveBeenCalled();
  });

  it("undoing a completion also tears up CELEBRATION rows and re-arms the once-only guard", async () => {
    const db = mockDb({
      propertyTransaction: { findUnique: jest.fn().mockResolvedValue({ chainLinkId: "link1" }) },
      chainLink: { findUnique: jest.fn().mockResolvedValue({ chainId: "chain1" }) },
    });
    await cancelQueuedEmailsForReversedMilestones("t1", ["VM20", "PM27"], db);
    expect(db.outboundEmailQueue.deleteMany).toHaveBeenCalledWith({
      where: { emailType: { in: ["COMPLETION"] }, sourceId: "link1", sentAt: null },
    });
    expect(db.outboundEmailQueue.deleteMany).toHaveBeenCalledWith({
      where: { emailType: "CELEBRATION", sourceId: "chain1", sentAt: null },
    });
    expect(db.propertyChain.updateMany).toHaveBeenCalledWith({
      where: { id: "chain1", celebrationSentAt: { not: null } },
      data: { celebrationSentAt: null },
    });
  });

  it("every queue deletion is scoped to sentAt null — sent email is never touched", async () => {
    const db = mockDb({
      propertyTransaction: { findUnique: jest.fn().mockResolvedValue({ chainLinkId: "link1" }) },
      chainLink: { findUnique: jest.fn().mockResolvedValue({ chainId: "chain1" }) },
    });
    await cancelQueuedEmailsForReversedMilestones("t1", ["VM19", "VM20"], db);
    for (const call of db.outboundEmailQueue.deleteMany.mock.calls) {
      expect(call[0].where.sentAt).toBeNull();
    }
    expect(db.chainNeighbourUpdate.deleteMany.mock.calls[0][0].where.sentAt).toBeNull();
  });

  it("a file not in a chain skips the chain-mate branch without erroring", async () => {
    const db = mockDb(); // chainLinkId: null
    await cancelQueuedEmailsForReversedMilestones("t1", ["VM19"], db);
    // Per-milestone + neighbour deletions still happen; no link-keyed deletion.
    const linkKeyed = db.outboundEmailQueue.deleteMany.mock.calls.filter(
      (c: any[]) => c[0].where.sourceId === "link1",
    );
    expect(linkKeyed).toHaveLength(0);
  });
});
