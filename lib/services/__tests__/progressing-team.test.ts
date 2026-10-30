/**
 * @jest-environment node
 */

// The "same progressing team" rule behind the onward portal mirror
// (docs/active/onward-portal-mirror.md). Covers the three service models.

import { isSameProgressingTeam, type ProgressingTeamFacts } from "@/lib/services/progressing-team";

const selfManaged = (agencyId: string): ProgressingTeamFacts => ({ agencyId, progressionBusinessId: null, serviceType: "self_managed" });
const tsp = (agencyId: string): ProgressingTeamFacts => ({ agencyId, progressionBusinessId: null, serviceType: "outsourced" });
const business = (agencyId: string, businessId: string): ProgressingTeamFacts => ({ agencyId, progressionBusinessId: businessId, serviceType: "outsourced" });

describe("isSameProgressingTeam", () => {
  test("self-managed, same agency → same team", () => {
    expect(isSameProgressingTeam(selfManaged("ag1"), selfManaged("ag1"))).toBe(true);
  });

  test("self-managed, different agency → different team", () => {
    expect(isSameProgressingTeam(selfManaged("ag1"), selfManaged("ag2"))).toBe(false);
  });

  test("both TSP-outsourced, same agency → same team (the Achillea case)", () => {
    expect(isSameProgressingTeam(tsp("akeman"), tsp("akeman"))).toBe(true);
  });

  test("both TSP-outsourced, different agencies → same team (TSP runs both)", () => {
    expect(isSameProgressingTeam(tsp("ag1"), tsp("ag2"))).toBe(true);
  });

  test("same progression business, different agencies → same team", () => {
    expect(isSameProgressingTeam(business("ag1", "biz1"), business("ag2", "biz1"))).toBe(true);
  });

  test("different progression businesses → different team", () => {
    expect(isSameProgressingTeam(business("ag1", "biz1"), business("ag1", "biz2"))).toBe(false);
  });

  test("one run by a business, the other by TSP → different team", () => {
    expect(isSameProgressingTeam(business("ag1", "biz1"), tsp("ag1"))).toBe(false);
  });

  test("one run by a business, the other self-managed → different team", () => {
    expect(isSameProgressingTeam(business("ag1", "biz1"), selfManaged("ag1"))).toBe(false);
  });

  test("null agencies with no business and not both outsourced → different team", () => {
    expect(isSameProgressingTeam(
      { agencyId: null, progressionBusinessId: null, serviceType: "self_managed" },
      { agencyId: null, progressionBusinessId: null, serviceType: "self_managed" },
    )).toBe(false);
  });
});
