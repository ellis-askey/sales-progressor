/**
 * @jest-environment node
 */

// Agency-aware chain access, added for the agency rollout (2026-09-14):
//  - canViewChain now lets the whole owning agency see a chain, not just the
//    individual who built/claimed the link (blocker 2).
//  - canManageStub (edit/remove/invite/share/photo) delegates to the intel
//    ownership model, so it's the same agency-aware rule everywhere (cleanup 3).

import { canViewChain } from "../permissions";
import { canEditNodeIntel, type IntelViewer, type ChainNodeOwnership } from "../intel";
import type { AccessScope } from "@/lib/security/access-scope";

const agencyScope = (id: string): AccessScope => ({ kind: "agency", agencyIds: [id] });

describe("canViewChain: agency-wide participation", () => {
  // Agency A owns the claimed file (its link) built/claimed by negotiator neg1,
  // plus an unclaimed stub A added for the flat above.
  const links = [
    { claimedByUserId: "neg1", createdByUserId: "neg1", txAgencyId: "agencyA" },
    { claimedByUserId: null, createdByUserId: "neg1", txAgencyId: null },
  ];

  it("lets a director in the owning agency see a chain their negotiator built", () => {
    expect(canViewChain(links, "director1", "director", "agencyA")).toBe(true);
  });

  it("keeps a different agency out", () => {
    expect(canViewChain(links, "outsider", "director", "agencyB")).toBe(false);
  });

  it("still lets the individual participant in (person-based path)", () => {
    expect(canViewChain(links, "neg1", "negotiator", "agencyA")).toBe(true);
  });

  it("internal staff bypass regardless of agency", () => {
    expect(canViewChain(links, "sp1", "sales_progressor", null)).toBe(true);
  });

  it("a non-participant with no matching agency is refused", () => {
    expect(canViewChain(links, "nobody", "negotiator", "agencyB")).toBe(false);
  });

  it("omitting viewerAgencyId keeps the old person-only behaviour", () => {
    expect(canViewChain(links, "neg1", "negotiator")).toBe(true);
    expect(canViewChain(links, "director1", "director")).toBe(false);
  });
});

describe("canEditNodeIntel: unclaimed stub (the rule canManageStub uses)", () => {
  const unclaimedStub = (creatorId: string, creatorAgency: string): ChainNodeOwnership => ({
    transactionId: null,
    linkCreatedByUserId: creatorId,
    linkCreatedByAgencyId: creatorAgency,
    txAgencyId: null,
    txAssignedUserId: null,
    txAgentUserId: null,
  });

  it("allows the stub's creator", () => {
    const v: IntelViewer = { userId: "neg1", role: "negotiator", agencyId: "agencyA", scope: agencyScope("agencyA") };
    expect(canEditNodeIntel(v, unclaimedStub("neg1", "agencyA"))).toBe(true);
  });

  it("allows a director in the creating agency who didn't add it", () => {
    const v: IntelViewer = { userId: "dir1", role: "director", agencyId: "agencyA", scope: agencyScope("agencyA") };
    expect(canEditNodeIntel(v, unclaimedStub("neg1", "agencyA"))).toBe(true);
  });

  it("blocks a director in a different agency", () => {
    const v: IntelViewer = { userId: "dir2", role: "director", agencyId: "agencyB", scope: agencyScope("agencyB") };
    expect(canEditNodeIntel(v, unclaimedStub("neg1", "agencyA"))).toBe(false);
  });

  it("blocks a non-creator negotiator in the same agency", () => {
    const v: IntelViewer = { userId: "neg2", role: "negotiator", agencyId: "agencyA", scope: agencyScope("agencyA") };
    expect(canEditNodeIntel(v, unclaimedStub("neg1", "agencyA"))).toBe(false);
  });
});
