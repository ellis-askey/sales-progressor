/**
 * @jest-environment node
 */

// Unit tests for the fee engine (lib/billing/fee.ts) — the single source of
// truth for "what do we charge for an exchanged file?". Locks in the 2026-08
// pricing model: self-progress is free (£0), outsourced bands unchanged.

import { computeFee } from "@/lib/billing/fee";
import { PRICING_VERSION_FLAT_FIFTY, CURRENT_PRICING_VERSION } from "@/lib/billing/pricing-version";

describe("computeFee — self-progress is free", () => {
  test("self_managed is always £0, regardless of sale price", () => {
    for (const price of [null, 0, 250_000_00, 425_000_00, 1_500_000_00]) {
      const fee = computeFee("self_managed", price);
      expect(fee.totalPence).toBe(0);
      expect(fee.amountPence).toBe(0);
      expect(fee.vatPence).toBe(0);
      expect(fee.kind).toBe("in_house_fee");
    }
  });

  test("self_managed stays £0 even for a legacy-tier agency", () => {
    const fee = computeFee("self_managed", 400_000_00, null, {
      feeTier: "legacy",
      legacyOutsourcedFeePence: 20_000,
    });
    expect(fee.totalPence).toBe(0);
  });
});

describe("computeFee — outsourced bands unchanged", () => {
  test("under £350,000 → £250", () => {
    expect(computeFee("outsourced", 349_999_00).totalPence).toBe(25_000);
  });
  test("£350,000 to £499,999 → £300", () => {
    expect(computeFee("outsourced", 350_000_00).totalPence).toBe(30_000);
    expect(computeFee("outsourced", 499_999_00).totalPence).toBe(30_000);
  });
  test("£500,000 and above → £350", () => {
    expect(computeFee("outsourced", 500_000_00).totalPence).toBe(35_000);
    expect(computeFee("outsourced", 2_000_000_00).totalPence).toBe(35_000);
  });
  test("null price defends to the bottom band", () => {
    expect(computeFee("outsourced", null).totalPence).toBe(25_000);
  });
});

describe("computeFee — legacy outsourced override", () => {
  test("flat legacy fee replaces the sliding scale for outsourced", () => {
    const fee = computeFee("outsourced", 600_000_00, null, {
      feeTier: "legacy",
      legacyOutsourcedFeePence: 18_000,
    });
    expect(fee.totalPence).toBe(18_000);
    expect(fee.kind).toBe("outsourced_fee");
  });

  test("legacy tier with a null fee falls back to the sliding scale (never bricks)", () => {
    const fee = computeFee("outsourced", 600_000_00, null, {
      feeTier: "legacy",
      legacyOutsourcedFeePence: null,
    });
    expect(fee.totalPence).toBe(35_000);
  });
});

describe("computeFee — flat £50 per exchange (outsourced-sunset model)", () => {
  test("flat-fifty version is £50, regardless of service type or price", () => {
    for (const price of [null, 0, 250_000_00, 425_000_00, 1_500_000_00]) {
      const selfFee = computeFee("self_managed", price, null, null, PRICING_VERSION_FLAT_FIFTY);
      expect(selfFee.totalPence).toBe(5_000);
      expect(selfFee.kind).toBe("in_house_fee");
      expect(selfFee.bandLabel).toBe("Per exchange");
      // Even an outsourced-typed file on the flat version is £50 (no bands).
      expect(computeFee("outsourced", price, null, null, PRICING_VERSION_FLAT_FIFTY).totalPence).toBe(5_000);
    }
  });

  test("flat-fifty ignores the legacy fee-tier override", () => {
    const fee = computeFee("outsourced", 600_000_00, null, { feeTier: "legacy", legacyOutsourcedFeePence: 18_000 }, PRICING_VERSION_FLAT_FIFTY);
    expect(fee.totalPence).toBe(5_000);
  });

  test("flat-fifty splits VAT like any other fee when registered", () => {
    const fee = computeFee("self_managed", 400_000_00, { vatRegisteredAt: new Date("2027-01-01T00:00:00Z"), vatRateBps: 2000 }, null, PRICING_VERSION_FLAT_FIFTY);
    expect(fee.totalPence).toBe(5_000);
    expect(fee.amountPence).toBe(4_167); // round(5000 / 1.2)
    expect(fee.vatPence).toBe(833);
    expect(fee.amountPence + fee.vatPence).toBe(fee.totalPence);
  });

  test("the current (pre-flip) version is unaffected — self-progress stays £0", () => {
    expect(computeFee("self_managed", 400_000_00, null, null, CURRENT_PRICING_VERSION).totalPence).toBe(0);
    expect(computeFee("outsourced", 400_000_00, null, null, CURRENT_PRICING_VERSION).totalPence).toBe(30_000);
  });
});

describe("computeFee — VAT split", () => {
  test("not registered → whole amount, zero VAT", () => {
    const fee = computeFee("outsourced", 400_000_00, { vatRegisteredAt: null, vatRateBps: null });
    expect(fee.amountPence).toBe(30_000);
    expect(fee.vatPence).toBe(0);
    expect(fee.totalPence).toBe(30_000);
  });

  test("registered at 20% → gross unchanged, split into ex-VAT + VAT", () => {
    const fee = computeFee("outsourced", 400_000_00, { vatRegisteredAt: new Date("2026-01-01T00:00:00Z"), vatRateBps: 2000 });
    expect(fee.totalPence).toBe(30_000);
    expect(fee.amountPence).toBe(25_000); // round(30000 / 1.2)
    expect(fee.vatPence).toBe(5_000);
    expect(fee.amountPence + fee.vatPence).toBe(fee.totalPence);
  });

  test("a free self-managed file splits to all zeroes even when VAT-registered", () => {
    const fee = computeFee("self_managed", 400_000_00, { vatRegisteredAt: new Date("2026-01-01T00:00:00Z"), vatRateBps: 2000 });
    expect(fee.totalPence).toBe(0);
    expect(fee.amountPence).toBe(0);
    expect(fee.vatPence).toBe(0);
  });
});
