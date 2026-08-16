/**
 * Build-time sanity check for lib/portal-tips.ts.
 *
 * The previous portal-tips file pointed detectStage at mid-enquiries
 * milestone codes (VM12/VM13/PM16/PM17) believing they were the exchange
 * and completion codes. They had been renumbered when the schema grew
 * from ~13 to 47 milestones, but portal-tips was never updated, so
 * 16 prod files were silently telling customers they were "legally
 * committed" or "completed" mid-flow. Surfaced + fixed 2026-06-19.
 *
 * This test fails noisily if anyone changes the codes that detectStage
 * relies on without re-anchoring them to the actual milestone schema.
 * Keep CANONICAL_SCHEMA_CODES in lock-step with prisma/schema.prisma's
 * MilestoneDefinition seed data (or the live DB if you query it).
 *
 * Plus a behavioural check: feed detectStage realistic milestone snapshots
 * and assert the right stage comes back.
 *
 * 2026-08-16: pre_exchange now triggers at "all enquiries satisfied"
 * (VM21/PM20) rather than "solicitor ready to exchange" (VM18/PM25), and
 * the tip pool was rewritten. Trigger codes + tip regexes updated to match.
 */

import { detectStage, getStageTips, STAGE_TRIGGER_CODES, type PortalRole } from "@/lib/portal-tips";

// Codes the portal-tips file relies on must all be real milestone codes.
const CANONICAL_SCHEMA_CODES = new Set([
  "VM1", "VM10", "VM21", "VM19", "VM20",
  "PM1", "PM14", "PM20", "PM26", "PM27",
]);

describe("portal-tips STAGE_TRIGGER_CODES", () => {
  it("every code referenced is a real milestone code", () => {
    const referenced = new Set<string>();
    for (const trigger of Object.values(STAGE_TRIGGER_CODES)) {
      referenced.add(trigger.vendor);
      referenced.add(trigger.purchaser);
    }
    const unknown = [...referenced].filter((c) => !CANONICAL_SCHEMA_CODES.has(c));
    expect(unknown).toEqual([]);
  });

  it("vendor and purchaser codes are kept distinct (catches paste errors)", () => {
    for (const [name, trigger] of Object.entries(STAGE_TRIGGER_CODES)) {
      expect(trigger.vendor).not.toBe(trigger.purchaser);
      expect(trigger.vendor.startsWith("VM")).toBe(true);
      expect(trigger.purchaser.startsWith("PM")).toBe(true);
      expect(trigger.vendor).toMatch(/^VM\d+$/);
      expect(trigger.purchaser).toMatch(/^PM\d+$/);
      if (!trigger.vendor.match(/^VM\d+$/)) throw new Error(`Bad vendor code in ${name}: ${trigger.vendor}`);
    }
  });
});

describe("portal-tips detectStage", () => {
  const mk = (codes: string[]) => codes.map((code) => ({ code, isComplete: true }));

  test.each<[PortalRole, string[], string]>([
    ["vendor",    [],                                       "onboarding"],
    ["purchaser", [],                                       "onboarding"],
    // Only instruction done
    ["vendor",    ["VM1"],                                  "early"],
    ["purchaser", ["PM1"],                                  "early"],
    // Enquiries actually started
    ["vendor",    ["VM1", "VM10"],                          "active"],
    ["purchaser", ["PM1", "PM14"],                          "active"],
    // All enquiries satisfied → pre_exchange (retriggered 2026-08-16)
    ["vendor",    ["VM1", "VM10", "VM21"],                  "pre_exchange"],
    ["purchaser", ["PM1", "PM14", "PM20"],                  "pre_exchange"],
    // Contracts have actually exchanged
    ["vendor",    ["VM1", "VM10", "VM21", "VM19"],          "exchanged"],
    ["purchaser", ["PM1", "PM14", "PM20", "PM26"],          "exchanged"],
    // Sale has completed
    ["vendor",    ["VM1", "VM10", "VM21", "VM19", "VM20"],  "completed"],
    ["purchaser", ["PM1", "PM14", "PM20", "PM26", "PM27"],  "completed"],
    // Regression: mid-enquiries codes must NOT trigger a later stage.
    ["vendor",    ["VM1", "VM10", "VM12", "VM13"],          "active"],
    ["purchaser", ["PM1", "PM14", "PM16", "PM17"],          "active"],
  ])("%s with %j → %s", (side, codes, expected) => {
    expect(detectStage(mk(codes), side)).toBe(expected);
  });

  it("vendor and purchaser stages are evaluated independently", () => {
    // Vendor's enquiries satisfied, purchaser still just instructed
    const ms = mk(["VM1", "VM10", "VM21", "PM1"]);
    expect(detectStage(ms, "vendor")).toBe("pre_exchange");
    expect(detectStage(ms, "purchaser")).toBe("early");
  });
});

describe("portal-tips per-tip milestone filtering", () => {
  const token = "test-token";
  // Gather every tip text a stage would surface across many tokens (so the
  // weekly rotation offset never hides a tip we're asserting on).
  const allTexts = (stage: Parameters<typeof getStageTips>[0], side: PortalRole, done: Set<string>) => {
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      for (const tip of getStageTips(stage, side, t, done)) seen.add(tip.text);
    }
    return [...seen].join("\n");
  };

  // ── Lender valuation (early, purchaser): requires PM5, hide PM6/PM11 ──
  it("shows the lender-valuation tip after PM5 but before PM6", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1", "PM5"]))).toMatch(/lender will usually arrange a valuation/i);
  });
  it("hides the lender-valuation tip before PM5 is submitted", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1"]))).not.toMatch(/lender will usually arrange a valuation/i);
  });
  it("hides the lender-valuation tip once PM6 is booked", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1", "PM5", "PM6"]))).not.toMatch(/lender will usually arrange a valuation/i);
  });
  it("hides the lender-valuation tip once PM11 offer is received (defensive)", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1", "PM5", "PM11"]))).not.toMatch(/lender will usually arrange a valuation/i);
  });

  // ── Searches (early, purchaser): requires PM8, hide PM13 ──
  it("shows the searches tip after PM8 but before PM13", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1", "PM8"]))).toMatch(/ordered searches with the relevant authorities/i);
  });
  it("hides the searches tip before PM8 is ordered", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1"]))).not.toMatch(/ordered searches with the relevant authorities/i);
  });
  it("hides the searches tip once PM13 results are in", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1", "PM8", "PM13"]))).not.toMatch(/ordered searches with the relevant authorities/i);
  });

  // ── Survey (early, purchaser): hide PM9 (booked OR opted out) ──
  it("hides the survey tip once PM9 is done (booked or marked not required)", () => {
    expect(allTexts("early", "purchaser", new Set(["PM1", "PM9"]))).not.toMatch(/substitute for your own survey/i);
  });

  // ── Management pack (early, vendor): requires VM8, hide VM9 ──
  it("hides the management-pack tip before VM8 is requested", () => {
    expect(allTexts("early", "vendor", new Set(["VM1"]))).not.toMatch(/requested the required management information/i);
  });
  it("shows the management-pack tip after VM8 but before VM9", () => {
    expect(allTexts("early", "vendor", new Set(["VM1", "VM8"]))).toMatch(/requested the required management information/i);
  });

  // ── Mortgage finalising (active, purchaser): requires PM6, hide PM11 ──
  it("hides the mortgage-finalising tip before PM6 valuation", () => {
    expect(allTexts("active", "purchaser", new Set(["PM1", "PM14"]))).not.toMatch(/underwriting or other checks/i);
  });
  it("shows the mortgage-finalising tip after PM6 but before PM11", () => {
    expect(allTexts("active", "purchaser", new Set(["PM1", "PM6", "PM14"]))).toMatch(/underwriting or other checks/i);
  });

  // ── Sign contract (pre_exchange, vendor): requires VM16, hide VM17 ──
  it("shows the seller sign-contract tip once VM16 is issued", () => {
    expect(allTexts("pre_exchange", "vendor", new Set(["VM21", "VM16"]))).toMatch(/documents that need signing/i);
  });
  it("hides the seller sign-contract tip once VM17 is returned", () => {
    expect(allTexts("pre_exchange", "vendor", new Set(["VM21", "VM16", "VM17"]))).not.toMatch(/documents that need signing/i);
  });

  // ── Fallback: unconditional tips always survive gating ──
  it("keeps the unconditional 'not legally committed' tip when everything else is gated out", () => {
    const done = new Set(["PM3", "PM5"]); // gates every conditional onboarding purchaser tip
    const tips = getStageTips("onboarding", "purchaser", token, done);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.some((t) => /memorandum of sale records the agreed transaction/i.test(t.text))).toBe(true);
  });
});
