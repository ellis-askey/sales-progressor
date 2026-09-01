/**
 * @jest-environment node
 */

// Unit tests for the outsourced handover readiness gate (Resilience audit II.4).
// Pure-function tests (the codebase convention for this layer): no DB, no mocks.
// The gate is the single server-side standard applied at every accept-the-file
// point (create / self->outsourced switch / draft promote), closing the
// loophole where a thin file could be handed to the SP team unvalidated.

import {
  checkOutsourcedHandoverReadiness,
  handoverReadinessMessage,
} from "@/lib/services/handover-readiness";

const reachableVendor = { roleType: "vendor" as const, name: "Sam Seller", email: "sam@example.com" };
const reachablePurchaser = { roleType: "purchaser" as const, name: "Bea Buyer", phone: "07000 000000" };

describe("checkOutsourcedHandoverReadiness", () => {
  it("passes a fully-specified file (both sides reachable, tenure + type set)", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
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
    });
    expect(r.ready).toBe(true);
  });

  it("flags a seller with a name but no phone or email", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [{ roleType: "vendor", name: "Sam" }, reachablePurchaser],
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("a seller with a name and a phone number or email");
  });

  it("flags a contact with a channel but a blank name as unreachable", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [{ roleType: "vendor", name: "  ", email: "x@example.com" }, reachablePurchaser],
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("a seller with a name and a phone number or email");
  });

  it("flags a missing buyer entirely", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [reachableVendor],
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("a buyer with a name and a phone number or email");
  });

  it("flags missing tenure and purchase type independently", () => {
    const noTenure = checkOutsourcedHandoverReadiness({
      tenure: null,
      purchaseType: "mortgage",
      contacts: [reachableVendor, reachablePurchaser],
    });
    expect(noTenure.missing).toContain("the tenure (freehold or leasehold)");

    const noType = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: null,
      contacts: [reachableVendor, reachablePurchaser],
    });
    expect(noType.missing).toContain("the purchase type (cash or mortgage)");
  });

  it("reports every gap for a near-empty file", () => {
    const r = checkOutsourcedHandoverReadiness({ tenure: null, purchaseType: null, contacts: [] });
    expect(r.ready).toBe(false);
    expect(r.missing).toHaveLength(4);
  });

  it("does not treat a solicitor/other contact as a buyer or seller", () => {
    const r = checkOutsourcedHandoverReadiness({
      tenure: "freehold",
      purchaseType: "mortgage",
      contacts: [{ roleType: "solicitor", name: "Firm", email: "firm@example.com" }],
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
