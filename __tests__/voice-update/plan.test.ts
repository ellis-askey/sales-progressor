/**
 * @jest-environment node
 *
 * The voice-note planner: a detected late milestone pulls in its incomplete
 * prerequisites (the earlier steps that must be true for it to hold), dropping
 * anything already done or not applicable to the file.
 */
import { collectPrereqCodes, buildMilestonePlan, type MilestoneRowLite } from "@/lib/voice-update/plan";

function row(code: string, orderIndex: number, over: Partial<MilestoneRowLite> = {}): MilestoneRowLite {
  return { code, name: code, side: "purchaser", orderIndex, eventDateRequired: false, isComplete: false, isNotRequired: false, ...over };
}

describe("collectPrereqCodes", () => {
  it("walks the real chain for PM11 (offer → valuation → application)", () => {
    const got = collectPrereqCodes("PM11").sort();
    expect(got).toEqual(["PM5", "PM6"]);
  });
  it("returns nothing for a root step", () => {
    expect(collectPrereqCodes("PM5")).toEqual([]);
  });
});

describe("buildMilestonePlan", () => {
  const rows = [
    row("PM5", 5),
    row("PM6", 6, { eventDateRequired: true }),
    row("PM11", 11),
  ];

  it("expands 'offer accepted' into its incomplete prerequisites, in order", () => {
    const plan = buildMilestonePlan(["PM11"], rows);
    expect(plan.map((p) => p.code)).toEqual(["PM5", "PM6", "PM11"]);
    expect(plan.find((p) => p.code === "PM11")!.isPrereq).toBe(false);
    expect(plan.find((p) => p.code === "PM5")!.isPrereq).toBe(true);
    expect(plan.find((p) => p.code === "PM6")!.needsEventDate).toBe(true);
  });

  it("drops a prerequisite that's already complete", () => {
    const plan = buildMilestonePlan(["PM11"], [row("PM5", 5), row("PM6", 6, { isComplete: true }), row("PM11", 11)]);
    expect(plan.map((p) => p.code)).toEqual(["PM5", "PM11"]);
  });

  it("drops a not-applicable step (e.g. cash file)", () => {
    const plan = buildMilestonePlan(["PM11"], [row("PM5", 5, { isNotRequired: true }), row("PM6", 6, { isNotRequired: true }), row("PM11", 11, { isNotRequired: true })]);
    expect(plan).toEqual([]);
  });

  it("ignores a detected code that isn't on the file", () => {
    expect(buildMilestonePlan(["ZZ9"], rows)).toEqual([]);
  });

  it("marks a prerequisite as directly-detected when it's also named", () => {
    const plan = buildMilestonePlan(["PM6", "PM11"], rows);
    expect(plan.find((p) => p.code === "PM6")!.isPrereq).toBe(false);
  });
});
