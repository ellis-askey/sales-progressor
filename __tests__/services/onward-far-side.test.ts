// Chain far-side (agent-only) tracker kinds — config + availability.
// See docs/active/chain-far-side/SPEC.md.
// Pure: only imports the config + the pure availability fn (no DB calls made).
// prisma is mocked so importing the service doesn't construct a real client.

jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DIRECTION, NEAR_SIBLING, computeOnwardStepAvailability } from "@/lib/services/onward";

describe("far-side DIRECTION config", () => {
  it("adds the two far-side kinds, flipped to the other side", () => {
    // Onward purchase's far side = the onward SELLER (vendor/VM).
    expect(DIRECTION.onward_purchase_seller.side).toBe("vendor");
    expect(DIRECTION.onward_purchase_seller.prefix).toBe("VM");
    expect(DIRECTION.onward_purchase_seller.exchangeCode).toBe("VM19");
    expect(DIRECTION.onward_purchase_seller.completionCode).toBe("VM20");
    expect(DIRECTION.onward_purchase_seller.requiresPurchaseType).toBe(false);
    // Chain completes as one → its completion is gated on our own VM20.
    expect(DIRECTION.onward_purchase_seller.completionGateOurCode).toBe("VM20");

    // Related sale's far side = the related BUYER (purchaser/PM).
    expect(DIRECTION.related_sale_buyer.side).toBe("purchaser");
    expect(DIRECTION.related_sale_buyer.prefix).toBe("PM");
    expect(DIRECTION.related_sale_buyer.exchangeCode).toBe("PM26");
    expect(DIRECTION.related_sale_buyer.completionCode).toBe("PM27");
    expect(DIRECTION.related_sale_buyer.requiresPurchaseType).toBe(true);
  });

  it("maps each far side back to its near sibling (same property)", () => {
    expect(NEAR_SIBLING.onward_purchase_seller).toBe("onward_purchase");
    expect(NEAR_SIBLING.related_sale_buyer).toBe("related_sale");
    // Near sides are not far sides.
    expect(NEAR_SIBLING.onward_purchase).toBeUndefined();
    expect(NEAR_SIBLING.related_sale).toBeUndefined();
  });
});

describe("availability on a vendor (VM) far side", () => {
  // VM1 (first step, no prereqs) + the exchange gate VM18 + one other
  // exchange-blocking step VM17. Gate logic is config-driven (not graph-driven).
  const defs = [
    { code: "VM1", name: "Instruct solicitor", orderIndex: 1, blocksExchange: false, eventDateRequired: false },
    { code: "VM17", name: "Sign and return contract", orderIndex: 17, blocksExchange: true, eventDateRequired: false },
    { code: "VM18", name: "Ready to exchange", orderIndex: 18, blocksExchange: true, eventDateRequired: false },
  ];

  it("unlocks the first step, and keeps the exchange gate locked until its blockers are reported", () => {
    const dir = DIRECTION.onward_purchase_seller;
    const none = computeOnwardStepAvailability(defs, new Set(), new Set(), dir);
    expect(none.get("VM1")).toBe(true); // no prereqs → available
    // The gate (VM18) is blocked while another exchange-blocking step (VM17) is unreported.
    expect(none.get("VM18")).toBe(false);

    const afterVm17 = computeOnwardStepAvailability(defs, new Set(), new Set(["VM17"]), dir);
    expect(afterVm17.get("VM18")).toBe(true); // all blockers done → gate opens
  });
});
