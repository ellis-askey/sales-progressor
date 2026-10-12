// Blank-form defaults + theme presets for Boardwalk Forms.
// Isomorphic — used by the builder UI and the create-form API route.

import type { EndingScreen, FormDefinition, FormTheme, Question, QuestionType } from "./types";
import { newEntityId } from "./ids";

// ─── Theme presets ───────────────────────────────────────────────────────────
// A small set of excellent presets rather than unlimited knobs. Each is a
// complete FormTheme; picking one in the Design tab replaces the colour/font
// fields but keeps the form's logo/layout choices.

// "boardwalk" is the genuine brand preset, taken from boardwalkpropertyco.com:
// charcoal #404648 on stone #f3f0ee with serif display headings and the
// pill-shaped buttons their site uses. It is the default for every new form.
export const THEME_PRESETS: Record<string, Omit<FormTheme, "logoUrl" | "layout" | "progressStyle">> = {
  boardwalk: {
    preset: "boardwalk",
    primaryColor: "#404648",
    backgroundColor: "#f3f0ee",
    textColor: "#404648",
    buttonTextColor: "#ffffff",
    font: "display",
    backgroundStyle: "solid",
    buttonRadius: 24,
  },
  blush: {
    preset: "blush",
    primaryColor: "#404648",
    backgroundColor: "#f4dfde",
    textColor: "#404648",
    buttonTextColor: "#ffffff",
    font: "display",
    backgroundStyle: "solid",
    buttonRadius: 24,
  },
  sage: {
    preset: "sage",
    primaryColor: "#4d5a4d",
    backgroundColor: "#e9ebe7",
    textColor: "#3a423c",
    buttonTextColor: "#ffffff",
    font: "sans",
    backgroundStyle: "solid",
    buttonRadius: 24,
  },
  midnight: {
    preset: "midnight",
    primaryColor: "#f4dfde",
    backgroundColor: "#1b1e1f",
    textColor: "#f3f0ee",
    buttonTextColor: "#2b3032",
    font: "display",
    backgroundStyle: "solid",
    buttonRadius: 24,
  },
  linen: {
    preset: "linen",
    primaryColor: "#b5542d",
    backgroundColor: "#fbf6ef",
    textColor: "#2d2620",
    buttonTextColor: "#ffffff",
    font: "serif",
    backgroundStyle: "solid",
    buttonRadius: 4,
  },
  noir: {
    preset: "noir",
    primaryColor: "#c9a86a",
    backgroundColor: "#15120d",
    textColor: "#f3ede2",
    buttonTextColor: "#15120d",
    font: "serif",
    backgroundStyle: "solid",
    buttonRadius: 2,
  },
};

export function defaultTheme(): FormTheme {
  return {
    ...THEME_PRESETS.boardwalk,
    layout: "one_at_a_time",
    progressStyle: "bar",
  };
}

// ─── Blank document ──────────────────────────────────────────────────────────

export function defaultEnding(): EndingScreen {
  return {
    id: newEntityId("end"),
    title: "Thanks, we've got your answers.",
    description: "We'll be in touch shortly.",
    isDefault: true,
  };
}

export function blankDefinition(): FormDefinition {
  return {
    version: 1,
    welcome: {
      enabled: true,
      title: "Untitled form",
      description: "",
      buttonText: "Start",
    },
    questions: [],
    endings: [defaultEnding()],
    theme: defaultTheme(),
    settings: {
      notifyEmails: [],
      respondentConfirmation: { enabled: false },
      hiddenFields: [],
    },
  };
}

// ─── New-question factory ────────────────────────────────────────────────────

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short answer",
  long_text: "Long answer",
  email: "Email address",
  phone: "Phone number",
  url: "Website",
  number: "Number",
  address: "Address",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  picture_choice: "Picture choice",
  date: "Date",
  time: "Time",
  opinion_scale: "Opinion scale",
  star_rating: "Star rating",
  ranking: "Ranking",
  file_upload: "File upload",
  statement: "Statement",
  consent: "Consent",
  signature: "Signature",
};

export function newQuestion(type: QuestionType): Question {
  const base: Question = {
    id: newEntityId("q"),
    type,
    title: "",
    required: false,
  };
  switch (type) {
    case "single_choice":
    case "multiple_choice":
    case "dropdown":
    case "ranking":
      return {
        ...base,
        choices: [
          { id: newEntityId("c"), label: "Option 1" },
          { id: newEntityId("c"), label: "Option 2" },
        ],
      };
    case "picture_choice":
      return {
        ...base,
        choices: [
          { id: newEntityId("c"), label: "Option 1", imageUrl: "" },
          { id: newEntityId("c"), label: "Option 2", imageUrl: "" },
        ],
      };
    case "opinion_scale":
      return { ...base, min: 1, max: 10, minLabel: "Not likely", maxLabel: "Very likely" };
    case "star_rating":
      return { ...base, starCount: 5 };
    case "file_upload":
      return { ...base, maxFiles: 1, maxFileSizeMb: 10, acceptedFileTypes: ["any"] };
    case "consent":
      return { ...base, title: "Before you continue", consentText: "I agree to be contacted about my enquiry.", required: true };
    case "statement":
      return { ...base, buttonText: "Continue" };
    case "date":
      return { ...base, dateConstraint: "any" };
    default:
      return base;
  }
}
