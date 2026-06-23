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

import { detectStage, STAGE_TRIGGER_CODES, type PortalRole } from "@/lib/portal-tips";

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
