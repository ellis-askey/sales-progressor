/**
 * @jest-environment node
 */

// Tests for the display-stage resolver's 2026-08-11 honesty rework
// (file-page feedback item 3). The old single-anchor model ticked a
// stage the moment it BEGAN (enquiries raised → Enquiries complete,
// "Exchange in progress"), running one stage ahead of reality. The new
// entry/exit model ticks on stage exit and allows several stages to be
// genuinely in progress at once.

import {
  resolveDisplayStages,
  type MilestoneRowForStages,
  type ForecastInputs,
} from "@/lib/milestones/display-stages";

const NO_FORECAST: ForecastInputs = {
  expectedExchangeDate: null,
  overridePredictedDate: null,
  targetCompletionDate: null,
};

function rows(...complete: string[]): MilestoneRowForStages[] {
  return complete.map((code) => ({
    code,
    isComplete: true,
    completion: { completedAt: new Date("2026-08-01T10:00:00Z") },
  }));
}

function statusMap(stages: ReturnType<typeof resolveDisplayStages>) {
  return Object.fromEntries(stages.map((s) => [s.key, s.status]));
}

describe("resolveDisplayStages — entry/exit honesty model", () => {
  test("fresh file: nothing begun, Instructed is up next, rest pending", () => {
    const s = statusMap(resolveDisplayStages([], NO_FORECAST));
    expect(s).toEqual({
      instructed: "up_next",
      draft_pack: "pending",
      searches: "pending",
      enquiries: "pending",
      exchange: "pending",
      completion: "pending",
    });
  });

  test("one side instructed: Instructed is in progress, not complete", () => {
    const s = statusMap(resolveDisplayStages(rows("VM1"), NO_FORECAST));
    expect(s.instructed).toBe("in_progress");
    expect(s.draft_pack).toBe("pending");
  });

  test("both sides instructed: Instructed complete, Draft pack up next (not begun)", () => {
    const s = statusMap(resolveDisplayStages(rows("VM1", "PM1"), NO_FORECAST));
    expect(s.instructed).toBe("complete");
    expect(s.draft_pack).toBe("up_next");
    expect(s.searches).toBe("pending");
  });

  test("draft pack issued but not received: Draft pack in progress", () => {
    const s = statusMap(resolveDisplayStages(rows("VM1", "PM1", "VM7"), NO_FORECAST));
    expect(s.draft_pack).toBe("in_progress");
  });

  // Ellis's exact 2026-08-11 complaint: enquiries raised had ticked the
  // Enquiries stage and showed "Exchange in progress" while enquiries
  // were still being answered. Now: searches awaited AND enquiries
  // underway both show in progress; Exchange stays pending.
  test("searches ordered + enquiries raised: BOTH in progress, Exchange pending", () => {
    const s = statusMap(
      resolveDisplayStages(rows("VM1", "PM1", "VM7", "PM7", "PM8", "PM14"), NO_FORECAST),
    );
    expect(s.searches).toBe("in_progress");
    expect(s.enquiries).toBe("in_progress");
    expect(s.exchange).toBe("pending");
    expect(s.completion).toBe("pending");
  });

  test("enquiries satisfied before search results: Enquiries complete, Searches still in progress", () => {
    const s = statusMap(
      resolveDisplayStages(rows("VM1", "PM1", "VM7", "PM7", "PM8", "PM14", "PM20"), NO_FORECAST),
    );
    expect(s.enquiries).toBe("complete");
    expect(s.searches).toBe("in_progress");
    expect(s.exchange).toBe("pending");
  });

  test("readiness confirmed: Exchange shows in progress; exchanged: complete", () => {
    const base = ["VM1", "PM1", "VM7", "PM7", "PM8", "PM13", "PM14", "PM20"];
    const ready = statusMap(resolveDisplayStages(rows(...base, "VM18"), NO_FORECAST));
    expect(ready.exchange).toBe("in_progress");

    const exchanged = statusMap(resolveDisplayStages(rows(...base, "VM18", "VM19"), NO_FORECAST));
    expect(exchanged.exchange).toBe("complete");
    expect(exchanged.completion).toBe("up_next");
  });

  test("everything done: all complete, nothing active or up next", () => {
    const s = statusMap(
      resolveDisplayStages(
        rows("VM1", "PM1", "VM7", "PM7", "PM8", "PM13", "PM14", "PM20", "VM18", "VM19", "VM20"),
        NO_FORECAST,
      ),
    );
    expect(Object.values(s).every((v) => v === "complete")).toBe(true);
  });

  test("multi-exit completedAt is the LATEST exit completion", () => {
    const milestones: MilestoneRowForStages[] = [
      { code: "VM1", isComplete: true, completion: { completedAt: new Date("2026-06-01") } },
      { code: "PM1", isComplete: true, completion: { completedAt: new Date("2026-06-05") } },
    ];
    const instructed = resolveDisplayStages(milestones, NO_FORECAST)[0];
    expect(instructed.status).toBe("complete");
    expect(instructed.completedAt).toEqual(new Date("2026-06-05"));
  });

  test("forecast dates still attach to exchange + completion", () => {
    const forecast: ForecastInputs = {
      expectedExchangeDate: new Date("2026-08-31"),
      overridePredictedDate: null,
      targetCompletionDate: new Date("2026-09-14"),
    };
    const stages = resolveDisplayStages([], forecast);
    expect(stages.find((s) => s.key === "exchange")?.forecastDate).toEqual(new Date("2026-08-31"));
    expect(stages.find((s) => s.key === "completion")?.forecastDate).toEqual(new Date("2026-09-14"));
  });
});
