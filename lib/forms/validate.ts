// Server-side submission validation for Boardwalk Forms.
//
// Never trust the client: we re-walk the logic path for the submitted answers
// and validate every question actually on that path. Answers for questions NOT
// on the path (hidden or skipped by logic) are dropped, so a crafted payload
// can't smuggle extra data, and `required` is only enforced for questions the
// respondent genuinely saw.

import type { AnswerValue, FormDefinition, Question, ResponseAnswers } from "./types";
import { walkPath } from "./logic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/\S*)?$/i;
const PHONE_RE = /^[+\d][\d\s().-]{5,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const MAX_TEXT = 10_000;

export interface ValidationFailure {
  questionId: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  failures: ValidationFailure[];
  /** Answers restricted to the walked path, with per-type coercion applied. */
  cleanAnswers: ResponseAnswers;
  endingId: string;
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function fail(q: Question, message: string): ValidationFailure {
  return { questionId: q.id, message };
}

/** Validates one answered value against its question. Returns null when valid. */
export function validateAnswer(q: Question, value: AnswerValue): string | null {
  switch (q.type) {
    case "short_text":
    case "long_text":
    case "address": {
      if (typeof value !== "string") return "Enter your answer as text.";
      const cap = q.maxLength && q.maxLength > 0 ? Math.min(q.maxLength, MAX_TEXT) : MAX_TEXT;
      if (value.length > cap) return `Keep this under ${cap.toLocaleString()} characters.`;
      return null;
    }
    case "email":
      if (typeof value !== "string" || !EMAIL_RE.test(value.trim())) return "Enter a valid email address.";
      return null;
    case "phone":
      if (typeof value !== "string" || !PHONE_RE.test(value.trim())) return "Enter a valid phone number.";
      return null;
    case "url":
      if (typeof value !== "string" || !URL_RE.test(value.trim())) return "Enter a valid web address.";
      return null;
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return "Enter a number.";
      if (q.min !== undefined && n < q.min) return `Needs to be at least ${q.min}.`;
      if (q.max !== undefined && n > q.max) return `Needs to be ${q.max} or less.`;
      return null;
    }
    case "yes_no":
      if (value !== "yes" && value !== "no") return "Choose yes or no.";
      return null;
    case "single_choice":
    case "dropdown":
    case "picture_choice": {
      if (typeof value !== "string") return "Choose an option.";
      if (q.allowOther && value.startsWith("other:")) {
        if (value.length > 300) return "Keep your answer under 300 characters.";
        return null;
      }
      if (!q.choices?.some((c) => c.id === value)) return "Choose one of the options.";
      return null;
    }
    case "multiple_choice": {
      if (!Array.isArray(value)) return "Choose at least one option.";
      for (const v of value) {
        if (typeof v !== "string") return "Choose from the options.";
        if (v.startsWith("other:")) {
          if (!q.allowOther) return "Choose from the options.";
          if (v.length > 300) return "Keep your answer under 300 characters.";
          continue;
        }
        if (!q.choices?.some((c) => c.id === v)) return "Choose from the options.";
      }
      if (new Set(value).size !== value.length) return "Each option can only be chosen once.";
      if (q.minSelections && value.length < q.minSelections) return `Choose at least ${q.minSelections}.`;
      if (q.maxSelections && value.length > q.maxSelections) return `Choose no more than ${q.maxSelections}.`;
      return null;
    }
    case "ranking": {
      if (!Array.isArray(value)) return "Rank the options.";
      const choiceIds = (q.choices ?? []).map((c) => c.id);
      if (value.length !== choiceIds.length || new Set(value).size !== value.length) {
        return "Rank every option once.";
      }
      if (!value.every((v) => typeof v === "string" && choiceIds.includes(v))) return "Rank the options shown.";
      return null;
    }
    case "date": {
      if (typeof value !== "string" || !DATE_RE.test(value)) return "Choose a date.";
      const d = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return "Choose a valid date.";
      const today = new Date().toISOString().slice(0, 10);
      if (q.dateConstraint === "future_only" && value < today) return "Choose a date in the future.";
      if (q.dateConstraint === "past_only" && value > today) return "Choose a date in the past.";
      return null;
    }
    case "time":
      if (typeof value !== "string" || !TIME_RE.test(value)) return "Choose a time.";
      return null;
    case "opinion_scale": {
      const n = Number(value);
      const min = q.min ?? 1;
      const max = q.max ?? 10;
      if (!Number.isInteger(n) || n < min || n > max) return "Choose a value on the scale.";
      return null;
    }
    case "star_rating": {
      const n = Number(value);
      const stars = q.starCount ?? 5;
      if (!Number.isInteger(n) || n < 1 || n > stars) return "Choose a rating.";
      return null;
    }
    case "consent":
      if (value !== true) return "Tick the box to continue.";
      return null;
    case "file_upload": {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) return "Upload a file.";
      const max = q.maxFiles ?? 1;
      if (value.length > max) return `Upload no more than ${max} file${max === 1 ? "" : "s"}.`;
      return null;
    }
    case "signature":
      if (typeof value !== "string" || !value) return "Add your signature.";
      return null;
    case "statement":
      return null;
    default:
      return "Unsupported answer.";
  }
}

/**
 * Validates a complete submission against the published definition.
 * Returns clean answers (path-restricted) and the ending reached.
 */
export function validateSubmission(def: FormDefinition, raw: unknown): ValidationResult {
  const failures: ValidationFailure[] = [];
  const submitted: ResponseAnswers =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as ResponseAnswers) : {};

  const { path, ending } = walkPath(def, submitted);
  const cleanAnswers: ResponseAnswers = {};

  for (const q of path) {
    const value = submitted[q.id];
    if (q.type === "statement") continue;
    if (isEmpty(value)) {
      if (q.required) failures.push(fail(q, "This question needs an answer."));
      continue;
    }
    const problem = validateAnswer(q, value as AnswerValue);
    if (problem) {
      failures.push(fail(q, problem));
      continue;
    }
    cleanAnswers[q.id] = value as AnswerValue;
  }

  return { ok: failures.length === 0, failures, cleanAnswers, endingId: ending.id };
}
