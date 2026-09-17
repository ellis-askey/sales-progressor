/**
 * Phase 1A (perceived performance) — scheduling-boundary tests for the
 * milestone actions in app/actions/milestones.ts.
 *
 * What these tests prove:
 *  1. An ordinary confirm RESOLVES without awaiting the reminder engine,
 *     the exchange-prediction refresh, or the notification fan-out — that
 *     work is registered with next/server after() and only runs when the
 *     runtime invokes the callback post-response.
 *  2. Completion confirms (VM20/PM27) keep the reminder re-eval synchronous
 *     (it must run before the completionDate sync + status auto-flip, because
 *     the engine early-returns on non-active files) and do NOT run it a
 *     second time inside after().
 *  3. A failed critical write (prereq gate or generic error) schedules NO
 *     post-response work at all.
 *  4. The moved side effects still fire with the same arguments once the
 *     after() callback executes.
 */

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const afterCallbacks: Array<() => Promise<void>> = [];
jest.mock("next/server", () => ({
  after: jest.fn((cb: () => Promise<void>) => {
    afterCallbacks.push(cb);
  }),
}));

jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(async () => ({
    user: { id: "user-1", name: "Test Agent", role: "director", agencyId: "agency-1" },
  })),
}));

jest.mock("@/lib/security/access-scope", () => ({
  getAccessScope: jest.fn(() => ({ kind: "agency", agencyIds: ["agency-1"] })),
  scopeOwnershipWhere: jest.fn((_scope: unknown, id: string) => ({ id })),
}));

const ptxMock = {
  propertyTransaction: {
    findUnique: jest.fn(async () => ({ activeBuyerRoundId: null })),
    update: jest.fn(async () => ({})),
  },
  milestoneCompletion: {
    findFirst: jest.fn(async () => null),
  },
};

const prismaMock = {
  propertyTransaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(async () => ({})),
  },
  milestoneDefinition: {
    findUnique: jest.fn(),
    findFirst: jest.fn(async () => ({ id: "counter-def-1" })),
    findMany: jest.fn(async () => []),
  },
  quoteRequest: {
    updateMany: jest.fn(async () => ({ count: 0 })),
  },
  outboundMessage: {
    create: jest.fn(async () => ({})),
  },
  $transaction: jest.fn(async (fn: (ptx: typeof ptxMock) => Promise<unknown>) => fn(ptxMock)),
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

jest.mock("@/lib/services/milestones", () => ({
  completeMilestone: jest.fn(async () => ({ id: "completion-1" })),
  markNotRequiredWithCascade: jest.fn(async () => ({})),
  reverseMilestoneWithCascade: jest.fn(async () => ({})),
  bulkCompleteMilestones: jest.fn(async () => ({})),
  getUndoImpact: jest.fn(async () => ({ items: [] })),
  executeUndoMilestone: jest.fn(async () => ({})),
  unlockDirectDependents: jest.fn(async () => ({})),
  maybeUnlockExchangeGate: jest.fn(async () => ({})),
  maybeAutoCompleteTransaction: jest.fn(async () => false),
}));

jest.mock("@/lib/services/push", () => ({ pushToTransaction: jest.fn(async () => ({})) }));
jest.mock("@/lib/portal-copy", () => ({
  getMilestoneCopy: jest.fn(() => ({
    label: "Test milestone",
    emailCopy: { vendor: {}, purchaser: {} },
  })),
}));
jest.mock("@/lib/analytics/posthog-server", () => ({ trackServerEvent: jest.fn(async () => ({})) }));
jest.mock("@/lib/services/milestone-scope", () => ({
  forRound: jest.fn(() => ({})),
  milestoneScopeWhere: jest.fn(() => ({})),
}));
jest.mock("@/lib/analytics/events", () => ({
  ANALYTICS_EVENTS: {
    MILESTONE_CONFIRMED: "milestone_confirmed",
    MILESTONE_UNCONFIRMED: "milestone_unconfirmed",
  },
}));
jest.mock("@/lib/services/portal", () => ({
  sendAdminMilestoneNotificationToPortal: jest.fn(async () => ({})),
  computeHandoffDirection: jest.fn(() => null),
  isBilateralCounterpartComplete: jest.fn(async () => false),
  roleToConfirmerRoute: jest.fn(() => "agent"),
  fireAutoCounterpartEmails: jest.fn(async () => ({})),
  scheduleOrSendCompletionPack: jest.fn(async () => ({})),
}));
jest.mock("@/lib/contacts/displayName", () => ({
  getDisplayName: jest.fn((c: { name?: string | null }) => c?.name ?? ""),
}));
jest.mock("@/lib/services/retention", () => ({ maybeFireFirstExchangeEmail: jest.fn(async () => ({})) }));
jest.mock("@/lib/services/notifications", () => ({ notifyOutsourcedMilestoneConfirmed: jest.fn(async () => ({})) }));
jest.mock("@/lib/services/booking-reminders", () => ({ maybeSendBookingDiaryEmail: jest.fn(async () => ({})) }));
jest.mock("@/lib/services/reminders", () => ({
  evaluateTransactionReminders: jest.fn(async () => ({})),
  autoCompleteRemindersForMilestone: jest.fn(async () => ({})),
}));
jest.mock("@/lib/email/ready-to-exchange", () => ({ maybeSendReadyToExchangeEmail: jest.fn(async () => ({})) }));
jest.mock("@/lib/services/exchange-prediction", () => ({ refreshExpectedExchangeDate: jest.fn(async () => null) }));

import { after } from "next/server";
import { confirmMilestoneAction, reverseMilestoneAction } from "@/app/actions/milestones";
import { completeMilestone, reverseMilestoneWithCascade } from "@/lib/services/milestones";
import { evaluateTransactionReminders } from "@/lib/services/reminders";
import { refreshExpectedExchangeDate } from "@/lib/services/exchange-prediction";
import { sendAdminMilestoneNotificationToPortal } from "@/lib/services/portal";
import { pushToTransaction } from "@/lib/services/push";

const TX_ROW = {
  id: "tx-1",
  propertyAddress: "1 Test Street, Testville",
  serviceType: "self_managed",
  assignedUserId: null,
  suppressPortalConfirmEmails: false,
  isDemo: false,
};

// Shape returned by the notifications-status build findUnique.
const NOTIF_TX_ROW = {
  serviceType: "self_managed",
  assignedUser: null,
  agentUser: null,
  contacts: [
    { id: "c1", name: "Vera Vendor", email: "v@example.com", roleType: "vendor" },
    { id: "c2", name: "Percy Purchaser", email: null, roleType: "purchaser" },
  ],
};

function runAllAfterCallbacks() {
  return Promise.all(afterCallbacks.map((cb) => cb()));
}

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
  prismaMock.propertyTransaction.findFirst.mockResolvedValue(TX_ROW);
  prismaMock.propertyTransaction.findUnique.mockResolvedValue(NOTIF_TX_ROW);
});

describe("confirmMilestoneAction — Phase 1A boundary", () => {
  it("ordinary confirm resolves WITHOUT running the engines; after() runs them with the same args", async () => {
    prismaMock.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM7" });

    const result = await confirmMilestoneAction({
      transactionId: "tx-1",
      milestoneDefinitionId: "def-vm7",
    });

    // The action acknowledged the write…
    expect(result.ok).toBe(true);
    expect(completeMilestone).toHaveBeenCalledTimes(1);
    // …and the notifications-status contract is still built synchronously.
    if (result.ok) {
      expect(result.notifications.map((n) => n.status)).toEqual(
        expect.arrayContaining(["queued", "skipped_no_email"]),
      );
    }

    // Nothing engine-shaped ran on the response path.
    expect(evaluateTransactionReminders).not.toHaveBeenCalled();
    expect(refreshExpectedExchangeDate).not.toHaveBeenCalled();
    expect(sendAdminMilestoneNotificationToPortal).not.toHaveBeenCalled();
    expect(pushToTransaction).not.toHaveBeenCalled();

    // Exactly one post-response callback was scheduled after the write.
    expect(after).toHaveBeenCalledTimes(1);

    await runAllAfterCallbacks();

    // Post-response: engine with the SAME anchorCodes narrowing as before 1A,
    // prediction refresh, and the notification fan-out.
    expect(evaluateTransactionReminders).toHaveBeenCalledWith("tx-1", { anchorCodes: ["VM7"] });
    expect(refreshExpectedExchangeDate).toHaveBeenCalledWith("tx-1");
    expect(sendAdminMilestoneNotificationToPortal).toHaveBeenCalledTimes(1);
    expect(pushToTransaction).toHaveBeenCalledTimes(1);
  });

  it("completion confirm (VM20) runs the reminder engine SYNCHRONOUSLY and not again in after()", async () => {
    prismaMock.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM20" });

    const result = await confirmMilestoneAction({
      transactionId: "tx-1",
      milestoneDefinitionId: "def-vm20",
      eventDate: "2026-09-17",
    });

    expect(result.ok).toBe(true);
    // Engine ran on the response path (before completionDate sync + status
    // flip — the engine no-ops on non-active files, so ordering is semantic).
    expect(evaluateTransactionReminders).toHaveBeenCalledTimes(1);
    expect(evaluateTransactionReminders).toHaveBeenCalledWith("tx-1", {
      anchorCodes: ["VM20", "PM27"],
    });

    await runAllAfterCallbacks();

    // after() did NOT run it a second time.
    expect(evaluateTransactionReminders).toHaveBeenCalledTimes(1);
    // Prediction refresh still deferred.
    expect(refreshExpectedExchangeDate).toHaveBeenCalledTimes(1);
  });

  it("prereq failure returns the structured result and schedules NO post-response work", async () => {
    prismaMock.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM7" });
    const prereqErr = Object.assign(new Error("PREREQUISITES_NOT_COMPLETE"), {
      targetCode: "VM7",
      missing: [{ code: "VM6", name: "Return completed property forms" }],
    });
    (completeMilestone as jest.Mock).mockRejectedValueOnce(prereqErr);

    const result = await confirmMilestoneAction({
      transactionId: "tx-1",
      milestoneDefinitionId: "def-vm7",
    });

    expect(result.ok).toBe(false);
    expect(after).not.toHaveBeenCalled();
    expect(evaluateTransactionReminders).not.toHaveBeenCalled();
    expect(refreshExpectedExchangeDate).not.toHaveBeenCalled();
    expect(sendAdminMilestoneNotificationToPortal).not.toHaveBeenCalled();
  });

  it("generic write failure rethrows and schedules NO post-response work", async () => {
    prismaMock.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM7" });
    (completeMilestone as jest.Mock).mockRejectedValueOnce(new Error("db down"));

    await expect(
      confirmMilestoneAction({ transactionId: "tx-1", milestoneDefinitionId: "def-vm7" }),
    ).rejects.toThrow("db down");

    expect(after).not.toHaveBeenCalled();
    expect(evaluateTransactionReminders).not.toHaveBeenCalled();
  });

  it("demo file: no engine call anywhere, but the write + return still work", async () => {
    prismaMock.propertyTransaction.findFirst.mockResolvedValue({ ...TX_ROW, isDemo: true });
    prismaMock.milestoneDefinition.findUnique.mockResolvedValue({ code: "VM7" });

    const result = await confirmMilestoneAction({
      transactionId: "tx-1",
      milestoneDefinitionId: "def-vm7",
    });

    expect(result.ok).toBe(true);
    await runAllAfterCallbacks();

    expect(evaluateTransactionReminders).not.toHaveBeenCalled();
    // Demo files emit nothing outbound (same guard as before 1A).
    expect(sendAdminMilestoneNotificationToPortal).not.toHaveBeenCalled();
    expect(pushToTransaction).not.toHaveBeenCalled();
    // Prediction refresh has no demo guard today and keeps that behaviour.
    expect(refreshExpectedExchangeDate).toHaveBeenCalledTimes(1);
  });
});

describe("reverseMilestoneAction — Phase 1A boundary", () => {
  it("resolves without the engines; after() runs the FULL (un-narrowed) reminder pass", async () => {
    await reverseMilestoneAction({
      transactionId: "tx-1",
      milestoneDefinitionId: "def-vm7",
    });

    expect(reverseMilestoneWithCascade).toHaveBeenCalledTimes(1);
    expect(evaluateTransactionReminders).not.toHaveBeenCalled();
    expect(refreshExpectedExchangeDate).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);

    await runAllAfterCallbacks();

    // Full pass — called with the transaction id ONLY (no anchorCodes),
    // exactly as before Phase 1A.
    expect(evaluateTransactionReminders).toHaveBeenCalledTimes(1);
    expect(evaluateTransactionReminders).toHaveBeenCalledWith("tx-1");
    expect(refreshExpectedExchangeDate).toHaveBeenCalledWith("tx-1");
  });
});
