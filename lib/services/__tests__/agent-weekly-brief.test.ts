/**
 * @jest-environment node
 */

// Tests for deriveFileState — the honest per-file state decision in the agent
// weekly brief. The bug this fixes: a self-managed file the system had flagged
// as stalled/overdue was still being labelled "on track / progressing".

import { deriveFileState } from "@/lib/services/agent-weekly-brief";

describe("deriveFileState (self-managed)", () => {
  test("clean file with no signals is on track", () => {
    expect(
      deriveFileState({ serviceType: "self_managed", escalatedTaskCount: 0, exchangeSoon: false, activeFlagCount: 0 }),
    ).toBe("ontrack");
  });

  test("THE FIX: a flagged file is 'slow', never 'ontrack'", () => {
    expect(
      deriveFileState({ serviceType: "self_managed", escalatedTaskCount: 0, exchangeSoon: false, activeFlagCount: 1 }),
    ).toBe("slow");
  });

  test("an escalated chase outranks a flag and reads 'attention'", () => {
    expect(
      deriveFileState({ serviceType: "self_managed", escalatedTaskCount: 2, exchangeSoon: false, activeFlagCount: 3 }),
    ).toBe("attention");
  });

  test("escalation outranks an approaching exchange", () => {
    expect(
      deriveFileState({ serviceType: "self_managed", escalatedTaskCount: 1, exchangeSoon: true, activeFlagCount: 0 }),
    ).toBe("attention");
  });

  test("approaching exchange outranks a flag", () => {
    expect(
      deriveFileState({ serviceType: "self_managed", escalatedTaskCount: 0, exchangeSoon: true, activeFlagCount: 1 }),
    ).toBe("exchange");
  });
});

describe("deriveFileState (outsourced, problem signals suppressed by design)", () => {
  test("a flagged outsourced file still reads 'ontrack', not 'slow'", () => {
    expect(
      deriveFileState({ serviceType: "outsourced", escalatedTaskCount: 0, exchangeSoon: false, activeFlagCount: 5 }),
    ).toBe("ontrack");
  });

  test("an escalated outsourced file still reads 'ontrack', not 'attention'", () => {
    expect(
      deriveFileState({ serviceType: "outsourced", escalatedTaskCount: 4, exchangeSoon: false, activeFlagCount: 0 }),
    ).toBe("ontrack");
  });

  test("an outsourced file approaching exchange shows 'exchange'", () => {
    expect(
      deriveFileState({ serviceType: "outsourced", escalatedTaskCount: 2, exchangeSoon: true, activeFlagCount: 2 }),
    ).toBe("exchange");
  });
});
