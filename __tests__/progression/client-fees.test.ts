// Pure rate-card logic: pricing a sale from a fee model, and validating stored
// JSON back into a typed model.
import { calculateClientFee, parseFeeModel } from "@/lib/progression/client-fees";

describe("calculateClientFee", () => {
  it("flat charges the same fee regardless of price", () => {
    expect(calculateClientFee({ type: "flat", pence: 30000 }, 45000000)).toBe(30000);
    expect(calculateClientFee({ type: "flat", pence: 30000 }, null)).toBe(30000);
  });

  it("percent is basis points of the price", () => {
    // 0.30% of £450,000 = £1,350
    expect(calculateClientFee({ type: "percent", bps: 30 }, 45000000)).toBe(135000);
    expect(calculateClientFee({ type: "percent", bps: 30 }, null)).toBeNull();
  });

  it("tiered picks the band the price falls in (and the open top band above all)", () => {
    const m = { type: "tiered" as const, bands: [
      { uptoPence: 30000000, pence: 25000 },
      { uptoPence: 50000000, pence: 35000 },
      { uptoPence: null, pence: 55000 },
    ] };
    expect(calculateClientFee(m, 25000000)).toBe(25000); // £250k -> first band
    expect(calculateClientFee(m, 45000000)).toBe(35000); // £450k -> middle band
    expect(calculateClientFee(m, 90000000)).toBe(55000); // £900k -> open top band
  });

  it("returns null for no model", () => {
    expect(calculateClientFee(null, 100)).toBeNull();
  });
});

describe("parseFeeModel", () => {
  it("accepts valid shapes", () => {
    expect(parseFeeModel({ type: "flat", pence: 30000 })).toEqual({ type: "flat", pence: 30000 });
    expect(parseFeeModel({ type: "percent", bps: 30 })).toEqual({ type: "percent", bps: 30 });
    expect(parseFeeModel({ type: "tiered", bands: [{ uptoPence: null, pence: 500 }] }))
      .toEqual({ type: "tiered", bands: [{ uptoPence: null, pence: 500 }] });
  });

  it("rejects junk / out-of-range", () => {
    expect(parseFeeModel(null)).toBeNull();
    expect(parseFeeModel({ type: "flat" })).toBeNull();
    expect(parseFeeModel({ type: "percent", bps: 99999 })).toBeNull();
    expect(parseFeeModel({ type: "tiered", bands: [] })).toBeNull();
    expect(parseFeeModel({ type: "nope" })).toBeNull();
  });
});
