/**
 * @jest-environment node
 *
 * Per-agency solicitor CC precedence (Fix 1).
 *
 * Precedence: the solicitor's own value (gospel) → this agency's override → none.
 * These tests lock the resolution + write rules; wiring them into the send paths
 * is the follow-up.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    solicitorContactAgencyOverride: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

import {
  resolveSolicitorCc,
  getSolicitorCcForEditing,
  setAgencySolicitorCc,
  SOLICITOR_CC_GOSPEL_SET,
} from "@/lib/services/solicitor-cc";
import { prisma } from "@/lib/prisma";

const p = prisma as any;
const handler = (secondaryEmail: string | null) => ({ id: "sol1", secondaryEmail });

beforeEach(() => jest.clearAllMocks());

describe("resolveSolicitorCc precedence", () => {
  it("uses the solicitor's own value (gospel) and never looks at the agency override", async () => {
    const cc = await resolveSolicitorCc(handler("Sarah.PA@firm.com"), "agencyA");
    expect(cc).toBe("sarah.pa@firm.com");
    expect(p.solicitorContactAgencyOverride.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to THIS agency's override when the solicitor has no value", async () => {
    p.solicitorContactAgencyOverride.findUnique.mockResolvedValue({ secondaryEmail: "agencyA-cc@x.com" });
    const cc = await resolveSolicitorCc(handler(null), "agencyA");
    expect(cc).toBe("agencya-cc@x.com");
    expect(p.solicitorContactAgencyOverride.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId_solicitorContactId: { agencyId: "agencyA", solicitorContactId: "sol1" } } }),
    );
  });

  it("returns null when neither the solicitor nor the agency has a value", async () => {
    p.solicitorContactAgencyOverride.findUnique.mockResolvedValue(null);
    expect(await resolveSolicitorCc(handler(null), "agencyA")).toBeNull();
  });

  it("returns null with no agency context and no gospel value", async () => {
    expect(await resolveSolicitorCc(handler(null), null)).toBeNull();
    expect(p.solicitorContactAgencyOverride.findUnique).not.toHaveBeenCalled();
  });

  it("does not leak one agency's override to another", async () => {
    // Agency B has no override; agency A does. Resolving for B returns null.
    p.solicitorContactAgencyOverride.findUnique.mockResolvedValue(null);
    expect(await resolveSolicitorCc(handler(null), "agencyB")).toBeNull();
  });
});

describe("setAgencySolicitorCc", () => {
  it("writes the agency's own override when the solicitor has no gospel value", async () => {
    p.solicitorContactAgencyOverride.upsert.mockResolvedValue({});
    const v = await setAgencySolicitorCc(handler(null), "agencyA", "New.CC@x.com");
    expect(v).toBe("new.cc@x.com");
    expect(p.solicitorContactAgencyOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId_solicitorContactId: { agencyId: "agencyA", solicitorContactId: "sol1" } },
        create: { agencyId: "agencyA", solicitorContactId: "sol1", secondaryEmail: "new.cc@x.com" },
        update: { secondaryEmail: "new.cc@x.com" },
      }),
    );
  });

  it("refuses to write an agency override when the solicitor's gospel value is set", async () => {
    await expect(setAgencySolicitorCc(handler("gospel@firm.com"), "agencyA", "x@y.com"))
      .rejects.toThrow(SOLICITOR_CC_GOSPEL_SET);
    expect(p.solicitorContactAgencyOverride.upsert).not.toHaveBeenCalled();
  });
});

describe("getSolicitorCcForEditing", () => {
  it("shows the solicitor's value as read-only when set (gospel)", async () => {
    const r = await getSolicitorCcForEditing(handler("Gospel@firm.com"), "agencyA");
    expect(r).toEqual({ source: "solicitor", value: "gospel@firm.com", editable: false });
  });

  it("shows the agency's own editable value when the solicitor has none", async () => {
    p.solicitorContactAgencyOverride.findUnique.mockResolvedValue({ secondaryEmail: "agencyA@x.com" });
    const r = await getSolicitorCcForEditing(handler(null), "agencyA");
    expect(r).toEqual({ source: "agency", value: "agencya@x.com", editable: true });
  });
});
