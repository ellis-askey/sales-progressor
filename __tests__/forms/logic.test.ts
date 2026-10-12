// Boardwalk Forms — logic engine + server-side submission validation.
// These cover the paths that would corrupt data or let bad submissions
// through: visibility, jump routing, circular-jump safety, path-restricted
// answer cleaning, and required-only-when-seen enforcement.

import type { FormDefinition, Question } from "@/lib/forms/types";
import { firstStep, stepAfter, walkPath, validateLogic, isQuestionVisible } from "@/lib/forms/logic";
import { validateSubmission } from "@/lib/forms/validate";
import { blankDefinition } from "@/lib/forms/defaults";

function makeDef(questions: Question[], endings?: FormDefinition["endings"]): FormDefinition {
  const def = blankDefinition();
  def.questions = questions;
  if (endings) def.endings = endings;
  return def;
}

const q = (partial: Partial<Question> & Pick<Question, "id" | "type" | "title">): Question => ({
  required: false,
  ...partial,
});

const CHOICE_FORM = makeDef(
  [
    q({
      id: "q1",
      type: "single_choice",
      title: "Buying or selling?",
      required: true,
      choices: [
        { id: "buy", label: "Buying" },
        { id: "sell", label: "Selling" },
      ],
      jumps: [
        {
          id: "j1",
          combinator: "and",
          conditions: [{ questionId: "q1", op: "equals", value: "sell" }],
          target: { type: "question", questionId: "q3" },
        },
      ],
    }),
    q({ id: "q2", type: "short_text", title: "Buyer-only question" }),
    q({ id: "q3", type: "short_text", title: "Everyone sees this" }),
    q({
      id: "q4",
      type: "email",
      title: "Email",
      required: true,
      visibleIf: { combinator: "and", conditions: [{ questionId: "q1", op: "equals", value: "buy" }] },
    }),
  ],
  [
    { id: "end_a", title: "Done", isDefault: true },
    { id: "end_b", title: "Seller ending", isDefault: false },
  ]
);

describe("logic navigation", () => {
  it("starts at the first visible question", () => {
    const step = firstStep(CHOICE_FORM, {});
    expect(step.kind).toBe("question");
    if (step.kind === "question") expect(step.question.id).toBe("q1");
  });

  it("falls through to the next question when no jump matches", () => {
    const step = stepAfter(CHOICE_FORM, 0, { q1: "buy" });
    expect(step.kind === "question" && step.question.id).toBe("q2");
  });

  it("jumps over questions when a rule matches", () => {
    const step = stepAfter(CHOICE_FORM, 0, { q1: "sell" });
    expect(step.kind === "question" && step.question.id).toBe("q3");
  });

  it("hides questions whose visibleIf fails", () => {
    expect(isQuestionVisible(CHOICE_FORM.questions[3], { q1: "sell" })).toBe(false);
    expect(isQuestionVisible(CHOICE_FORM.questions[3], { q1: "buy" })).toBe(true);
  });

  it("walks the seller path: q1 → q3 → default ending (q4 hidden)", () => {
    const { path, ending } = walkPath(CHOICE_FORM, { q1: "sell", q3: "hello" });
    expect(path.map((x) => x.id)).toEqual(["q1", "q3"]);
    expect(ending.id).toBe("end_a");
  });

  it("walks the buyer path: q1 → q2 → q3 → q4", () => {
    const { path } = walkPath(CHOICE_FORM, { q1: "buy" });
    expect(path.map((x) => x.id)).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("reaches a conditional ending via a jump target", () => {
    const def = makeDef(
      [
        q({
          id: "nps",
          type: "opinion_scale",
          title: "Score?",
          min: 0,
          max: 10,
          jumps: [
            {
              id: "j",
              combinator: "and",
              conditions: [{ questionId: "nps", op: "less_than", value: 7 }],
              target: { type: "ending", endingId: "end_sorry" },
            },
          ],
        }),
        q({ id: "after", type: "short_text", title: "Happy path only" }),
      ],
      [
        { id: "end_main", title: "Thanks", isDefault: true },
        { id: "end_sorry", title: "Sorry", isDefault: false },
      ]
    );
    expect(walkPath(def, { nps: 3 }).ending.id).toBe("end_sorry");
    expect(walkPath(def, { nps: 9 }).ending.id).toBe("end_main");
    expect(walkPath(def, { nps: 9 }).path.map((x) => x.id)).toEqual(["nps", "after"]);
  });

  it("never loops on circular jumps", () => {
    const def = makeDef([
      q({
        id: "a",
        type: "yes_no",
        title: "A",
        jumps: [
          { id: "j", combinator: "and", conditions: [{ questionId: "a", op: "is_answered" }], target: { type: "question", questionId: "b" } },
        ],
      }),
      q({
        id: "b",
        type: "yes_no",
        title: "B",
        jumps: [
          { id: "j2", combinator: "and", conditions: [{ questionId: "b", op: "is_answered" }], target: { type: "question", questionId: "a" } },
        ],
      }),
    ]);
    const { path } = walkPath(def, { a: "yes", b: "no" });
    expect(path.length).toBeLessThanOrEqual(2); // bounded, no infinite loop
  });
});

describe("validateLogic (builder warnings)", () => {
  it("flags references to deleted questions and endings", () => {
    const def = makeDef([
      q({
        id: "x",
        type: "yes_no",
        title: "X",
        visibleIf: { combinator: "and", conditions: [{ questionId: "ghost", op: "equals", value: "yes" }] },
        jumps: [
          { id: "j", combinator: "and", conditions: [{ questionId: "x", op: "equals", value: "yes" }], target: { type: "ending", endingId: "gone" } },
        ],
      }),
    ]);
    const issues = validateLogic(def);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("no longer exists"))).toBe(true);
  });

  it("warns on backward jumps", () => {
    const def = makeDef([
      q({ id: "a", type: "short_text", title: "A" }),
      q({
        id: "b",
        type: "yes_no",
        title: "B",
        jumps: [
          { id: "j", combinator: "and", conditions: [{ questionId: "b", op: "equals", value: "yes" }], target: { type: "question", questionId: "a" } },
        ],
      }),
    ]);
    expect(validateLogic(def).some((i) => i.severity === "warning" && i.message.includes("backwards"))).toBe(true);
  });

  it("passes a clean form", () => {
    expect(validateLogic(CHOICE_FORM).filter((i) => i.severity === "error")).toHaveLength(0);
  });
});

describe("validateSubmission (server-side)", () => {
  it("accepts a valid buyer path and keeps only path answers", () => {
    const result = validateSubmission(CHOICE_FORM, {
      q1: "buy",
      q2: "something",
      q3: "fine",
      q4: "buyer@example.co.uk",
      smuggled: "nope",
    });
    expect(result.ok).toBe(true);
    expect(result.cleanAnswers).toEqual({
      q1: "buy",
      q2: "something",
      q3: "fine",
      q4: "buyer@example.co.uk",
    });
  });

  it("does not require answers for questions hidden by logic", () => {
    // q4 (required email) is hidden on the seller path — submission passes without it.
    const result = validateSubmission(CHOICE_FORM, { q1: "sell", q3: "ok" });
    expect(result.ok).toBe(true);
    expect(result.cleanAnswers.q4).toBeUndefined();
  });

  it("rejects a missing required answer on the visible path", () => {
    const result = validateSubmission(CHOICE_FORM, { q1: "buy", q3: "ok" });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.questionId === "q4")).toBe(true);
  });

  it("rejects malformed emails, bad choices, and out-of-range numbers", () => {
    const def = makeDef([
      q({ id: "e", type: "email", title: "Email", required: true }),
      q({ id: "c", type: "single_choice", title: "Pick", required: true, choices: [{ id: "a", label: "A" }] }),
      q({ id: "n", type: "number", title: "N", required: true, min: 5, max: 10 }),
    ]);
    const result = validateSubmission(def, { e: "not-an-email", c: "b", n: 3 });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.questionId).sort()).toEqual(["c", "e", "n"]);
  });

  it("drops answers smuggled for questions skipped by a jump", () => {
    const result = validateSubmission(CHOICE_FORM, { q1: "sell", q2: "SMUGGLED", q3: "ok" });
    expect(result.ok).toBe(true);
    expect(result.cleanAnswers.q2).toBeUndefined();
  });

  it("validates multiple choice selection bounds and 'other' handling", () => {
    const def = makeDef([
      q({
        id: "m",
        type: "multiple_choice",
        title: "Pick",
        required: true,
        allowOther: true,
        maxSelections: 2,
        choices: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
      }),
    ]);
    expect(validateSubmission(def, { m: ["a", "other:hello"] }).ok).toBe(true);
    expect(validateSubmission(def, { m: ["a", "b", "c"] }).ok).toBe(false);
    expect(validateSubmission(def, { m: ["zzz"] }).ok).toBe(false);
  });

  it("requires consent to be literal true", () => {
    const def = makeDef([q({ id: "k", type: "consent", title: "Consent", required: true, consentText: "ok?" })]);
    expect(validateSubmission(def, { k: true }).ok).toBe(true);
    expect(validateSubmission(def, { k: "yes" }).ok).toBe(false);
  });
});
