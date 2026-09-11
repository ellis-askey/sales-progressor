// Deterministic, DB-free classification of a proposed action. This is where the
// "code owns the rules" half of the shadow experiment lives: even though nothing
// is executed, we run each proposed action through the SAME business-rule checks
// that would gate a real write, so the recorded outcome reflects what would
// ACTUALLY have happened — not merely what the model said.
//
// Pure function (no prisma, no I/O) → fully unit-testable.

import type { ProposedAction } from "@/lib/agent/assessment";

export type ActionOutcome = "shadow_proposed" | "blocked" | "flagged" | "no_action";

export type ClassifiedAction = {
  action: ProposedAction;
  outcome: ActionOutcome;
  blockedReason: string | null;
  targetType: "milestone" | "note" | "waiting_on" | "task" | null;
  targetRef: string | null;
};

export type ClassifyContext = {
  // Milestone codes the agent is permitted to propose confirming on this file.
  confirmableCodes: ReadonlySet<string>;
  // Codes already complete or not-required (a prereq counts as satisfied when in here).
  doneCodes: ReadonlySet<string>;
  // Direct prerequisite map (DIRECT_PREREQUISITES).
  prereqs: Record<string, string[]>;
};

export function classifyAction(action: ProposedAction, ctx: ClassifyContext): ClassifiedAction {
  switch (action.actionType) {
    case "doNothing":
      return { action, outcome: "no_action", blockedReason: null, targetType: null, targetRef: null };

    case "confirmMilestone": {
      const code = (action.milestoneCode ?? "").trim().toUpperCase();
      if (!code) {
        return { action, outcome: "flagged", blockedReason: "no milestone code supplied", targetType: "milestone", targetRef: null };
      }
      if (!ctx.confirmableCodes.has(code)) {
        return { action, outcome: "flagged", blockedReason: `${code} is not a confirmable step on this file`, targetType: "milestone", targetRef: code };
      }
      if (ctx.doneCodes.has(code)) {
        return { action, outcome: "flagged", blockedReason: `${code} is already complete`, targetType: "milestone", targetRef: code };
      }
      const missing = (ctx.prereqs[code] ?? []).filter((p) => !ctx.doneCodes.has(p));
      if (missing.length > 0) {
        return {
          action,
          outcome: "blocked",
          blockedReason: `PREREQUISITES_NOT_COMPLETE: ${missing.join(", ")}`,
          targetType: "milestone",
          targetRef: code,
        };
      }
      return { action, outcome: "shadow_proposed", blockedReason: null, targetType: "milestone", targetRef: code };
    }

    case "addInternalNote":
      return { action, outcome: "shadow_proposed", blockedReason: null, targetType: "note", targetRef: null };
    case "setWaitingOn":
      return { action, outcome: "shadow_proposed", blockedReason: null, targetType: "waiting_on", targetRef: null };
    case "createTask":
    case "resolveTask":
      return { action, outcome: "shadow_proposed", blockedReason: null, targetType: "task", targetRef: null };
    case "escalateToHuman":
      return { action, outcome: "shadow_proposed", blockedReason: null, targetType: null, targetRef: null };

    default:
      return { action, outcome: "flagged", blockedReason: "unknown action type", targetType: null, targetRef: null };
  }
}
