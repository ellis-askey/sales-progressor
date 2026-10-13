import { computeAutoNrCodes, FREEHOLD_NR_CODES } from "../../milestone-auto-nr";

// The managed-freehold rule: a freehold that still has a management pack keeps
// the pack steps (VM8/VM9/PM12) live, instead of auto-NR-ing them.
describe("computeAutoNrCodes — management pack", () => {
  test("ordinary freehold auto-NRs the pack steps", () => {
    const codes = computeAutoNrCodes("mortgage", "freehold");
    for (const c of FREEHOLD_NR_CODES) expect(codes.has(c)).toBe(true);
  });

  test("managed freehold (hasManagementPack) keeps the pack steps live", () => {
    const codes = computeAutoNrCodes("mortgage", "freehold", true);
    for (const c of FREEHOLD_NR_CODES) expect(codes.has(c)).toBe(false);
  });

  test("leasehold never NRs the pack steps, and the flag is irrelevant there", () => {
    expect(computeAutoNrCodes("mortgage", "leasehold").size).toBe(0);
    expect(computeAutoNrCodes("mortgage", "leasehold", true).size).toBe(0);
  });

  test("the managed flag doesn't disturb the cash-buyer mortgage NRs", () => {
    const codes = computeAutoNrCodes("cash_buyer", "freehold", true);
    // mortgage steps still NR for a cash buyer...
    expect(codes.has("PM5")).toBe(true);
    expect(codes.has("PM6")).toBe(true);
    expect(codes.has("PM11")).toBe(true);
    // ...but the pack steps stay live because it's a managed freehold.
    expect(codes.has("VM8")).toBe(false);
    expect(codes.has("VM9")).toBe(false);
    expect(codes.has("PM12")).toBe(false);
  });

  test("default (no flag) matches ordinary-freehold behaviour", () => {
    const withDefault = computeAutoNrCodes("mortgage", "freehold");
    const withExplicitFalse = computeAutoNrCodes("mortgage", "freehold", false);
    expect([...withDefault].sort()).toEqual([...withExplicitFalse].sort());
  });
});
