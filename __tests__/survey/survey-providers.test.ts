// Guards the fix for the surveyor-quote gate (2026-11). An outsourced-to-TSP
// file carries progressionBusinessId = null + serviceType = "outsourced"; the
// previous email-bucket gate mapped that to "free_agency" and so switched the
// TSP quote network off for every real outsourced-to-TSP sale. This pins the
// correct predicate: progressed by TSP (null OR isTsp) AND outsourced.

import { fileOffersTspProviders } from "@/lib/services/survey-providers";

describe("fileOffersTspProviders — who gets the TSP quote network", () => {
  it("outsourced to TSP (null progression business, legacy/default) → YES", () => {
    expect(fileOffersTspProviders({ serviceType: "outsourced", progressionBusinessId: null, isTsp: false })).toBe(true);
  });

  it("outsourced to TSP via the explicit isTsp business row → YES", () => {
    expect(fileOffersTspProviders({ serviceType: "outsourced", progressionBusinessId: "tsp-id", isTsp: true })).toBe(true);
  });

  it("self-managed agency (null progression business, runs its own sale) → NO", () => {
    expect(fileOffersTspProviders({ serviceType: "self_managed", progressionBusinessId: null, isTsp: false })).toBe(false);
  });

  it("self-managed even if somehow tagged to the TSP row → NO", () => {
    expect(fileOffersTspProviders({ serviceType: "self_managed", progressionBusinessId: "tsp-id", isTsp: true })).toBe(false);
  });

  it("outsourced to an EXTERNAL progression business → NO (not ours)", () => {
    expect(fileOffersTspProviders({ serviceType: "outsourced", progressionBusinessId: "ext-id", isTsp: false })).toBe(false);
  });

  it("self-managed under an external business → NO", () => {
    expect(fileOffersTspProviders({ serviceType: "self_managed", progressionBusinessId: "ext-id", isTsp: false })).toBe(false);
  });
});
