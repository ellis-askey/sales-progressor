"use client";

// Right pane of the builder: settings for the selected item. Questions get
// wording, required, type-specific config, and the logic editor; the welcome
// and ending screens get their own fields.

import { useState } from "react";
import type { FormDefinition, Question, QuestionType } from "@/lib/forms/types";
import type { LogicIssue } from "@/lib/forms/logic";
import { QUESTION_TYPE_LABELS, newQuestion } from "@/lib/forms/defaults";
import { newEntityId } from "@/lib/forms/ids";
import { BwField, BwSwitch } from "../ui";
import type { Selection } from "./BuilderApp";
import { LogicEditor } from "./LogicEditor";

/** Collapsed-by-default section for less-used settings. */
function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--bw-line)", marginTop: 20 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "14px 0 10px",
          fontFamily: "var(--bw-font-sans)",
        }}
      >
        <span className="bw-label" style={{ margin: 0 }}>{title}</span>
        <span
          aria-hidden
          style={{
            fontSize: 11,
            color: "var(--bw-ink-faint)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms ease",
          }}
        >
          ▾
        </span>
      </button>
      {open && <div className="bw-fade-up">{children}</div>}
    </div>
  );
}

const CHOICE_TYPES = ["single_choice", "multiple_choice", "dropdown", "picture_choice", "ranking"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bw-line)" }}>
      <span style={{ fontSize: 13, fontWeight: 550 }}>{label}</span>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--bw-ink-faint)", margin: "22px 0 8px" }}>{children}</h3>;
}

export function Inspector({
  def,
  selection,
  question,
  update,
  updateQuestion,
  logicIssues,
}: {
  def: FormDefinition;
  selection: Selection;
  question: Question | null;
  update: (fn: (d: FormDefinition) => FormDefinition) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  logicIssues: LogicIssue[];
}) {
  return (
    <aside
      className="bw-scroll"
      style={{
        width: 320,
        minWidth: 270,
        flex: "0 0 auto",
        borderLeft: "1px solid var(--bw-line)",
        background: "var(--bw-paper-raised)",
        overflowY: "auto",
        padding: "16px 16px 60px",
      }}
    >
      {selection.kind === "welcome" && <WelcomeSettings def={def} update={update} />}
      {selection.kind === "ending" && <EndingSettings def={def} endingId={selection.id} update={update} />}
      {selection.kind === "question" && question && (
        <QuestionSettings def={def} question={question} update={update} updateQuestion={updateQuestion} logicIssues={logicIssues} />
      )}
      {selection.kind === "question" && !question && (
        <p className="bw-hint">Select a question from the list.</p>
      )}
    </aside>
  );
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

function WelcomeSettings({ def, update }: { def: FormDefinition; update: (fn: (d: FormDefinition) => FormDefinition) => void }) {
  const w = def.welcome;
  const set = (patch: Partial<FormDefinition["welcome"]>) =>
    update((d) => ({ ...d, welcome: { ...d.welcome, ...patch } }));
  return (
    <div>
      <h2 className="bw-display" style={{ fontSize: 17, margin: "0 0 14px" }}>Welcome screen</h2>
      <Row label="Show welcome screen">
        <BwSwitch on={w.enabled} onToggle={(v) => set({ enabled: v })} label="Show welcome screen" />
      </Row>
      <div style={{ height: 12 }} />
      <BwField label="Title">
        <input className="bw-input" value={w.title} onChange={(e) => set({ title: e.target.value })} />
      </BwField>
      <BwField label="Description">
        <textarea className="bw-textarea" rows={3} value={w.description ?? ""} onChange={(e) => set({ description: e.target.value || undefined })} />
      </BwField>
      <BwField label="Button text">
        <input className="bw-input" value={w.buttonText} onChange={(e) => set({ buttonText: e.target.value })} />
      </BwField>
      <BwField label="Time estimate (optional)" hint='Shown under the button, e.g. "Takes 2 minutes".'>
        <input className="bw-input" value={w.estimateLabel ?? ""} onChange={(e) => set({ estimateLabel: e.target.value || undefined })} />
      </BwField>
      <BwField label="Image URL (optional)">
        <input className="bw-input" placeholder="https://…" value={w.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value || undefined })} />
      </BwField>
    </div>
  );
}

// ─── Ending ──────────────────────────────────────────────────────────────────

function EndingSettings({ def, endingId, update }: { def: FormDefinition; endingId: string; update: (fn: (d: FormDefinition) => FormDefinition) => void }) {
  const ending = def.endings.find((e) => e.id === endingId);
  if (!ending) return <p className="bw-hint">This ending was removed.</p>;
  const set = (patch: Partial<typeof ending>) =>
    update((d) => ({ ...d, endings: d.endings.map((e) => (e.id === endingId ? { ...e, ...patch } : e)) }));

  return (
    <div>
      <h2 className="bw-display" style={{ fontSize: 17, margin: "0 0 14px" }}>Ending</h2>
      <BwField label="Title">
        <input className="bw-input" value={ending.title} onChange={(e) => set({ title: e.target.value })} />
      </BwField>
      <BwField label="Description">
        <textarea className="bw-textarea" rows={3} value={ending.description ?? ""} onChange={(e) => set({ description: e.target.value || undefined })} />
      </BwField>
      <BwField label="Button text (optional)">
        <input className="bw-input" value={ending.buttonText ?? ""} onChange={(e) => set({ buttonText: e.target.value || undefined })} />
      </BwField>
      <BwField label="Button link" hint="Where the button goes, e.g. your website.">
        <input className="bw-input" placeholder="https://…" value={ending.buttonUrl ?? ""} onChange={(e) => set({ buttonUrl: e.target.value || undefined })} />
      </BwField>
      <BwField label="Auto-redirect (optional)" hint="Send respondents straight to a URL after a moment.">
        <input className="bw-input" placeholder="https://…" value={ending.redirectUrl ?? ""} onChange={(e) => set({ redirectUrl: e.target.value || undefined })} />
      </BwField>

      <SectionHeading>All endings</SectionHeading>
      <p className="bw-hint" style={{ margin: "0 0 10px" }}>
        Jump rules can send different respondents to different endings.
      </p>
      {def.endings.map((e) => (
        <Row key={e.id} label={e.title || "Ending"}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {e.isDefault ? (
              <span className="bw-chip bw-chip-green" style={{ height: 20, fontSize: 10.5 }}>default</span>
            ) : (
              <>
                <button
                  className="bw-btn bw-btn-ghost bw-btn-sm"
                  onClick={() =>
                    update((d) => ({ ...d, endings: d.endings.map((x) => ({ ...x, isDefault: x.id === e.id })) }))
                  }
                >
                  Make default
                </button>
                <button
                  className="bw-btn bw-btn-danger bw-btn-sm"
                  onClick={() => update((d) => ({ ...d, endings: d.endings.filter((x) => x.id !== e.id) }))}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </Row>
      ))}
      <button
        className="bw-btn bw-btn-secondary bw-btn-sm"
        style={{ marginTop: 10 }}
        onClick={() =>
          update((d) => ({
            ...d,
            endings: [...d.endings, { id: newEntityId("end"), title: "Thanks", isDefault: false }],
          }))
        }
      >
        + Add another ending
      </button>
    </div>
  );
}

// ─── Question ────────────────────────────────────────────────────────────────

function QuestionSettings({
  def,
  question,
  update,
  updateQuestion,
  logicIssues,
}: {
  def: FormDefinition;
  question: Question;
  update: (fn: (d: FormDefinition) => FormDefinition) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  logicIssues: LogicIssue[];
}) {
  const q = question;
  const set = (patch: Partial<Question>) => updateQuestion(q.id, patch);
  const myIssues = logicIssues.filter((i) => i.questionId === q.id);

  function changeType(type: QuestionType) {
    // Keep wording; take fresh defaults for type-specific config; keep choices
    // when both types use them.
    const fresh = newQuestion(type);
    const keepChoices = CHOICE_TYPES.includes(type) && CHOICE_TYPES.includes(q.type) && q.choices?.length;
    set({
      type,
      choices: keepChoices ? q.choices : fresh.choices,
      min: fresh.min,
      max: fresh.max,
      minLabel: fresh.minLabel,
      maxLabel: fresh.maxLabel,
      starCount: fresh.starCount,
      maxFiles: fresh.maxFiles,
      maxFileSizeMb: fresh.maxFileSizeMb,
      acceptedFileTypes: fresh.acceptedFileTypes,
      consentText: q.consentText ?? fresh.consentText,
      buttonText: fresh.buttonText,
      dateConstraint: fresh.dateConstraint,
    });
  }

  return (
    <div>
      <BwField label="Question type">
        <select className="bw-select" value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </BwField>

      <BwField label={q.type === "statement" ? "Statement" : "Question"}>
        <textarea className="bw-textarea" rows={2} value={q.title} placeholder="What would you like to ask?" onChange={(e) => set({ title: e.target.value })} />
      </BwField>

      <BwField label="Description (optional)">
        <textarea className="bw-textarea" rows={2} value={q.description ?? ""} onChange={(e) => set({ description: e.target.value || undefined })} />
      </BwField>

      {q.type !== "statement" && (
        <Row label="Required">
          <BwSwitch on={q.required} onToggle={(v) => set({ required: v })} label="Required" />
        </Row>
      )}

      {/* ── Type-specific config ── */}
      <TypeConfig q={q} set={set} />

      <Collapsible title="Image & section">
        <BwField label="Section label (optional)" hint="A small kicker above the question. Groups related questions.">
          <input className="bw-input bw-input-sm" value={q.section ?? ""} onChange={(e) => set({ section: e.target.value || undefined })} />
        </BwField>
        <BwField label="Image URL (optional)">
          <input className="bw-input bw-input-sm" placeholder="https://…" value={q.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value || undefined })} />
        </BwField>
      </Collapsible>

      {/* ── Logic ── */}
      <SectionHeading>Logic</SectionHeading>
      {myIssues.length > 0 && (
        <div style={{ background: "var(--bw-amber-tint)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
          {myIssues.map((issue, i) => (
            <p key={i} style={{ fontSize: 12.5, color: "var(--bw-amber)", margin: i ? "6px 0 0" : 0 }}>
              {issue.severity === "error" ? "⛔" : "⚠"} {issue.message}
            </p>
          ))}
        </div>
      )}
      <LogicEditor def={def} question={q} update={update} />
    </div>
  );
}

// ─── Type-specific config ─────────────────────────────────────────────────────

function TypeConfig({ q, set }: { q: Question; set: (patch: Partial<Question>) => void }) {
  if (CHOICE_TYPES.includes(q.type)) {
    return (
      <>
        <SectionHeading>Options</SectionHeading>
        <ChoicesEditor q={q} set={set} />
        {(q.type === "single_choice" || q.type === "multiple_choice") && (
          <Row label={'Allow "Other"'}>
            <BwSwitch on={!!q.allowOther} onToggle={(v) => set({ allowOther: v || undefined })} label="Allow other" />
          </Row>
        )}
        {q.type === "multiple_choice" && (
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <BwField label="Min choices">
              <input className="bw-input bw-input-sm" type="number" min={0} value={q.minSelections ?? ""} onChange={(e) => set({ minSelections: e.target.value ? Number(e.target.value) : undefined })} />
            </BwField>
            <BwField label="Max choices">
              <input className="bw-input bw-input-sm" type="number" min={1} value={q.maxSelections ?? ""} onChange={(e) => set({ maxSelections: e.target.value ? Number(e.target.value) : undefined })} />
            </BwField>
          </div>
        )}
      </>
    );
  }

  switch (q.type) {
    case "short_text":
    case "long_text":
    case "address":
      return (
        <>
          <SectionHeading>Field</SectionHeading>
          <BwField label="Placeholder (optional)">
            <input className="bw-input bw-input-sm" value={q.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value || undefined })} />
          </BwField>
          <BwField label="Character limit (optional)">
            <input className="bw-input bw-input-sm" type="number" min={1} value={q.maxLength ?? ""} onChange={(e) => set({ maxLength: e.target.value ? Number(e.target.value) : undefined })} />
          </BwField>
        </>
      );
    case "number":
      return (
        <>
          <SectionHeading>Limits</SectionHeading>
          <div style={{ display: "flex", gap: 10 }}>
            <BwField label="Minimum">
              <input className="bw-input bw-input-sm" type="number" value={q.min ?? ""} onChange={(e) => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </BwField>
            <BwField label="Maximum">
              <input className="bw-input bw-input-sm" type="number" value={q.max ?? ""} onChange={(e) => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </BwField>
          </div>
        </>
      );
    case "opinion_scale":
      return (
        <>
          <SectionHeading>Scale</SectionHeading>
          <div style={{ display: "flex", gap: 10 }}>
            <BwField label="From">
              <select className="bw-select bw-input-sm" value={q.min ?? 1} onChange={(e) => set({ min: Number(e.target.value) })}>
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </BwField>
            <BwField label="To">
              <select className="bw-select bw-input-sm" value={q.max ?? 10} onChange={(e) => set({ max: Number(e.target.value) })}>
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </BwField>
          </div>
          <BwField label="Left label">
            <input className="bw-input bw-input-sm" value={q.minLabel ?? ""} onChange={(e) => set({ minLabel: e.target.value || undefined })} />
          </BwField>
          <BwField label="Right label">
            <input className="bw-input bw-input-sm" value={q.maxLabel ?? ""} onChange={(e) => set({ maxLabel: e.target.value || undefined })} />
          </BwField>
        </>
      );
    case "star_rating":
      return (
        <>
          <SectionHeading>Rating</SectionHeading>
          <BwField label="Number of stars">
            <select className="bw-select bw-input-sm" value={q.starCount ?? 5} onChange={(e) => set({ starCount: Number(e.target.value) })}>
              {[3, 4, 5, 7, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </BwField>
        </>
      );
    case "date":
      return (
        <>
          <SectionHeading>Date rules</SectionHeading>
          <BwField label="Allowed dates">
            <select className="bw-select bw-input-sm" value={q.dateConstraint ?? "any"} onChange={(e) => set({ dateConstraint: e.target.value as Question["dateConstraint"] })}>
              <option value="any">Any date</option>
              <option value="future_only">Future only</option>
              <option value="past_only">Past only</option>
            </select>
          </BwField>
        </>
      );
    case "file_upload":
      return (
        <>
          <SectionHeading>Files</SectionHeading>
          <div style={{ display: "flex", gap: 10 }}>
            <BwField label="Max files">
              <select className="bw-select bw-input-sm" value={q.maxFiles ?? 1} onChange={(e) => set({ maxFiles: Number(e.target.value) })}>
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </BwField>
            <BwField label="Max size (MB)">
              <select className="bw-select bw-input-sm" value={q.maxFileSizeMb ?? 10} onChange={(e) => set({ maxFileSizeMb: Number(e.target.value) })}>
                {[2, 5, 10, 15].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </BwField>
          </div>
          <BwField label="Accepted types">
            <select
              className="bw-select bw-input-sm"
              value={(q.acceptedFileTypes ?? ["any"])[0]}
              onChange={(e) => set({ acceptedFileTypes: [e.target.value as "image" | "pdf" | "document" | "any"] })}
            >
              <option value="any">Any file</option>
              <option value="image">Images</option>
              <option value="pdf">PDFs</option>
              <option value="document">Documents</option>
            </select>
          </BwField>
        </>
      );
    case "consent":
      return (
        <>
          <SectionHeading>Consent</SectionHeading>
          <BwField label="Statement being agreed to">
            <textarea className="bw-textarea" rows={3} value={q.consentText ?? ""} onChange={(e) => set({ consentText: e.target.value })} />
          </BwField>
        </>
      );
    case "statement":
      return (
        <>
          <SectionHeading>Button</SectionHeading>
          <BwField label="Button text">
            <input className="bw-input bw-input-sm" value={q.buttonText ?? "Continue"} onChange={(e) => set({ buttonText: e.target.value })} />
          </BwField>
        </>
      );
    case "email":
    case "phone":
    case "url":
      return (
        <>
          <SectionHeading>Field</SectionHeading>
          <BwField label="Placeholder (optional)">
            <input className="bw-input bw-input-sm" value={q.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value || undefined })} />
          </BwField>
          <p className="bw-hint" style={{ margin: 0 }}>
            {q.type === "email" ? "Email format is checked automatically." : q.type === "phone" ? "Phone format is checked automatically." : "Web address format is checked automatically."}
          </p>
        </>
      );
    default:
      return null;
  }
}

function ChoicesEditor({ q, set }: { q: Question; set: (patch: Partial<Question>) => void }) {
  const choices = q.choices ?? [];
  function updateChoice(id: string, patch: Partial<{ label: string; imageUrl: string }>) {
    set({ choices: choices.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      {choices.map((c, i) => (
        <div key={c.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            className="bw-input bw-input-sm"
            value={c.label}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => updateChoice(c.id, { label: e.target.value })}
          />
          {q.type === "picture_choice" && (
            <input
              className="bw-input bw-input-sm"
              value={c.imageUrl ?? ""}
              placeholder="Image URL"
              style={{ maxWidth: 110 }}
              onChange={(e) => updateChoice(c.id, { imageUrl: e.target.value })}
            />
          )}
          <button
            className="bw-btn bw-btn-ghost bw-btn-sm"
            aria-label="Remove option"
            style={{ width: 28, padding: 0, flexShrink: 0 }}
            onClick={() => set({ choices: choices.filter((x) => x.id !== c.id) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="bw-btn bw-btn-secondary bw-btn-sm"
        onClick={() => set({ choices: [...choices, { id: newEntityId("c"), label: "" }] })}
      >
        + Add option
      </button>
    </div>
  );
}
