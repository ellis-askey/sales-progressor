/**
 * @jest-environment node
 *
 * Representative API-route audit test for the Slice-1 coverage work.
 *
 * The milestone-email save route edits client-facing EMAIL COPY, so it is the
 * sharp test of two safeguards at once:
 *   1. On success it writes exactly one AdminAuditLog row (actor + action +
 *      target + identifier metadata).
 *   2. It records the WHICH, never the copy — the subject/body text must not
 *      appear anywhere in the audit payload ("never log complete email bodies").
 *   3. A forbidden call writes neither the override nor an audit row (a failed
 *      action is never recorded as a successful one).
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/agent-session", () => ({ hasSuperAdminPowers: (s: { user?: { role?: string } }) => s?.user?.role === "superadmin" }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    milestoneEmailOverride: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

import { POST } from "@/app/api/command/milestone-emails/save/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const gss = getServerSession as jest.Mock;
const p = prisma as unknown as {
  milestoneEmailOverride: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
  adminAuditLog: { create: jest.Mock };
};

const SECRET_COPY = "SENSITIVE_SUBJECT_LINE_MUST_NOT_BE_LOGGED";

function req(body: Record<string, unknown>) {
  return new Request("http://local/api/command/milestone-emails/save", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  gss.mockResolvedValue({ user: { id: "admin1", role: "superadmin", email: "a@b.c" } });
});

const validBody = {
  code: "VM1", side: "vendor", tenure: "any", purchaseType: "any",
  subject: SECRET_COPY, heroLabel: "Hero", opening: "Open", whatHappened: "Happened",
};

describe("milestone-emails/save audit coverage", () => {
  it("writes the override and one audit row of identifiers only (no copy text)", async () => {
    p.milestoneEmailOverride.findFirst.mockResolvedValue(null);
    p.milestoneEmailOverride.create.mockResolvedValue({ id: "o1" });

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);

    // The real mutation still ran exactly as before.
    expect(p.milestoneEmailOverride.create).toHaveBeenCalledTimes(1);

    // Exactly one audit row, with the right actor/action/target.
    expect(p.adminAuditLog.create).toHaveBeenCalledTimes(1);
    const data = p.adminAuditLog.create.mock.calls[0][0].data;
    expect(data.adminUserId).toBe("admin1");
    expect(data.action).toBe("command.milestone_email.save");
    expect(data.targetId).toBe("VM1");
    expect(data.afterValue).toMatchObject({ code: "VM1", side: "vendor", created: true });

    // The safeguard that matters: the email copy is NOT in the audit payload.
    expect(JSON.stringify(data)).not.toContain(SECRET_COPY);
  });

  it("a forbidden call writes neither the override nor an audit row", async () => {
    gss.mockResolvedValue(null); // no session → 403
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
    expect(p.milestoneEmailOverride.create).not.toHaveBeenCalled();
    expect(p.milestoneEmailOverride.update).not.toHaveBeenCalled();
    expect(p.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
