/**
 * @jest-environment node
 *
 * Conversation-side resolution + participant membership (Phase 0). Proves the
 * EXPLICIT role mapping (never the binary "not-vendor = purchaser" fold) and the
 * buyer-round protections: a superseded buyer never participates in the live
 * conversation; a vendor is always file-level.
 */

import { sideForRoleType, isMessagingParticipant } from "@/lib/services/messaging/side";

describe("sideForRoleType: explicit mapping", () => {
  it("maps purchaser → buyer and vendor → seller", () => {
    expect(sideForRoleType("purchaser")).toBe("buyer");
    expect(sideForRoleType("vendor")).toBe("seller");
  });

  it("returns null for every non-client role (never folds to buyer)", () => {
    for (const r of ["solicitor", "broker", "other", "", "something_else"]) {
      expect(sideForRoleType(r)).toBeNull();
    }
  });
});

describe("isMessagingParticipant", () => {
  const activeBuyer = {
    roleType: "purchaser",
    isPrincipal: true,
    portalEligible: true,
    buyerRoundId: "rNEW",
  };

  it("an active-round principal buyer with portal access participates", () => {
    expect(isMessagingParticipant(activeBuyer, "rNEW")).toBe(true);
  });

  it("a vendor is file-level and participates regardless of round", () => {
    expect(
      isMessagingParticipant(
        { roleType: "vendor", isPrincipal: true, portalEligible: true, buyerRoundId: null },
        "rNEW",
      ),
    ).toBe(true);
  });

  it("a superseded (old-round) buyer does NOT participate", () => {
    expect(isMessagingParticipant({ ...activeBuyer, buyerRoundId: "rOLD" }, "rNEW")).toBe(false);
  });

  it("a legacy null-round buyer participates (defensive, matches isActiveRoundContact)", () => {
    expect(isMessagingParticipant({ ...activeBuyer, buyerRoundId: null }, "rNEW")).toBe(true);
  });

  it("a non-principal helper is excluded", () => {
    expect(isMessagingParticipant({ ...activeBuyer, isPrincipal: false }, "rNEW")).toBe(false);
  });

  it("a portal-ineligible contact is excluded", () => {
    expect(isMessagingParticipant({ ...activeBuyer, portalEligible: false }, "rNEW")).toBe(false);
  });

  it("solicitors / brokers never participate, even if principal + eligible", () => {
    expect(isMessagingParticipant({ ...activeBuyer, roleType: "solicitor" }, "rNEW")).toBe(false);
    expect(isMessagingParticipant({ ...activeBuyer, roleType: "broker" }, "rNEW")).toBe(false);
  });
});
