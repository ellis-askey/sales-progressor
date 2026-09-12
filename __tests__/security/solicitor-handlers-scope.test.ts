/**
 * @jest-environment node
 *
 * Security regression (audit P0-1): PATCH /api/solicitor-handlers/[id].
 *
 * SolicitorContact is a shared GLOBAL directory row (no agencyId). Its
 * secondaryEmail is CC'd on every email we send that handler across every
 * file they're on. Before the fix, ANY logged-in user could PATCH ANY
 * handler's secondaryEmail with no ownership check — a cross-agency
 * client-comms exfiltration vector.
 *
 * These tests prove the server-side scope guard:
 *   - unauthenticated  → rejected (401), no write
 *   - cross-agency     → rejected (404), no write
 *   - authorised (handler on caller's file) → allowed
 *   - brand-new unattached handler (creation flow) → allowed (not broken)
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    solicitorContact: { findUnique: jest.fn(), update: jest.fn() },
    propertyTransaction: { count: jest.fn() },
  },
}));

import { PATCH } from "@/app/api/solicitor-handlers/[id]/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockFindUnique = (prisma as any).solicitorContact.findUnique as jest.Mock;
const mockUpdate = (prisma as any).solicitorContact.update as jest.Mock;
const mockCount = (prisma as any).propertyTransaction.count as jest.Mock;

const HANDLER_ID = "handler_123";

function agencyUser(agencyId: string) {
  return { user: { id: `u_${agencyId}`, role: "negotiator", agencyId, email: `${agencyId}@example.com` } };
}

function req(body: unknown) {
  return { json: async () => body } as any;
}
const params = Promise.resolve({ id: HANDLER_ID });

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue({ id: HANDLER_ID });
  mockUpdate.mockResolvedValue({
    id: HANDLER_ID,
    name: "Jane Handler",
    phone: null,
    email: "jane@firm.com",
    secondaryEmail: "assistant@firm.com",
  });
});

describe("PATCH /api/solicitor-handlers/[id] — multi-tenant ownership guard", () => {
  it("rejects unauthenticated callers without writing", async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(req({ secondaryEmail: "assistant@firm.com" }), { params });
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-agency caller editing a handler that is only on another agency's files", async () => {
    mockSession.mockResolvedValue(agencyUser("B"));
    // in-scope count = 0 (not on any of agency B's files), any count = 1 (on agency A's file)
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const res = await PATCH(req({ secondaryEmail: "attacker@evil.com" }), { params });
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows an authorised caller whose own file uses the handler (legitimate shared usage)", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    // in-scope count >= 1 → handler is on one of the caller's files
    mockCount.mockResolvedValueOnce(1);
    const res = await PATCH(req({ secondaryEmail: "assistant@firm.com" }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.secondaryEmail).toBe("assistant@firm.com");
  });

  it("allows editing a brand-new handler not yet attached to any transaction (creation flow)", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    // in-scope count = 0, and any count = 0 → unattached, safe to edit
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    const res = await PATCH(req({ secondaryEmail: "assistant@firm.com" }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("internal staff (scope 'all') bypass the file-ownership requirement", async () => {
    mockSession.mockResolvedValue({ user: { id: "sp1", role: "admin", agencyId: null, email: "ops@tsp.com" } });
    const res = await PATCH(req({ secondaryEmail: "assistant@firm.com" }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // no scope counting needed for admin
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before any ownership work", async () => {
    mockSession.mockResolvedValue(agencyUser("A"));
    const res = await PATCH(req({ secondaryEmail: "not-an-email" }), { params });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
