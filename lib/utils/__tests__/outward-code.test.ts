/**
 * @jest-environment node
 */

import { outwardCode } from "@/lib/utils/address";

describe("outwardCode", () => {
  test("extracts area+district from spaced UK postcodes", () => {
    expect(outwardCode("SW1A 1AA")).toBe("SW1A");
    expect(outwardCode("EN8 8AB")).toBe("EN8");
    expect(outwardCode("M14 5PP")).toBe("M14");
    expect(outwardCode("W1 1AA")).toBe("W1");
    expect(outwardCode("EC1A 1BB")).toBe("EC1A");
    expect(outwardCode("B1 1AA")).toBe("B1");
  });

  test("tolerates missing space", () => {
    expect(outwardCode("SW1A1AA")).toBe("SW1A");
    expect(outwardCode("EN88AB")).toBe("EN8");
    expect(outwardCode("M145PP")).toBe("M14");
  });

  test("is case-insensitive and uppercases the result", () => {
    expect(outwardCode("sw1a 1aa")).toBe("SW1A");
    expect(outwardCode("en8 8ab")).toBe("EN8");
    expect(outwardCode("Sw1A 1aA")).toBe("SW1A");
  });

  test("extracts the postcode from a combined address string", () => {
    expect(outwardCode("12 Made Up Road, London, SW1A 1AA")).toBe("SW1A");
    expect(outwardCode("Some Place, Manchester M14 5PP")).toBe("M14");
  });

  test("returns null on null / undefined / empty", () => {
    expect(outwardCode(null)).toBeNull();
    expect(outwardCode(undefined)).toBeNull();
    expect(outwardCode("")).toBeNull();
  });

  test("returns null when no postcode-shaped token is present", () => {
    expect(outwardCode("not a postcode")).toBeNull();
    expect(outwardCode("12345")).toBeNull();
    expect(outwardCode("ABC DEF")).toBeNull();
  });

  test("handles both formats of London postcodes", () => {
    expect(outwardCode("W1A 0AX")).toBe("W1A");
    expect(outwardCode("WC1H 9SG")).toBe("WC1H");
  });
});
