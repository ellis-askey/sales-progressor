// Blank-form defaults + theme presets for Boardwalk Forms.
// Isomorphic — used by the builder UI and the create-form API route.

import type { EndingScreen, FormDefinition, FormTheme, Question, QuestionType } from "./types";
import { newEntityId } from "./ids";

// ─── Theme presets ───────────────────────────────────────────────────────────
// A small set of excellent presets rather than unlimited knobs. Each is a
// complete FormTheme; picking one in the Design tab replaces the colour/font
// fields but keeps the form's logo/layout choices.

export const THEME_PRESETS: Record<string, Omit<FormTheme, "logoUrl" | "layout" | "progressStyle">> = {
  boardwalk: {
    preset: "boardwalk",
    primaryColor: "#1a5f4a",
    backgroundColor: "#faf8f4",
    textColor: "#1c2420",
    buttonTextColor: "#ffffff",
    font: "sans",
    backgroundStyle: "solid",
    buttonRadius: 10,
  },
  midnight: {
    preset: "midnight",
    primaryColor: "#8ab4f8",
    backgroundColor: "#101418",
    textColor: "#eef2f6",
    buttonTextColor: "#101418",
    font: "sans",
    backgroundStyle: "solid",
    buttonRadius: 10,
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
  slate: {
    preset: "slate",
    primaryColor: "#3b6ea5",
    backgroundColor: "#f4f6f8",
    textColor: "#1f2933",
    buttonTextColor: "#ffffff",
    font: "sans",
    backgroundStyle: "solid",
    buttonRadius: 8,
  },
  orchard: {
    preset: "orchard",
    primaryColor: "#5a7d2a",
    backgroundColor: "#f7faf2",
    textColor: "#232b1a",
    buttonTextColor: "#ffffff",
    font: "display",
    backgroundStyle: "solid",
    buttonRadius: 24,
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
