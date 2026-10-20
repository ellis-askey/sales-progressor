/**
 * @jest-environment node
 *
 * Reschedule hold on solicitor chases (chase timeline, move the next chase).
 * SolicitorChaseState.snoozeUntil quiets a step: findDueSolicitorChases must
 * skip it while the hold is in the future and resume once it passes. The hold
 * row can exist with zero chases (the reschedule action upserts it), so the
 * never-chased path is covered too.
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prisma: {
    solicitorReminderRule: { findMany: jest.fn().mockResolvedValue([]) },
    propertyTransaction: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/email", () => ({ sendChainEmail: jest.fn(), buildOutboundMessageId: jest.fn(() => "mid") }));
jest.mock("@/lib/services/progressor-chase-prefs", () => ({
  loadBusinessChaseGate: jest.fn(async () => new Map()),
  businessChaseAllows: jest.fn(() => true),
}));
jest.mock("@/lib/email/agency-sender", () => ({ resolveAgencySenderForTransaction: jest.fn() }));
jest.mock("@/lib/email/agent-signature-for-file", () => ({ resolveAgentSignatureForFile: jest.fn() }));
jest.mock("@/lib/supabase-storage", () => ({ getAvatarPublicUrl: jest.fn() }));
jest.mock("@/lib/services/solicitor-cc", () => ({ solicitorCcForAgency: jest.fn() }));
jest.mock("@/lib/enquiries/chase-log", () => ({ logChaseSend: jest.fn() }));
jest.mock("@/lib/services/chase-overrides", () => ({ getChaseOverridesForBuild: jest.fn(), consumeSkip: jest.fn() }));

import { findDueSolicitorChases } from "@/lib/solicitor-confirm/chase";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { prisma } from "@/lib/prisma";

const p = prisma as unknown as {
  propertyTransaction: { findMany: jest.Mock };
};

const NOW = new Date("2026-10-20T09:00:00Z"); // a Tuesday
const LONG_AGO = new Date("2026-09-01T10:00:00Z");
const CODE = "VM7"; // seller's solicitor: draft contract pack issued

const GLOBAL = { enabledByDefault: true, graceWorkingDays: 5, repeatDays: 7, maxChases: 2 };

function def(code: string) {
  return { id: `def-${code}`, code, side: code.startsWith("PM") ? "purchaser" : "vendor", name: code };
}

// The step itself is available; every prerequisite completed weeks ago, so the
// grace window is long past and the only thing that can stop a chase is a hold.
const completions = [
  { state: "available", completedAt: null, expectedDate: null, eventDate: null, buyerRoundId: null, milestoneDefinition: def(CODE) },
  ...(DIRECT_PREREQUISITES[CODE] ?? []).map((prereq) => ({
    state: "complete", completedAt: LONG_AGO, expectedDate: null, eventDate: null, buyerRoundId: null, milestoneDefinition: def(prereq),
  })),
];

type SolStateRow = {
  side: string; milestoneCode: string; chaseCount: number;
  lastChasedAt: Date | null; status: string; snoozeUntil: Date | null;
};

function txFixture(state: SolStateRow | null) {
  return {
    id: "t1", activeBuyerRoundId: null, lastActivityAt: null, createdAt: LONG_AGO, isMigrated: false,
    agency: { solicitorChaseEnabled: true }, progressionBusinessId: null, clientEmailsPaused: false,
    exchangeDayStartedAt: null, exchangeDayCancelledAt: null, exchangedAt: null,
    vendorSolicitorContactId: "sc1", vendorSolicitorEmailsPaused: false, vendorSolicitorEmailsPausedUntil: null,
    vendorSolicitorContact: { email: "sol@example.com" },
    purchaserSolicitorContactId: null, purchaserSolicitorEmailsPaused: false, purchaserSolicitorEmailsPausedUntil: null,
    purchaserSolicitorContact: null,
    milestoneCompletions: completions,
    solicitorChaseStates: state ? [state] : [],
  };
}

const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

beforeEach(() => jest.clearAllMocks());

describe("findDueSolicitorChases — reschedule hold", () => {
  it("baseline: an overdue step with no state row is due", async () => {
    p.propertyTransaction.findMany.mockResolvedValue([txFixture(null)]);
    const due = await findDueSolicitorChases(NOW, GLOBAL as never);
    expect(due).toHaveLength(1);
    expect(due[0].steps.map((s) => s.code)).toContain(CODE);
  });

  it("a future hold quiets a never-chased step (hold-only row from a reschedule)", async () => {
    p.propertyTransaction.findMany.mockResolvedValue([
      txFixture({ side: "vendor", milestoneCode: CODE, chaseCount: 0, lastChasedAt: null, status: "active", snoozeUntil: daysFromNow(3) }),
    ]);
    const due = await findDueSolicitorChases(NOW, GLOBAL as never);
    expect(due).toHaveLength(0);
  });

  it("a future hold quiets a step mid-cadence (already chased once)", async () => {
    p.propertyTransaction.findMany.mockResolvedValue([
      txFixture({ side: "vendor", milestoneCode: CODE, chaseCount: 1, lastChasedAt: daysFromNow(-20), status: "active", snoozeUntil: daysFromNow(5) }),
    ]);
    const due = await findDueSolicitorChases(NOW, GLOBAL as never);
    expect(due).toHaveLength(0);
  });

  it("an elapsed hold releases the chase on the chosen day", async () => {
    p.propertyTransaction.findMany.mockResolvedValue([
      txFixture({ side: "vendor", milestoneCode: CODE, chaseCount: 0, lastChasedAt: null, status: "active", snoozeUntil: daysFromNow(-0.5) }),
    ]);
    const due = await findDueSolicitorChases(NOW, GLOBAL as never);
    expect(due).toHaveLength(1);
    expect(due[0].steps.map((s) => s.code)).toContain(CODE);
  });
});
