/**
 * @jest-environment node
 *
 * recordAdminActionSafe — the best-effort audit writer used by Command Centre
 * mutations. Contract (Slice 1 audit-coverage safeguards):
 *   - On success it writes exactly one AdminAuditLog row with the given fields.
 *   - If the audit insert fails it NEVER throws (so the already-completed
 *     mutation is not reported as failed, which would risk a retry /
 *     double-execution) and logs the failure to the server console.
 *   - The strict recordAdminAction still propagates errors, so existing callers
 *     that deliberately `.catch()` keep their behaviour.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { adminAuditLog: { create: jest.fn() } },
}));

import { recordAdminAction, recordAdminActionSafe } from "@/lib/command/audit/write";
import { prisma } from "@/lib/prisma";

const create = (prisma as unknown as { adminAuditLog: { create: jest.Mock } }).adminAuditLog.create;

beforeEach(() => jest.clearAllMocks());

describe("recordAdminActionSafe", () => {
  it("writes one audit row with the given actor/action/target on success", async () => {
    create.mockResolvedValueOnce({});
    await recordAdminActionSafe({
      adminUserId: "u1",
      action: "agency.fee_tier.update",
      targetType: "agency",
      targetId: "ag_1",
      beforeValue: { feeTier: "standard" },
      afterValue: { feeTier: "free" },
    });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.adminUserId).toBe("u1");
    expect(data.action).toBe("agency.fee_tier.update");
    expect(data.targetId).toBe("ag_1");
  });

  it("never throws and logs to console when the audit insert fails", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAdminActionSafe({ adminUserId: "u1", action: "command.demo.reset" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("strict recordAdminAction still throws (callers opt into catching)", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordAdminAction({ adminUserId: "u1", action: "command.page_view" }),
    ).rejects.toThrow("db down");
  });
});
