// Boardwalk Forms — domain types for the white-label form-builder platform.
//
// A form's entire editable surface (questions, logic, theme, settings, welcome
// and ending screens) is stored as ONE JSON document (`FormDefinition`) on
// TenantForm.draft, and frozen into TenantForm.published at publish time. The
// public runner only ever reads the published copy, so in-progress edits never
// leak to respondents.
//
// These types are shared by the builder UI, the public runner, and the
// server-side validators — keep them dependency-free (no React, no Prisma).

// ─── Question types ──────────────────────────────────────────────────────────

export type QuestionType =
  // Text
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "address"
  // Choices
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "yes_no"
  | "picture_choice"
  // Dates & ratings
  | "date"
  | "time"
  | "opinion_scale"
  | "star_rating"
  | "ranking"
  // Advanced
  | "file_upload"
  | "statement"
  | "consent"
  | "signature";

export interface ChoiceOption {
  id: string;
  label: string;
  /** picture_choice only */
  imageUrl?: string;
}

// ─── Conditional logic ───────────────────────────────────────────────────────

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_answered"
  | "is_not_answered";

export interface LogicCondition {
  /** The question whose answer is tested. */
  questionId: string;
  op: ConditionOperator;
  /** Comparison value — a choice id for choice questions, string/number otherwise. */
  value?: string | number;
}

export type JumpTarget =
  | { type: "question"; questionId: string }
  | { type: "ending"; endingId: string };

/**
 * Evaluated after the question is answered, in order; the first rule whose
 * condition group passes wins. No rule passing → next visible question.
 */
export interface JumpRule {
  id: string;
  combinator: "and" | "or";
  conditions: LogicCondition[];
  target: JumpTarget;
}

/** Show this question only when the group passes (all/any of the conditions). */
export interface VisibilityRule {
  combinator: "and" | "or";
  conditions: LogicCondition[];
}

// ─── Questions ───────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  /** Optional illustration shown alongside the question. */
  imageUrl?: string;
  /** Builder-side grouping label; renders as a section kicker on the question. */
  section?: string;

  // Type-specific configuration (only the relevant fields are read per type)
  /** choice types + ranking */
  choices?: ChoiceOption[];
  /** single/multiple choice: allow a free-text "Other" option */
  allowOther?: boolean;
  /** multiple_choice: selection bounds */
  minSelections?: number;
  maxSelections?: number;
  /** number + scales: numeric bounds. For scales these are the scale ends. */
  min?: number;
  max?: number;
  /** opinion_scale: end labels */
  minLabel?: string;
  maxLabel?: string;
  /** star_rating: number of stars (default 5) */
  starCount?: number;
  /** short/long text: max characters */
  maxLength?: number;
  /** text types: placeholder */
  placeholder?: string;
  /** file_upload */
  maxFiles?: number;
  maxFileSizeMb?: number;
  /** file_upload: accepted kinds */
  acceptedFileTypes?: ("image" | "pdf" | "document" | "any")[];
  /** consent: the statement being agreed to (title is the heading) */
  consentText?: string;
  /** statement: continue-button text override */
  buttonText?: string;
  /** date: disallow past/future */
  dateConstraint?: "any" | "future_only" | "past_only";

  // Logic
  visibleIf?: VisibilityRule;
  jumps?: JumpRule[];
}

// ─── Screens ─────────────────────────────────────────────────────────────────

export interface WelcomeScreen {
  enabled: boolean;
  title: string;
  description?: string;
  buttonText: string;
  imageUrl?: string;
  /** Rough completion-time hint, e.g. "Takes 2 minutes" */
  estimateLabel?: string;
}

export interface EndingScreen {
  id: string;
  title: string;
  description?: string;
  /** Optional external link button */
  buttonText?: string;
  buttonUrl?: string;
  /** Auto-redirect after showing the screen */
  redirectUrl?: string;
  isDefault: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

export type ThemeFont = "sans" | "serif" | "display" | "mono";
export type BackgroundStyle = "solid" | "gradient" | "image";
export type ProgressStyle = "bar" | "fraction" | "none";
export type FormLayout = "one_at_a_time" | "classic";

export interface FormTheme {
  /** Name of the preset this theme started from (presets in theme-presets.ts) */
  preset: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonTextColor: string;
  font: ThemeFont;
  backgroundStyle: BackgroundStyle;
  backgroundImageUrl?: string;
  logoUrl?: string;
  progressStyle: ProgressStyle;
  layout: FormLayout;
  /** Button corner rounding, px */
  buttonRadius: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface FormSettings {
  /** Internal recipients notified on each submission. */
  notifyEmails: string[];
  /** Auto-confirmation to the respondent, sent to their first email answer. */
  respondentConfirmation: {
    enabled: boolean;
    subject?: string;
    message?: string;
  };
  /** Stop accepting after N submissions (null/undefined = unlimited). */
  submissionLimit?: number | null;
  /** Stop accepting after this ISO datetime. */
  closeAt?: string | null;
  /** Message shown when the form is closed/full. */
  closedMessage?: string;
  /** Hidden fields captured from URL query params into the response. */
  hiddenFields: string[];
  /** POSTed the full submission on each response. */
  webhookUrl?: string | null;
}

// ─── The document ────────────────────────────────────────────────────────────

export interface FormDefinition {
  version: 1;
  welcome: WelcomeScreen;
  questions: Question[];
  endings: EndingScreen[];
  theme: FormTheme;
  settings: FormSettings;
}

// ─── Responses ───────────────────────────────────────────────────────────────

/**
 * Answer value shapes by question type:
 * - text/email/phone/url/address/date/time: string
 * - number/opinion_scale/star_rating: number
 * - yes_no: "yes" | "no"
 * - single_choice/dropdown: choice id (or "other:<text>")
 * - multiple_choice: choice ids array (may include "other:<text>")
 * - ranking: choice ids array in ranked order
 * - consent: true
 * - file_upload: upload ids array (TenantFormUpload)
 * - signature: upload id (PNG)
 */
export type AnswerValue = string | number | boolean | string[];

export type ResponseAnswers = Record<string, AnswerValue>;

export interface ResponseMeta {
  durationSeconds?: number;
  endingId?: string;
  hidden?: Record<string, string>;
}

// ─── API shapes ──────────────────────────────────────────────────────────────

export type FormStatus = "draft" | "published" | "closed" | "archived";

/** Enough of a form's real theme + welcome to draw a true miniature preview. */
export interface FormPreviewSummary {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonTextColor: string;
  font: ThemeFont;
  buttonRadius: number;
  welcomeTitle: string;
  buttonText: string;
}

export interface FormListItem {
  id: string;
  title: string;
  status: FormStatus;
  publicId: string;
  responseCount: number;
  questionCount: number;
  lastEditedAt: string;
  createdAt: string;
  publishedAt: string | null;
  /** Whether the draft has diverged from the published copy. */
  hasUnpublishedChanges: boolean;
  preview: FormPreviewSummary;
}

export interface SessionUser {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}
