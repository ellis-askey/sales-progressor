/**
 * Phase 1 (perceived performance) — scheduling-boundary tests for
 * completeTaskAction in app/actions/tasks.ts.
 *
 * Proves:
 *  1. Completing a task resolves WITHOUT awaiting the milestone notification
 *     fan-out or the reminder re-eval — both are scheduled via after().
 *  2. A prereq-blocked completion returns the structured result, schedules
 *     ONLY the engine deactivation pass (no notification fan-out).
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
  scopeChaseTaskWhere: jest.fn((_scope: unknown, id: string) => ({ id })),
  scopeReminderLogWhere: jest.fn((_scope: unknown, id: string) => ({ id })),
}));

jest.mock("@/lib/services/reminders", () => ({
  completeChaseTask: jest.fn(async () => ({
    transactionId: "tx-1",
    reminderLogId: "log-1",
    targetMilestoneCode: "VM7",
  })),
  advanceChaseTask: jest.fn(async () => ({})),
  advanceChasesForMilestones: jest.fn(async () => 0),
  snoozeReminderLog: jest.fn(async () => ({})),
  wakeUpReminderLog: jest.fn(async () => ({})),
  runReminderEngine: jest.fn(async () => ({})),
  evaluateTransactionReminders: jest.fn(async () => ({})),
  setUkChaseTime: jest.fn((d: Date) => d),
}));

jest.mock("@/lib/services/milestones", () => ({
  completeMilestone: jest.fn(async () => ({ id: "completion-1" })),
  maybeAutoCompleteTransaction: jest.fn(async () => false),
}));

jest.mock("@/lib/services/milestone-confirm-notify", () => ({
  sendMilestoneConfirmationNotifications: jest.fn(async () => ({})),
}));

jest.mock("@/lib/services/comms", () => ({ createCommunicationRecord: jest.fn(async () => ({})) }));
jest.mock("@/lib/services/chase-echo", () => ({
  postChaseEcho: jest.fn(async () => ({})),
  classifyChaseFromCode: jest.fn(() => null),
}));
jest.mock("@/lib/services/activity", () => ({ touchLastActivity: jest.fn(async () => ({})) }));
jest.mock("@/lib/agent/push-events", () => ({ pushChaseEscalation: jest.fn(async () => ({})) }));

const prismaMock = {
  milestoneDefinition: { findUnique: jest.fn(async () => ({ id: "def-1" })) },
  propertyTransaction: {
    findFirst: jest.fn(async () => ({ completionDate: null })),
    update: jest.fn(async () => ({})),
  },
  reminderLog: { update: jest.fn(async () => ({})), count: jest.fn(async () => 0) },
  chaseTask: { findFirst: jest.fn(async () => null), update: jest.fn(async () => ({})) },
  outboundMessage: { create: jest.fn(async () => ({})) },
  $transaction: jest.fn(),
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { after } from "next/server";
import { completeTaskAction } from "@/app/actions/tasks";
import { completeMilestone } from "@/lib/services/milestones";
import { evaluateTransactionReminders } from "@/lib/services/reminders";
import { sendMilestoneConfirmationNotifications } from "@/lib/services/milestone-confirm-notify";

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
});

describe("completeTaskAction — Phase 1 boundary", () => {
  it("resolves without awaiting notifications or the engine; after() runs both", async () => {
    const result = await completeTaskAction("task-1", "/agent/hub");

    expect(result).toEqual({ ok: true });
    expect(completeMilestone).toHaveBeenCalledTimes(1);

    // Neither secondary workload ran on the response path.
    expect(sendMilestoneConfirmationNotifications).not.toHaveBeenCalled();
    expect(evaluateTransactionReminders).not.toHaveBeenCalled();
    // Two callbacks scheduled: the notification fan-out + the engine pass.
    expect(after).toHaveBeenCalledTimes(2);

    await Promise.all(afterCallbacks.map((cb) => cb()));

    expect(sendMilestoneConfirmationNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "tx-1",
        milestoneCode: "VM7",
        includeCounterpartEmail: false,
      }),
    );
    expect(evaluateTransactionReminders).toHaveBeenCalledWith("tx-1");
  });

  it("prereq-blocked: structured return, engine-only after(), no notifications", async () => {
    const prereqErr = Object.assign(new Error("PREREQUISITES_NOT_COMPLETE"), {
      missing: [{ code: "VM6", name: "Return completed property forms" }],
    });
    (completeMilestone as jest.Mock).mockRejectedValueOnce(prereqErr);

    const result = await completeTaskAction("task-1", "/agent/hub");

    expect(result).toEqual({
      blocked: true,
      reason: "prerequisites_not_complete",
      missing: [{ code: "VM6", name: "Return completed property forms" }],
    });

    // Only the engine deactivation pass is scheduled — never the fan-out.
    expect(after).toHaveBeenCalledTimes(1);
    await Promise.all(afterCallbacks.map((cb) => cb()));
    expect(evaluateTransactionReminders).toHaveBeenCalledWith("tx-1");
    expect(sendMilestoneConfirmationNotifications).not.toHaveBeenCalled();
  });
});
