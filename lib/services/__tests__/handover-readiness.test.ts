/**
 * @jest-environment node
 */

// Unit tests for the outsourced handover readiness gate (Resilience audit II.4;
// solicitor rules added by founder decision 2026-09-18 after 28 Granville Road
// arrived outsourced with a solicitor firm and no case handler).
// Pure-function tests (the codebase convention for this layer): no DB, no mocks.
// The gate is the single server-side standard applied at every accept-the-file
// point (create / self->outsourced switch / draft promote).

import {
  checkOutsourcedHandoverReadiness,
  handoverReadinessMessage,
  solicitorPairViolation,
  solicitorHandlerRequiredMessage,
} from "@/lib/services/handover-readiness";

const reachableVendor = { roleType: "vendor" as const, name: "Sam Seller", email: "sam@example.com" };
const reachablePurchaser = { roleType: "purchaser" as const, name: "Bea Buyer", phone: "07000 000000" };
// Both solicitors fully set up: firm + named case handler on each side.
const solicitorsOk = {
  vendorSolicitorFirmId: "firm-v",
  vendorSolicitorContactId: "handler-v",
  purchaserSolicitorFirmId: "firm-p",
  purchaserSolicitorContactId: "handler-p",
};

describe("checkOutsourcedHandoverReadiness", () => {
  it("passes a fully-specified file (reachable sides, tenure + type, both solicitors complete)", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
      ...solicitorsOk,
    });
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("accepts phone-only or email-only as a valid channel", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "leasehold",
      purchaseType: "cash_buyer",
      contacts: [
        { roleType: "vendor", name: "Sam", phone: "07000 000000" }, // phone only
        { roleType: "purchaser", name: "Bea", email: "bea@example.com" }, // email only
      ],
      ...solicitorsOk,
    });
    expect(r.ready).toBe(true);
  });

  it("flags a seller with a name but no phone or email", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [{ roleType: "vendor", name: "Sam" }, reachablePurchaser],
      ...solicitorsOk,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("a seller with a name and a phone number or email");
  });

  it("flags a contact with a channel but a blank name as unreachable", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [{ roleType: "vendor", name: "  ", email: "x@example.com" }, reachablePurchaser],
      ...solicitorsOk,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("a seller with a name and a phone number or email");
  });

  it("flags a missing buyer entirely", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor],
      ...solicitorsOk,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("a buyer with a name and a phone number or email");
  });

  it("flags missing tenure and purchase type independently", () => {
    const noTenure = checkOutsourcedHandoverReadiness({
      tenure: null,
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
      ...solicitorsOk,
    });
    expect(noTenure.missing).toContain("the tenure (freehold or leasehold)");

    const noType = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: null,
      contacts: [reachableVendor, reachablePurchaser],
      ...solicitorsOk,
    });
    expect(noType.missing).toContain("the purchase type (cash or mortgage)");
  });

  // ── Solicitor rules (founder decision 2026-09-18) ─────────────────────────

  it("blocks a firm with no named case handler on the seller side (28 Granville Road)", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "leasehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
      ...solicitorsOk,
      vendorSolicitorContactId: null, // firm attached, nobody named
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("the seller's solicitor firm and their named case handler");
  });

  it("blocks a missing solicitor entirely on the buyer side", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
      ...solicitorsOk,
      purchaserSolicitorFirmId: null,
      purchaserSolicitorContactId: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("the buyer's solicitor firm and their named case handler");
  });

  it("a memo of sale does NOT substitute for solicitor setup (old shortcut removed)", () => {
    // The pre-2026-09-18 agent-handover variant accepted a memo on file in
    // place of solicitors. The memo is how 28 Granville Road slipped through;
    // there is deliberately no memo input on the standard any more.
    const r = checkOutsourcedHandoverReadiness({
      tenure: "leasehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
      vendorSolicitorFirmId: "firm-v",
      vendorSolicitorContactId: null,
      purchaserSolicitorFirmId: "firm-p",
      purchaserSolicitorContactId: "handler-p",
    });
    expect(r.ready).toBe(false);
  });

  it("reports every gap for a near-empty file", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: null,
      purchaseType: null,
      contacts: [],
      vendorSolicitorFirmId: null,
      vendorSolicitorContactId: null,
      purchaserSolicitorFirmId: null,
      purchaserSolicitorContactId: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toHaveLength(6);
  });

  it("does not treat a solicitor/other contact as a buyer or seller", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [{ roleType: "solicitor", name: "Firm", email: "firm@example.com" }],
      ...solicitorsOk,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toHaveLength(2); // both buyer and seller missing
  });

  it("builds a readable message listing the gaps", () => {
    const msg = handoverReadinessMessage(["a buyer with a name and a phone number or email", "the tenure (freehold or leasehold)"]);
    expect(msg).toContain("can't be handed to the progressor team yet");
    expect(msg).toContain("a buyer");
    expect(msg).toContain("the tenure");
  });
});

// Universal invariant: a firm may never be attached without a named handler,
// on ANY service type. (No solicitor at all is fine on self-managed files.)
describe("solicitorPairViolation", () => {
  it("flags firm-without-handler", () => {
    expect(solicitorPairViolation("firm-1", null)).toBe(true);
    expect(solicitorPairViolation("firm-1", undefined)).toBe(true);
  });

  it("allows no solicitor at all, and a complete pair", () => {
    expect(solicitorPairViolation(null, null)).toBe(false);
    expect(solicitorPairViolation(undefined, undefined)).toBe(false);
    expect(solicitorPairViolation("firm-1", "handler-1")).toBe(false);
  });

  it("message names the side and the rule", () => {
    expect(solicitorHandlerRequiredMessage("seller")).toContain("seller's solicitor");
    expect(solicitorHandlerRequiredMessage("buyer")).toContain("named case handler");
  });
});
