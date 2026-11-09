import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";

// Critique #295: the deposit chase (PM24) was firing for a mortgage buyer before
// their mortgage offer was in. The deposit is where the contracts chain and the
// mortgage chain converge, so it must require BOTH.
describe("deposit (PM24) prerequisites (#295)", () => {
  it("requires signed contracts (PM23) AND the mortgage offer (PM11)", () => {
    expect(DIRECT_PREREQUISITES.PM24).toEqual(expect.arrayContaining(["PM23", "PM11"]));
  });

  it("the mortgage offer sits on the mortgage chain (needs the valuation first)", () => {
    // PM24 -> PM11 -> PM6 means the deposit transitively waits on the valuation
    // and offer, so it can't unlock from the contracts side alone.
    expect(DIRECT_PREREQUISITES.PM11).toContain("PM6");
    expect(DIRECT_PREREQUISITES.PM24).toContain("PM11");
  });
});
