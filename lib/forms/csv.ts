// CSV export + answer display formatting for Boardwalk Forms responses.
// csvCell/row follow the repo's established inline-CSV pattern
// (app/api/agent/analytics-export/route.ts) — there is no shared CSV utility.

import type { AnswerValue, FormDefinition, Question } from "./types";

export function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function csvRow(...cells: string[]): string {
  return cells.map(csvCell).join(",");
}

/** Renders a stored answer as a human-readable string (CSV, emails, tables). */
export function formatAnswerForDisplay(q: Question, value: AnswerValue | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  const labelOf = (id: string): string => {
    if (id.startsWith("other:")) return `Other: ${id.slice(6)}`;
    return q.choices?.find((c) => c.id === id)?.label ?? id;
  };
  switch (q.type) {
    case "single_choice":
    case "dropdown":
    case "picture_choice":
      return labelOf(String(value));
    case "multiple_choice":
      return Array.isArray(value) ? value.map(labelOf).join("; ") : String(value);
    case "ranking":
      return Array.isArray(value) ? value.map((id, i) => `${i + 1}. ${labelOf(id)}`).join("; ") : String(value);
    case "yes_no":
      return value === "yes" ? "Yes" : "No";
    case "consent":
      return value === true ? "Agreed" : "";
    case "star_rating":
      return `${value} / ${q.starCount ?? 5}`;
    case "opinion_scale":
      return `${value} / ${q.max ?? 10}`;
    case "file_upload":
      return Array.isArray(value) ? `${value.length} file${value.length === 1 ? "" : "s"}` : "1 file";
    case "signature":
      return "Signed";
    default:
      return Array.isArray(value) ? value.join("; ") : String(value);
  }
}

export function buildResponsesCsv(
  def: FormDefinition,
  responses: { answers: unknown; meta: unknown; submittedAt: Date }[]
): string {
  const questions = def.questions.filter((q) => q.type !== "statement");
  const hiddenFields = def.settings.hiddenFields;
  const header = csvRow(
    "Submitted at",
    ...questions.map((q) => q.title || "Untitled question"),
    ...hiddenFields.map((f) => `(hidden) ${f}`)
  );
  const lines = responses.map((r) => {
    const answers = (r.answers ?? {}) as Record<string, AnswerValue>;
    const meta = (r.meta ?? {}) as { hidden?: Record<string, string> };
    return csvRow(
      r.submittedAt.toISOString(),
      ...questions.map((q) => formatAnswerForDisplay(q, answers[q.id])),
      ...hiddenFields.map((f) => meta.hidden?.[f] ?? "")
    );
  });
  return [header, ...lines].join("\r\n");
}
