"use client";

// Visual conditional-logic editor for one question. Two tools:
// 1. "Only show this question when…" — a visibility condition group.
// 2. "After this question, jump to…" — ordered jump rules with AND/OR
//    condition groups targeting a question or an ending.
// No code, no syntax — just dropdowns that only offer valid references
// (earlier questions for conditions, any question/ending as a jump target).

import type {
  ConditionOperator,
  FormDefinition,
  JumpRule,
  LogicCondition,
  Question,
} from "@/lib/forms/types";
import { newEntityId } from "@/lib/forms/ids";

const OPERATORS: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "is", needsValue: true },
  { value: "not_equals", label: "is not", needsValue: true },
  { value: "contains", label: "includes", needsValue: true },
  { value: "not_contains", label: "doesn't include", needsValue: true },
  { value: "greater_than", label: "is more than", needsValue: true },
  { value: "less_than", label: "is less than", needsValue: true },
  { value: "is_answered", label: "is answered", needsValue: false },
  { value: "is_not_answered", label: "is skipped", needsValue: false },
];

function questionLabel(q: Question, index: number): string {
  const title = q.title || "Untitled question";
  return `${index + 1}. ${title.length > 42 ? `${title.slice(0, 40)}…` : title}`;
}

function ConditionRow({
  def,
  cond,
  ownIndex,
  onChange,
  onRemove,
}: {
  def: FormDefinition;
  cond: LogicCondition;
  ownIndex: number;
  onChange: (next: LogicCondition) => void;
  onRemove: () => void;
}) {
  const earlier = def.questions.filter((q, i) => i < ownIndex && q.type !== "statement");
  const refQuestion = def.questions.find((q) => q.id === cond.questionId);
  const op = OPERATORS.find((o) => o.value === cond.op) ?? OPERATORS[0];
  const isChoiceRef = !!refQuestion?.choices?.length || refQuestion?.type === "yes_no";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, background: "var(--bw-paper-sunken)", borderRadius: 9, padding: 8 }}>
      <div style={{ display: "flex", gap: 5 }}>
        <select
          className="bw-select bw-input-sm"
          value={cond.questionId}
          onChange={(e) => onChange({ ...cond, questionId: e.target.value, value: undefined })}
          style={{ flex: 1, minWidth: 0 }}
        >
          <option value="" disabled>Choose a question…</option>
          {earlier.map((q) => (
            <option key={q.id} value={q.id}>
              {questionLabel(q, def.questions.findIndex((x) => x.id === q.id))}
            </option>
          ))}
        </select>
        <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 26, padding: 0, flexShrink: 0 }} aria-label="Remove condition" onClick={onRemove}>
          ✕
        </button>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <select
          className="bw-select bw-input-sm"
          value={cond.op}
          onChange={(e) => onChange({ ...cond, op: e.target.value as ConditionOperator })}
          style={{ width: op.needsValue ? 120 : "100%" }}
        >
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {op.needsValue &&
          (isChoiceRef ? (
            <select
              className="bw-select bw-input-sm"
              value={String(cond.value ?? "")}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
              style={{ flex: 1, minWidth: 0 }}
            >
              <option value="" disabled>Choose…</option>
              {refQuestion?.type === "yes_no" ? (
                <>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </>
              ) : (
                refQuestion?.choices?.map((c) => (
                  <option key={c.id} value={c.id}>{c.label || "Untitled option"}</option>
                ))
              )}
            </select>
          ) : (
            <input
              className="bw-input bw-input-sm"
              placeholder="Value"
              value={String(cond.value ?? "")}
              onChange={(e) => {
                const raw = e.target.value;
                const asNumber = Number(raw);
                onChange({
                  ...cond,
                  value:
                    raw !== "" && !Number.isNaN(asNumber) && ["greater_than", "less_than"].includes(cond.op)
                      ? asNumber
                      : raw,
                });
              }}
              style={{ flex: 1, minWidth: 0 }}
            />
          ))}
      </div>
    </div>
  );
}

function CombinatorToggle({ value, onChange }: { value: "and" | "or"; onChange: (v: "and" | "or") => void }) {
  return (
    <div className="bw-seg" style={{ alignSelf: "flex-start" }}>
      <button data-active={value === "and"} onClick={() => onChange("and")}>all match</button>
      <button data-active={value === "or"} onClick={() => onChange("or")}>any match</button>
    </div>
  );
}

export function LogicEditor({
  def,
  question,
  update,
}: {
  def: FormDefinition;
  question: Question;
  update: (fn: (d: FormDefinition) => FormDefinition) => void;
}) {
  const ownIndex = def.questions.findIndex((q) => q.id === question.id);
  const setQ = (patch: Partial<Question>) =>
    update((d) => ({ ...d, questions: d.questions.map((q) => (q.id === question.id ? { ...q, ...patch } : q)) }));

  const visible = question.visibleIf;
  const jumps = question.jumps ?? [];
  const canCondition = ownIndex > 0;

  // ── Visibility ──
  function addVisibilityCondition() {
    const first = def.questions.find((q, i) => i < ownIndex && q.type !== "statement");
    if (!first) return;
    const cond: LogicCondition = { questionId: first.id, op: "equals" };
    setQ({
      visibleIf: visible
        ? { ...visible, conditions: [...visible.conditions, cond] }
        : { combinator: "and", conditions: [cond] },
    });
  }

  // ── Jumps ──
  function addJump() {
    const targetEnding = def.endings[0];
    const sourceId = question.type === "statement"
      ? def.questions.find((q, i) => i <= ownIndex && q.type !== "statement")?.id
      : question.id;
    const rule: JumpRule = {
      id: newEntityId("j"),
      combinator: "and",
      conditions: [{ questionId: sourceId ?? question.id, op: "equals" }],
      target: { type: "ending", endingId: targetEnding.id },
    };
    setQ({ jumps: [...jumps, rule] });
  }

  function updateJump(id: string, patch: Partial<JumpRule>) {
    setQ({ jumps: jumps.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Visibility */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 650, margin: "0 0 6px" }}>Only show this question when…</p>
        {!canCondition ? (
          <p className="bw-hint" style={{ margin: 0 }}>The first question is always shown. Conditions can only look at earlier answers.</p>
        ) : visible && visible.conditions.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.conditions.length > 1 && (
              <CombinatorToggle
                value={visible.combinator}
                onChange={(v) => setQ({ visibleIf: { ...visible, combinator: v } })}
              />
            )}
            {visible.conditions.map((cond, i) => (
              <ConditionRow
                key={i}
                def={def}
                cond={cond}
                ownIndex={ownIndex}
                onChange={(next) =>
                  setQ({ visibleIf: { ...visible, conditions: visible.conditions.map((c, x) => (x === i ? next : c)) } })
                }
                onRemove={() => {
                  const rest = visible.conditions.filter((_, x) => x !== i);
                  setQ({ visibleIf: rest.length ? { ...visible, conditions: rest } : undefined });
                }}
              />
            ))}
            <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={addVisibilityCondition}>+ Add condition</button>
          </div>
        ) : (
          <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={addVisibilityCondition}>
            + Add a show/hide rule
          </button>
        )}
      </div>

      {/* Jumps */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 650, margin: "0 0 2px" }}>After this question, jump to…</p>
        <p className="bw-hint" style={{ margin: "0 0 8px" }}>
          Rules run in order after the question is answered. If none match, the form carries on to the next question.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {jumps.map((jump) => (
            <div key={jump.id} className="bw-card" style={{ padding: 10, borderRadius: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--bw-ink-faint)" }}>When</span>
                  <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Remove rule" style={{ width: 24, padding: 0 }} onClick={() => setQ({ jumps: jumps.filter((j) => j.id !== jump.id).length ? jumps.filter((j) => j.id !== jump.id) : undefined })}>
                    ✕
                  </button>
                </div>
                {jump.conditions.length > 1 && (
                  <CombinatorToggle value={jump.combinator} onChange={(v) => updateJump(jump.id, { combinator: v })} />
                )}
                {jump.conditions.map((cond, i) => (
                  <ConditionRow
                    key={i}
                    def={def}
                    cond={cond}
                    ownIndex={ownIndex + 1}
                    onChange={(next) => updateJump(jump.id, { conditions: jump.conditions.map((c, x) => (x === i ? next : c)) })}
                    onRemove={() => updateJump(jump.id, { conditions: jump.conditions.filter((_, x) => x !== i) })}
                  />
                ))}
                <button
                  className="bw-btn bw-btn-ghost bw-btn-sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => updateJump(jump.id, { conditions: [...jump.conditions, { questionId: question.id, op: "equals" }] })}
                >
                  + and condition
                </button>

                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--bw-ink-faint)", marginTop: 4 }}>Then jump to</span>
                <select
                  className="bw-select bw-input-sm"
                  value={jump.target.type === "question" ? `q:${jump.target.questionId}` : `e:${jump.target.endingId}`}
                  onChange={(e) => {
                    const [kind, id] = e.target.value.split(":");
                    updateJump(jump.id, {
                      target: kind === "q" ? { type: "question", questionId: id } : { type: "ending", endingId: id },
                    });
                  }}
                >
                  <optgroup label="Questions">
                    {def.questions.map((q, i) =>
                      q.id === question.id ? null : (
                        <option key={q.id} value={`q:${q.id}`}>{questionLabel(q, i)}</option>
                      )
                    )}
                  </optgroup>
                  <optgroup label="Endings">
                    {def.endings.map((e) => (
                      <option key={e.id} value={`e:${e.id}`}>🏁 {e.title || "Ending"}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          ))}
          <button className="bw-btn bw-btn-secondary bw-btn-sm" onClick={addJump}>+ Add a jump rule</button>
        </div>
      </div>
    </div>
  );
}
