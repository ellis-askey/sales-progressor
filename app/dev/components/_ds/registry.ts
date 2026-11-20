// TSP Design System — registry (types + information architecture).
//
// This is the typed spine of the /dev/components workspace. It defines:
//   · the decision statuses a component moves through,
//   · the shape of a canonical component entry (incl. its variants, states,
//     discovered sources and protected "Existing Behaviour & Exceptions"),
//   · the empty information architecture (AREAS) the workspace renders.
//
// It is DELIBERATELY empty of components. The architecture exists so entries
// can be added one at a time, by review, as we go through the real app. Nothing
// here invents a component, a token, a variant or an exception. See
// docs/design-system/README.md for the programme and rules.

import type { ReactNode } from "react";

/* ── Decision lifecycle ─────────────────────────────────────────────────────
   A discussed idea is not approved; an approved component is not implemented;
   an implemented canonical component is not migrated across the app. These
   statuses keep those distinctions explicit. */
export type DecisionStatus =
  | "not-reviewed"
  | "proposed"
  | "under-review"
  | "approved"
  | "implemented"
  | "deprecated";

export const STATUS_META: Record<DecisionStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  "not-reviewed": { label: "Not reviewed", tone: "neutral" },
  "proposed": { label: "Proposed", tone: "info" },
  "under-review": { label: "Under review", tone: "warning" },
  "approved": { label: "Approved", tone: "success" },
  "implemented": { label: "Implemented", tone: "success" },
  "deprecated": { label: "Deprecated", tone: "danger" },
};

/* ── Entry shape ────────────────────────────────────────────────────────────
   What a canonical component will carry once reviewed. All optional except the
   identity + status, so an entry can start as a stub the moment we open it. */

/** An intentional difference in size, appearance, density or purpose. */
export interface EntryVariant { id: string; label: string; note?: string }

/** A relevant state. Not every state applies to every component. */
export interface EntryState { id: string; label: string }

/** A discovered existing implementation in the real app (for the Discover step). */
export interface EntrySource { path: string; note?: string }

/** A protected behaviour / context-specific refinement that must survive
 *  shared updates — the "Existing Behaviour & Exceptions" record. */
export interface EntryException {
  title: string;
  detail: string;
  /** Where the behaviour originates. */
  source?: string;
  /** Shared across usages, or specific to one. */
  scope?: "shared" | "specific";
}

export interface ComponentEntry {
  id: string;
  name: string;
  /** Category id this entry belongs to. */
  category: string;
  status: DecisionStatus;
  summary?: string;
  /** Extra descriptive words for search — colours, shapes, synonyms a reviewer
   *  might type to find this ("orange", "arrow", "pill") that aren't already in
   *  the name or summary. Indexed by the nav search. */
  keywords?: string[];
  variants?: EntryVariant[];
  states?: EntryState[];
  /** Existing implementations found across the app. */
  sources?: EntrySource[];
  /** Protected behaviours — rendered in a collapsed section on the entry. */
  exceptions?: EntryException[];
  /** The live canonical preview, supplied only once the entry is approved and
   *  built. Receives the active theme so it can render light/dark correctly. */
  render?: (ctx: { theme: "light" | "dark" }) => ReactNode;
  /** Where we are in the review workflow, for the reviewer's note. */
  note?: string;
}

/* ── Information architecture ────────────────────────────────────────────────
   The category homes for future work (brief §4). Every category starts empty
   and clearly awaiting review. Reorganised into five areas with progressive
   disclosure so the nav never shows dozens of items at once. */

export interface Category { id: string; label: string; blurb?: string }
export interface Area { id: string; label: string; blurb: string; categories: Category[] }

export const AREAS: Area[] = [
  {
    id: "foundations",
    label: "Foundations",
    blurb: "The shared rules every component inherits — colour, type, space, motion, elevation, theming.",
    categories: [
      { id: "colour", label: "Colour & semantic tokens" },
      { id: "typography", label: "Typography" },
      { id: "spacing", label: "Spacing & layout rhythm" },
      { id: "sizing", label: "Dimensions & sizing" },
      { id: "radii", label: "Border radii" },
      { id: "borders", label: "Borders & dividers" },
      { id: "elevation", label: "Shadows & elevation" },
      { id: "iconography", label: "Iconography" },
      { id: "motion", label: "Motion & transitions" },
      { id: "breakpoints", label: "Responsive breakpoints" },
      { id: "layering", label: "Layering & z-index" },
      { id: "themes", label: "Light & dark themes" },
      { id: "density", label: "Density & visual hierarchy" },
    ],
  },
  {
    id: "components",
    label: "Components",
    blurb: "The shared UI elements — each with its canonical implementation, variants, states and protected exceptions.",
    categories: [
      { id: "buttons", label: "Buttons & actions" },
      { id: "text-inputs", label: "Text inputs & textareas" },
      { id: "selects", label: "Selects & dropdowns" },
      { id: "toggles", label: "Checkboxes, radios & toggles" },
      { id: "search", label: "Search & filtering controls" },
      { id: "datetime", label: "Date & time controls" },
      { id: "cards", label: "Cards & surfaces" },
      { id: "rows", label: "Rows & list items" },
      { id: "tables", label: "Tables & data displays" },
      { id: "badges", label: "Badges & status indicators" },
      { id: "progress", label: "Progress indicators & timelines" },
      { id: "navigation", label: "Navigation elements" },
      { id: "tabs", label: "Tabs & segmented controls" },
      { id: "modals", label: "Modals & dialogs" },
      { id: "drawers", label: "Drawers & popovers" },
      { id: "tooltips", label: "Tooltips" },
      { id: "notifications", label: "Notifications & feedback" },
      { id: "uploads", label: "File uploads & documents" },
      { id: "loading", label: "Loading & skeleton states" },
      { id: "empty-error", label: "Empty & error states" },
    ],
  },
  {
    id: "patterns",
    label: "Application patterns",
    blurb: "How components compose into the page-level patterns TSP uses.",
    categories: [
      { id: "shells", label: "Page shells & layouts" },
      { id: "toolbars", label: "Headers & toolbars" },
      { id: "sidebars", label: "Sidebars & navigation docks" },
      { id: "titles", label: "Page titles & action placement" },
      { id: "forms", label: "Forms & validation" },
      { id: "filtering", label: "Search, filtering & sorting" },
      { id: "data-heavy", label: "Data-heavy layouts" },
      { id: "responsive", label: "Responsive adaptations" },
      { id: "conventions", label: "Navigation & interaction conventions" },
      { id: "destructive", label: "Confirmation & destructive actions" },
      { id: "feedback", label: "Saving, loading & success feedback" },
    ],
  },
  {
    id: "lifecycle",
    label: "Application lifecycle",
    blurb: "How the product reads across the full account journey and account states.",
    categories: [
      { id: "registration", label: "Registration" },
      { id: "authentication", label: "Authentication" },
      { id: "onboarding", label: "Onboarding" },
      { id: "first-login", label: "First login" },
      { id: "empty-accounts", label: "Empty accounts" },
      { id: "partial-accounts", label: "Partially populated accounts" },
      { id: "full-accounts", label: "Fully populated accounts" },
      { id: "high-volume", label: "High-volume accounts" },
      { id: "restricted", label: "Restricted permissions" },
      { id: "exceptional", label: "Errors & exceptional conditions" },
    ],
  },
  {
    id: "governance",
    label: "Quality & governance",
    blurb: "How we keep it consistent, accessible, performant and accountable over time.",
    categories: [
      { id: "accessibility", label: "Accessibility" },
      { id: "responsive-qa", label: "Responsive consistency" },
      { id: "visual-qa", label: "Visual consistency" },
      { id: "interaction-qa", label: "Interaction consistency" },
      { id: "performance", label: "Performance" },
      { id: "reuse", label: "Component reuse" },
      { id: "regression", label: "Regression testing" },
      { id: "decisions", label: "Approved design decisions" },
      { id: "migration", label: "Migration tracking" },
      { id: "deprecated", label: "Deprecated implementations" },
    ],
  },
];

/* ── Signed off ──────────────────────────────────────────────────────────────
   Flows / pages confirmed 100% complete — spacing, canonicals, every element,
   container, popup and state accounted for in the library (bar anything
   deliberately kept bespoke). Appended one at a time as Ellis signs each off;
   empty until the first. */
export interface SignOff { flow: string; date: string; note?: string }
export const SIGNED_OFF: SignOff[] = [
  { flow: "Login page", date: "20 Nov 2026", note: "Type, buttons, SSO, coral links, cookie banner, inline email error, 2FA stage (coral OTP + backup escape hatch), token-danger error banner — all accounted for." },
  { flow: "Sign-up — step 1 (your details)", date: "20 Nov 2026", note: "Heading, two-bar step progress, LabelInput fields, password strength, arc terms checkbox, coral links, primary button, token-danger error." },
  { flow: "Sign-up — step 2 (agency / role)", date: "20 Nov 2026", note: "Agency field + focus-aware nudge, flat-coral role radio, primary + ghost buttons, token-danger error." },
  { flow: "Welcome modal (self-managed) — steps 1–3", date: "20 Nov 2026", note: "First canonical modal. Step dots, warm type (no eyebrow), flat-coral primary + ghost at equal height with press-down, muted back link, flat-coral icon circles, preference rows + canonical toggle, canonical X; in/out + drawer + step-cross-fade animation. All parts catalogued." },
];

/* ── The components themselves ───────────────────────────────────────────────
   The entries live in ./components (a .tsx file — they carry live JSX previews)
   so this module stays JSX-free and there is no import cycle. Entries are added
   one at a time, by review. See ./components. */
