/**
 * @jest-environment node
 */

// WhatsApp check-in message builder (2026-08-21). Pure-function tests:
// greeting bands, both/all group words, firm interpolation + fallback,
// connector cycling, and the empty-side null.

import { buildDueSteps, buildCheckInMessage, type MilestoneForQuestions } from "../step-questions";

function m(code: string, over: Partial<MilestoneForQuestions> = {}): MilestoneForQuestions {
  return { code, isComplete: false, isNotRequired: false, isAvailable: true, ...over };
}

const at = (hour: number) => new Date(2026, 7, 21, hour, 30, 0);

describe("buildDueSteps", () => {
  it("keeps only due, available, question-mapped steps and interpolates the firm", () => {
    const steps = buildDueSteps(
      [
        m("PM3"),
        m("PM5", { isComplete: true }),
        m("PM8"),
        m("PM9", { isAvailable: false }),
        m("PM25"), // bilateral gate: deliberately unmapped
        m("PM6", { isNotRequired: true }),
      ],
      "Bird & Co",
    );
    expect(steps.map((s) => s.code)).toEqual(["PM3", "PM8"]);
    expect(steps[0].question).toBe("Have you been able to complete your ID checks with Bird & Co?");
    expect(steps[1].question).toBe("Has Bird & Co ordered the searches yet?");
  });

  it("falls back to 'your solicitor' when the file has no firm", () => {
    const [step] = buildDueSteps([m("VM3")], null);
    expect(step.question).toBe("Have you received the welcome pack from your solicitor?");
  });
});

describe("buildCheckInMessage", () => {
  const steps = buildDueSteps([m("PM3"), m("PM8"), m("PM11")], "Bird & Co");

  it("returns null when nothing is due", () => {
    expect(buildCheckInMessage({ steps: [], clientCount: 2 })).toBeNull();
  });

  it("builds the full message with connectors, greeting and sign-off", () => {
    const text = buildCheckInMessage({ steps, clientCount: 2, now: at(9) });
    expect(text).toBe(
      "Good morning both,\n\n" +
        "Hope you are well. Just checking in to see how things are coming along! " +
        "Have you been able to complete your ID checks with Bird & Co? " +
        "Also, has Bird & Co ordered the searches yet? " +
        "And has your mortgage offer come through yet?\n\n" +
        "Any updates when you get a chance would be great, thanks.",
    );
  });

  it("switches greeting by time of day", () => {
    expect(buildCheckInMessage({ steps, clientCount: 1, now: at(11) })).toContain("Good morning,");
    expect(buildCheckInMessage({ steps, clientCount: 1, now: at(12) })).toContain("Good afternoon,");
    expect(buildCheckInMessage({ steps, clientCount: 1, now: at(17) })).toContain("Good evening,");
  });

  it("addresses the group by headcount", () => {
    expect(buildCheckInMessage({ steps, clientCount: 1, now: at(9) })).toContain("Good morning,\n");
    expect(buildCheckInMessage({ steps, clientCount: 2, now: at(9) })).toContain("Good morning both,");
    expect(buildCheckInMessage({ steps, clientCount: 3, now: at(9) })).toContain("Good morning all,");
  });

  it("cycles connectors past three questions without repeating adjacently", () => {
    const many = buildDueSteps([m("PM3"), m("PM7"), m("PM8"), m("PM11"), m("PM13")], "Bird & Co");
    const text = buildCheckInMessage({ steps: many, clientCount: 2, now: at(9) })!;
    expect(text).toContain("Also, has the draft contract pack arrived with Bird & Co yet?");
    expect(text).toContain("And has Bird & Co ordered the searches yet?");
    expect(text).toContain("Plus, has your mortgage offer come through yet?");
    expect(text).toContain("Also, have the search results come back yet?");
  });
});
