/**
 * @jest-environment node
 */

// Agency-aware chain access, added for the agency rollout (2026-09-14):
//  - canViewChain now lets the whole owning agency see a chain, not just the
//    individual who built/claimed the link (blocker 2).
//  - canManageStub (edit/remove/invite/share/photo) delegates to the intel
//    ownership model, so it's the same agency-aware rule everywhere (cleanup 3).

import { canViewChain } from "../permissions";
import { canViewNodeIntel, canEditNodeIntel, type IntelViewer, type ChainNodeOwnership } from "../intel";
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
    txProgressionBusinessId: null,
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

describe("node intel: external progression-business member bounding (Phase 2c)", () => {
  const businessScope = (id: string): AccessScope => ({ kind: "business", businessId: id });
  const assignedScope = (id: string): AccessScope => ({ kind: "assigned", userId: id });

  // A claimed node Sarah (business biz_sarah) personally progresses.
  const sarahOwnNode: ChainNodeOwnership = {
    transactionId: "tx_sarah", linkCreatedByUserId: "u_sarah", linkCreatedByAgencyId: null,
    txAgencyId: "ag_donna", txAssignedUserId: "u_sarah", txAgentUserId: "u_donna",
    txProgressionBusinessId: "biz_sarah",
  };
  // Another node in the same chain, owned by a different external business.
  const foreignNode: ChainNodeOwnership = {
    transactionId: "tx_other", linkCreatedByUserId: "u_someone", linkCreatedByAgencyId: "ag_x",
    txAgencyId: "ag_x", txAssignedUserId: "u_other", txAgentUserId: "u_x",
    txProgressionBusinessId: "biz_other",
  };
  const sarah: IntelViewer = {
    userId: "u_sarah", role: "sales_progressor", agencyId: null, scope: businessScope("biz_sarah"),
  };

  it("a business member can view AND edit intel on their own assigned node", () => {
    expect(canViewNodeIntel(sarah, sarahOwnNode)).toBe(true);
    expect(canEditNodeIntel(sarah, sarahOwnNode)).toBe(true);
  });

  it("a business member CANNOT view or edit intel on another node in the chain", () => {
    expect(canViewNodeIntel(sarah, foreignNode)).toBe(false);
    expect(canEditNodeIntel(sarah, foreignNode)).toBe(false);
  });

  it("a business member can manage only an unclaimed stub they created themselves", () => {
    const ownStub: ChainNodeOwnership = {
      transactionId: null, linkCreatedByUserId: "u_sarah", linkCreatedByAgencyId: null,
      txAgencyId: null, txAssignedUserId: null, txAgentUserId: null, txProgressionBusinessId: null,
    };
    const foreignStub: ChainNodeOwnership = {
      transactionId: null, linkCreatedByUserId: "u_other", linkCreatedByAgencyId: "ag_x",
      txAgencyId: null, txAssignedUserId: null, txAgentUserId: null, txProgressionBusinessId: null,
    };
    expect(canEditNodeIntel(sarah, ownStub)).toBe(true);
    expect(canEditNodeIntel(sarah, foreignStub)).toBe(false);
  });

  it("a TSP progressor (assigned scope) still sees intel across a chain they access (unchanged)", () => {
    const tsp: IntelViewer = {
      userId: "u_tsp", role: "sales_progressor", agencyId: null, scope: assignedScope("u_tsp"),
    };
    expect(canViewNodeIntel(tsp, sarahOwnNode)).toBe(true);
    expect(canViewNodeIntel(tsp, foreignNode)).toBe(true);
  });

  it("TSP (admin 'all') is read-only on an external business's node: can view, cannot edit", () => {
    const tspAll: IntelViewer = { userId: "u_admin", role: "admin", agencyId: null, scope: { kind: "all" } };
    // foreignNode belongs to an external business (biz_other).
    expect(canViewNodeIntel(tspAll, foreignNode)).toBe(true);   // read-only: can see it
    expect(canEditNodeIntel(tspAll, foreignNode)).toBe(false);  // but not edit it
    // A TSP / agency node (no external business) stays fully editable by TSP.
    const tspNode: ChainNodeOwnership = {
      transactionId: "tx_tsp", linkCreatedByUserId: "u_x", linkCreatedByAgencyId: "ag_x",
      txAgencyId: "ag_x", txAssignedUserId: "u_tsp", txAgentUserId: "u_x", txProgressionBusinessId: null,
    };
    expect(canEditNodeIntel(tspAll, tspNode)).toBe(true);
  });
});
