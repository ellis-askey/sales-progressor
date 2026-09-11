import { classifyAction, type ClassifyContext } from "@/lib/agent/classify";
import type { ProposedAction } from "@/lib/agent/assessment";

function action(partial: Partial<ProposedAction>): ProposedAction {
  return { actionType: "doNothing", milestoneCode: null, note: null, confidence: "high", evidence: null, ...partial };
}

const ctx: ClassifyContext = {
  confirmableCodes: new Set(["PM13", "PM8"]),
  doneCodes: new Set(["PM7", "PM8"]), // PM8 done → PM13's prereq satisfied
  prereqs: { PM13: ["PM8"] },
};

describe("classifyAction (deterministic shadow validation)", () => {
  it("shadow_proposes a confirmable milestone whose prerequisites are met", () => {
    const r = classifyAction(action({ actionType: "confirmMilestone", milestoneCode: "PM13" }), ctx);
    expect(r.outcome).toBe("shadow_proposed");
    expect(r.targetType).toBe("milestone");
    expect(r.targetRef).toBe("PM13");
    expect(r.blockedReason).toBeNull();
  });

  it("BLOCKS a confirm whose prerequisites are not satisfied (does not bypass rules)", () => {
    const missingPrereq: ClassifyContext = { ...ctx, doneCodes: new Set(["PM7"]) }; // PM8 NOT done
    const r = classifyAction(action({ actionType: "confirmMilestone", milestoneCode: "PM13" }), missingPrereq);
    expect(r.outcome).toBe("blocked");
    expect(r.blockedReason).toContain("PREREQUISITES_NOT_COMPLETE");
    expect(r.blockedReason).toContain("PM8");
  });

  it("flags a confirm for a code that is not confirmable on this file", () => {
    const r = classifyAction(action({ actionType: "confirmMilestone", milestoneCode: "PM14" }), ctx);
    expect(r.outcome).toBe("flagged");
  });

  it("flags a confirm for a step already complete", () => {
    const r = classifyAction(action({ actionType: "confirmMilestone", milestoneCode: "PM8" }), ctx);
    expect(r.outcome).toBe("flagged");
    expect(r.blockedReason).toContain("already complete");
  });

  it("records doNothing as no_action", () => {
    expect(classifyAction(action({ actionType: "doNothing" }), ctx).outcome).toBe("no_action");
  });

  it("shadow_proposes internal actions (note / waiting-on / task / escalate)", () => {
    for (const t of ["addInternalNote", "setWaitingOn", "createTask", "resolveTask", "escalateToHuman"] as const) {
      expect(classifyAction(action({ actionType: t }), ctx).outcome).toBe("shadow_proposed");
    }
  });
});
