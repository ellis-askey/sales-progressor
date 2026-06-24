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
 */

import { detectStage, getStageTips, STAGE_TRIGGER_CODES, type PortalRole } from "@/lib/portal-tips";

// Codes the portal-tips file relies on must all be real milestone codes.
// This is a subset of the full 47-code canonical schema (we only care
// about the ones detectStage references). If a future schema change
// renames any of these, update both portal-tips.ts AND this allowlist.
const CANONICAL_SCHEMA_CODES = new Set([
  "VM1", "VM10", "VM18", "VM19", "VM20",
  "PM1", "PM14", "PM25", "PM26", "PM27",
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
      // Codes can never accidentally be empty / null / undefined
      expect(trigger.vendor).toMatch(/^VM\d+$/);
      expect(trigger.purchaser).toMatch(/^PM\d+$/);
      // Help the failure message if a regex slips
      if (!trigger.vendor.match(/^VM\d+$/)) throw new Error(`Bad vendor code in ${name}: ${trigger.vendor}`);
    }
  });
});

describe("portal-tips detectStage", () => {
  const mk = (codes: string[]) => codes.map((code) => ({ code, isComplete: true }));

  test.each<[PortalRole, string[], string]>([
    // No milestones done at all
    ["vendor",    [],                               "onboarding"],
    ["purchaser", [],                               "onboarding"],
    // Only instruction done
    ["vendor",    ["VM1"],                          "early"],
    ["purchaser", ["PM1"],                          "early"],
    // Enquiries actually started
    ["vendor",    ["VM1", "VM10"],                  "active"],
    ["purchaser", ["PM1", "PM14"],                  "active"],
    // Solicitor confirms ready to exchange
    ["vendor",    ["VM1", "VM10", "VM18"],          "pre_exchange"],
    ["purchaser", ["PM1", "PM14", "PM25"],          "pre_exchange"],
    // Contracts have actually exchanged
    ["vendor",    ["VM1", "VM10", "VM18", "VM19"],         "exchanged"],
    ["purchaser", ["PM1", "PM14", "PM25", "PM26"],         "exchanged"],
    // Sale has completed
    ["vendor",    ["VM1", "VM10", "VM18", "VM19", "VM20"], "completed"],
    ["purchaser", ["PM1", "PM14", "PM25", "PM26", "PM27"], "completed"],
    // Regression: mid-enquiries codes must NOT trigger exchanged/completed,
    // which is exactly the bug that surfaced on 22a Main Road South,
    // Dagnall (2026-06-19) — VM12/VM13/PM16/PM17 confirmed mid-flow used
    // to be read as "exchanged" / "completed".
    ["vendor",    ["VM1", "VM10", "VM12", "VM13"],         "active"],
    ["purchaser", ["PM1", "PM14", "PM16", "PM17"],         "active"],
  ])("%s with %j → %s", (side, codes, expected) => {
    expect(detectStage(mk(codes), side)).toBe(expected);
  });

  it("vendor and purchaser stages are evaluated independently", () => {
    // Vendor ready to exchange, purchaser still just instructed
    const ms = mk(["VM1", "VM10", "VM18", "PM1"]);
    expect(detectStage(ms, "vendor")).toBe("pre_exchange");
    expect(detectStage(ms, "purchaser")).toBe("early");
  });
});

describe("portal-tips per-tip milestone filtering", () => {
  // Stable token so the picked-offset is deterministic across runs.
  const token = "test-token";

  it("hides the lender-valuation tip once PM6 is complete (the 2026-06-19 bug)", () => {
    // Purchaser in "early" stage with PM5 + PM6 (lender valuation booked)
    // done. The lender-valuation tip carries hideOnceDone: ["PM6", "PM11"]
    // and must not appear in the picked output.
    const done = new Set(["PM1", "PM5", "PM6"]);
    const tips = getStageTips("early", "purchaser", token, done);
    const texts = tips.map((t) => t.text).join("\n");
    expect(texts).not.toMatch(/mortgage lender will book a valuation/i);
  });

  it("hides the lender-valuation tip once PM11 (mortgage offer) is complete (defensive)", () => {
    // Defensive case: PM11 received but PM6 not on record. The tip
    // still hides because hideOnceDone includes PM11.
    const done = new Set(["PM1", "PM5", "PM11"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "purchaser", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /mortgage lender will book a valuation/i.test(s))).toBe(false);
  });

  it("shows the lender-valuation tip after PM5 but before PM6", () => {
    // PM5 is now a requires precondition. PM5 done, PM6 not done → tip visible.
    const done = new Set(["PM1", "PM5"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "purchaser", t, done)) {
        seen.add(tip.text);
      }
    }
    expect([...seen].some((s) => /mortgage lender will book a valuation/i.test(s))).toBe(true);
  });

  it("hides the lender-valuation tip when PM5 not yet submitted (2026-06-24 audit)", () => {
    // requires: ["PM5"] — without mortgage submitted, the tip pre-empts
    // the lender process and must not fire.
    const done = new Set(["PM1"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "purchaser", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /mortgage lender will book a valuation/i.test(s))).toBe(false);
  });

  it("hides the searches tip once PM13 (search results received) is done", () => {
    // PM8 done (precondition) + PM13 done (stale).
    const done = new Set(["PM1", "PM8", "PM13"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "purchaser", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /Searches are ordered by your solicitor/i.test(s))).toBe(false);
  });

  it("hides the searches tip when PM8 not yet ordered (2026-06-24 audit)", () => {
    // requires: ["PM8"] — without searches actually ordered, "Searches
    // are ordered" must not be claimed.
    const done = new Set(["PM1"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "purchaser", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /Searches are ordered by your solicitor/i.test(s))).toBe(false);
  });

  it("hides the management-pack tip when VM8 not yet requested (2026-06-24 audit)", () => {
    // requires: ["VM8"] — without the request actually made, "has been
    // requested" must not be claimed.
    const done = new Set(["VM1"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "vendor", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /management pack has been requested/i.test(s))).toBe(false);
  });

  it("shows the management-pack tip after VM8 requested but before VM9 received", () => {
    const done = new Set(["VM1", "VM8"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("early", "vendor", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /management pack has been requested/i.test(s))).toBe(true);
  });

  it("hides the vendor 'contract to sign' tip on VM16 (issued, not VM17 signed-back)", () => {
    // The tip says "will send you the contract to sign". Once VM16 fires
    // (contract issued to seller), the "will send" claim is stale.
    const done = new Set(["VM1", "VM10", "VM18", "VM16"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f"]) {
      for (const tip of getStageTips("pre_exchange", "vendor", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /will send you the contract to sign/i.test(s))).toBe(false);
  });

  it("requires PM6 before the mortgage-offer tip appears", () => {
    // Active stage. The mortgage-offer tip carries requires: ["PM6"].
    // Without PM6, it must never show.
    const done = new Set(["PM1", "PM14"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      for (const tip of getStageTips("active", "purchaser", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /mortgage offer should follow/i.test(s))).toBe(false);
  });

  it("shows the mortgage-offer tip once PM6 is complete and PM11 is not", () => {
    const done = new Set(["PM1", "PM6", "PM14"]);
    const seen = new Set<string>();
    for (const t of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      for (const tip of getStageTips("active", "purchaser", t, done)) seen.add(tip.text);
    }
    expect([...seen].some((s) => /mortgage offer should follow/i.test(s))).toBe(true);
  });

  it("falls back to empty when every tip in the pool is filtered out", () => {
    // Purchaser onboarding pool has 3 'both' + 1 'purchaser' tips with
    // hideOnceDone of [VM3,PM3], [VM4,PM3], (none), [PM5]. Mark PM3 + PM5
    // done and the only survivor is tip 3 (general framing). Still
    // returns something — true empty only happens if even the
    // unconditional tips get gated, which today's pool doesn't allow.
    const done = new Set(["PM3", "PM5"]);
    const tips = getStageTips("onboarding", "purchaser", token, done);
    expect(tips.length).toBeGreaterThan(0);
    // The unconditional "memo of sale not binding" tip must be among them.
    expect(tips.some((t) => /memorandum of sale is not a binding contract/i.test(t.text))).toBe(true);
  });
});
