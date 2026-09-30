/**
 * @jest-environment node
 *
 * Bounded hub/pipeline visibility for progression-business members (Phase 7).
 * A business member's "assigned" scope is widened to the whole business book
 * (businessId), so employees see every file their business progresses — while
 * TSP internal staff keep per-user assigned scope and admins keep admin_all.
 * Zero-regression: businessId is only set for a member with a progressionBusinessId.
 */
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { resolveInternalVisibility } from "@/lib/services/agent";

describe("resolveInternalVisibility - progression business members", () => {
  it("a business member gets internalMode 'assigned' + businessId (whole-book widening)", () => {
    const vis = resolveInternalVisibility("u_sarah", "sales_progressor", false, "biz_sarah");
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBe("biz_sarah");
  });

  it("a TSP progressor (no business) keeps per-user assigned scope, no businessId", () => {
    const vis = resolveInternalVisibility("u_tsp", "sales_progressor", false, null);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBeUndefined();
  });

  it("an admin stays admin_all with no businessId, even if a business id is passed", () => {
    const vis = resolveInternalVisibility("u_admin", "admin", true, "biz_sarah");
    expect(vis.internalMode).toBe("admin_all");
    expect(vis.businessId).toBeUndefined();
  });

  it("omitting the business id is unchanged from before (backwards-compatible)", () => {
    const vis = resolveInternalVisibility("u_tsp", "sales_progressor", false);
    expect(vis.internalMode).toBe("assigned");
    expect(vis.businessId).toBeUndefined();
  });
});
