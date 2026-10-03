/**
 * @jest-environment node
 *
 * Bounded hub/pipeline visibility for progression-business members (Phase 7,
 * revised by #4 see-all/see-own). A member's hub scope is widened to the whole
 * business book (businessId) ONLY when they are the owner, or the owner has
 * granted them see-all (canViewAllFiles). A plain member sees see-own: businessId
 * stays undefined and the "assigned" branch scopes to their own assignedUserId.
 * TSP internal staff keep per-user assigned scope and admins keep admin_all.
 */
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { resolveInternalVisibility } from "@/lib/services/agent";

describe("resolveInternalVisibility - progression business members", () => {
  it("the owner gets internalMode 'assigned' + businessId (whole-book)", () => {
    const vis = resolveInternalVisibility("u_sarah", "sales_progressor", false, "biz_sarah", "owner", false);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBe("biz_sarah");
  });

  it("a see-all-granted member gets businessId (whole-book)", () => {
    const vis = resolveInternalVisibility("u_tom", "sales_progressor", false, "biz_sarah", "progressor", true);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBe("biz_sarah");
  });

  it("a plain member (see-own) gets no businessId, scoped to their own files", () => {
    const vis = resolveInternalVisibility("u_tom", "sales_progressor", false, "biz_sarah", "progressor", false);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBeUndefined();
  });

  it("fail-closed: unknown role + flag omitted is see-own (no businessId)", () => {
    const vis = resolveInternalVisibility("u_tom", "sales_progressor", false, "biz_sarah");
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBeUndefined();
  });

  it("a TSP progressor (no business) keeps per-user assigned scope, no businessId", () => {
    const vis = resolveInternalVisibility("u_tsp", "sales_progressor", false, null);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBeUndefined();
  });

  it("an admin stays admin_all with no businessId, even if business+owner passed", () => {
    const vis = resolveInternalVisibility("u_admin", "admin", true, "biz_sarah", "owner", true);
    expect(vis.internalMode).toBe("admin_all");
    expect(vis.businessId).toBeUndefined();
  });

  it("omitting all business args is unchanged from before (backwards-compatible)", () => {
    const vis = resolveInternalVisibility("u_tsp", "sales_progressor", false);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBeUndefined();
  });
});
