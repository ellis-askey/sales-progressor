// Conditional-logic engine for Boardwalk Forms.
//
// Pure + isomorphic: the public runner uses it to decide which question comes
// next, the server uses it to re-derive the question path when validating a
// submission, and the builder uses it to flag broken or circular logic.
//
// Model:
// - Each question may carry `visibleIf` (show only when the group passes).
// - Each question may carry `jumps` — evaluated after it is answered, in
//   order; the first passing rule redirects the flow to a question or ending.
// - With no passing jump, flow falls through to the next visible question.
// - Running past the last question lands on the default ending.

import type {
  EndingScreen,
  FormDefinition,
  JumpRule,
  LogicCondition,
  Question,
  ResponseAnswers,
  VisibilityRule,
} from "./types";

// ─── Condition evaluation ────────────────────────────────────────────────────

function answerAsArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

export function evaluateCondition(cond: LogicCondition, answers: ResponseAnswers): boolean {
  const raw = answers[cond.questionId];
  const answered = raw !== undefined && raw !== null && raw !== "" && !(Array.isArray(raw) && raw.length === 0);

  switch (cond.op) {
    case "is_answered":
      return answered;
    case "is_not_answered":
      return !answered;
    case "equals": {
      if (Array.isArray(raw)) return raw.length === 1 && String(raw[0]) === String(cond.value);
      return answered && String(raw) === String(cond.value);
    }
    case "not_equals": {
      if (!answered) return true;
      if (Array.isArray(raw)) return !(raw.length === 1 && String(raw[0]) === String(cond.value));
      return String(raw) !== String(cond.value);
    }
    case "contains": {
      const values = answerAsArray(raw);
      const needle = String(cond.value ?? "");
      // Choice answers: membership. Text answers: substring (case-insensitive).
      if (Array.isArray(raw)) return values.includes(needle);
      return answered && String(raw).toLowerCase().includes(needle.toLowerCase());
    }
    case "not_contains": {
      const values = answerAsArray(raw);
      const needle = String(cond.value ?? "");
      if (Array.isArray(raw)) return !values.includes(needle);
      return !answered || !String(raw).toLowerCase().includes(needle.toLowerCase());
    }
    case "greater_than":
      return answered && Number(raw) > Number(cond.value);
    case "less_than":
      return answered && Number(raw) < Number(cond.value);
    default:
      return false;
  }
}

export function evaluateGroup(
  group: { combinator: "and" | "or"; conditions: LogicCondition[] },
  answers: ResponseAnswers
): boolean {
  if (!group.conditions.length) return true;
  return group.combinator === "and"
    ? group.conditions.every((c) => evaluateCondition(c, answers))
    : group.conditions.some((c) => evaluateCondition(c, answers));
}

export function isQuestionVisible(question: Question, answers: ResponseAnswers): boolean {
  const rule: VisibilityRule | undefined = question.visibleIf;
  if (!rule || !rule.conditions.length) return true;
  return evaluateGroup(rule, answers);
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type FlowStep =
  | { kind: "question"; question: Question; index: number }
  | { kind: "ending"; ending: EndingScreen };

export function defaultEndingOf(def: FormDefinition): EndingScreen {
  return def.endings.find((e) => e.isDefault) ?? def.endings[0];
}

function endingById(def: FormDefinition, id: string): EndingScreen {
  return def.endings.find((e) => e.id === id) ?? defaultEndingOf(def);
}

function firstPassingJump(jumps: JumpRule[] | undefined, answers: ResponseAnswers): JumpRule | null {
  if (!jumps) return null;
  for (const rule of jumps) {
    if (rule.conditions.length && evaluateGroup(rule, answers)) return rule;
  }
  return null;
}

/** First visible question at or after `fromIndex`, or the default ending. */
export function nextVisibleFrom(def: FormDefinition, fromIndex: number, answers: ResponseAnswers): FlowStep {
  for (let i = fromIndex; i < def.questions.length; i++) {
    if (isQuestionVisible(def.questions[i], answers)) {
      return { kind: "question", question: def.questions[i], index: i };
    }
  }
  return { kind: "ending", ending: defaultEndingOf(def) };
}

/** The step the flow starts on. */
export function firstStep(def: FormDefinition, answers: ResponseAnswers): FlowStep {
  return nextVisibleFrom(def, 0, answers);
}

/**
 * The step after answering the question at `index`. Jump rules first; no
 * passing rule → fall through to the next visible question.
 */
export function stepAfter(def: FormDefinition, index: number, answers: ResponseAnswers): FlowStep {
  const question = def.questions[index];
  const jump = firstPassingJump(question?.jumps, answers);
  if (jump) {
    if (jump.target.type === "ending") {
      return { kind: "ending", ending: endingById(def, jump.target.endingId) };
    }
    const targetId = jump.target.questionId;
    const targetIndex = def.questions.findIndex((q) => q.id === targetId);
    if (targetIndex !== -1) {
      // Jump target may itself be hidden — continue forward from it.
      return nextVisibleFrom(def, targetIndex, answers);
    }
  }
  return nextVisibleFrom(def, index + 1, answers);
}

/**
 * Walks the full flow for a finished set of answers and returns the ordered
 * question path plus the ending reached. Bounded by questions.length hops so
 * a (builder-invalid) circular jump can never loop forever.
 */
export function walkPath(def: FormDefinition, answers: ResponseAnswers): { path: Question[]; ending: EndingScreen } {
  const path: Question[] = [];
  const maxHops = def.questions.length + 1;
  let step = firstStep(def, answers);
  let hops = 0;
  const seen = new Set<string>();
  while (step.kind === "question" && hops < maxHops) {
    if (seen.has(step.question.id)) break; // circular guard
    seen.add(step.question.id);
    path.push(step.question);
    step = stepAfter(def, step.index, answers);
    hops++;
  }
  const ending = step.kind === "ending" ? step.ending : defaultEndingOf(def);
  return { path, ending };
}

// ─── Builder-side logic validation ───────────────────────────────────────────

export interface LogicIssue {
  severity: "error" | "warning";
  questionId?: string;
  message: string;
}

/**
 * Static checks the builder surfaces before publish:
 * - references to deleted questions/endings/choices
 * - jumps that point backwards (possible loops)
 * - conditions on questions that come later in the flow (always unanswered)
 */
export function validateLogic(def: FormDefinition): LogicIssue[] {
  const issues: LogicIssue[] = [];
  const indexOf = new Map(def.questions.map((q, i) => [q.id, i]));
  const endingIds = new Set(def.endings.map((e) => e.id));

  const checkConditions = (owner: Question, conditions: LogicCondition[], context: string) => {
    for (const cond of conditions) {
      const refIndex = indexOf.get(cond.questionId);
      if (refIndex === undefined) {
        issues.push({
          severity: "error",
          questionId: owner.id,
          message: `${context} refers to a question that no longer exists.`,
        });
        continue;
      }
      const ownerIndex = indexOf.get(owner.id) ?? 0;
      if (refIndex > ownerIndex) {
        issues.push({
          severity: "warning",
          questionId: owner.id,
          message: `${context} depends on a later question, so it can never have an answer yet.`,
        });
      }
      const ref = def.questions[refIndex];
      if (
        cond.value !== undefined &&
        ref.choices &&
        ["equals", "not_equals", "contains", "not_contains"].includes(cond.op) &&
        !ref.choices.some((c) => c.id === cond.value) &&
        !["yes", "no"].includes(String(cond.value))
      ) {
        issues.push({
          severity: "error",
          questionId: owner.id,
          message: `${context} tests a choice that was removed from "${ref.title || "that question"}".`,
        });
      }
    }
  };

  for (const q of def.questions) {
    if (q.visibleIf?.conditions.length) checkConditions(q, q.visibleIf.conditions, "A show/hide rule");
    for (const jump of q.jumps ?? []) {
      checkConditions(q, jump.conditions, "A jump rule");
      if (jump.target.type === "question") {
        const targetIndex = indexOf.get(jump.target.questionId);
        if (targetIndex === undefined) {
          issues.push({ severity: "error", questionId: q.id, message: "A jump points to a question that no longer exists." });
        } else if (targetIndex <= (indexOf.get(q.id) ?? 0)) {
          issues.push({
            severity: "warning",
            questionId: q.id,
            message: "A jump points backwards. Respondents could loop; we stop a loop automatically, but check this is intended.",
          });
        }
      } else if (!endingIds.has(jump.target.endingId)) {
        issues.push({ severity: "error", questionId: q.id, message: "A jump points to an ending that no longer exists." });
      }
      if (!jump.conditions.length) {
        issues.push({ severity: "warning", questionId: q.id, message: "A jump rule has no conditions, so it never fires." });
      }
    }
  }
  return issues;
}
