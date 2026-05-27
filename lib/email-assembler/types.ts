// Email assembler — composition-model client email types.
// Built for the bilateral hand-off feature's ~700-body matrix, where the
// flat-string approach has unsustainable voice-drift cost.
//
// Each milestone-recipient skeleton is a list of `Section`s. At send time
// the assembler filters sections by the file shape (tenure, purchaseType,
// route, direction) and joins the surviving texts. One paragraph per
// section — conditions are paragraph-granular, never phrase-granular.
//
// HARD constraint: only four `ShapeCondition` keys are supported. No
// disjunction-across-keys, no callbacks, no DSL escape hatches. If a
// shape can't be expressed in these four keys, add a new key here — do
// NOT introduce arbitrary predicate functions.

import type { Tenure, PurchaseType } from "@prisma/client";

// ── Confirmer route ───────────────────────────────────────────────────────
//
// For bilateral milestones, the ACTED-SIDE client email varies by who
// clicked confirm. Three buckets, matching the per-pair handoff spec:
//   client_portal     — buyer/seller confirmed via their own portal
//   agent             — agency director/negotiator confirmed on the client's behalf
//   sales_progressor  — internal SP/admin confirmed on the client's behalf
//
// Routes are only relevant for ACTED-SIDE emails on bilateral milestones.
// Opposite-side hand-off nudges and non-bilateral emails ignore route.
export type ConfirmerRoute = "client_portal" | "agent" | "sales_progressor";

// ── Hand-off direction ────────────────────────────────────────────────────
//
// For bilateral milestones, the same code can fire under two scenarios:
//   default  — the natural first-actor confirmed first (e.g. VM7 → PM7)
//   inverse  — the receiver confirmed before the natural first-actor
//              (e.g. PM7 confirms before VM7 — buyer's sol logged receipt
//              before seller's sol logged dispatch)
//
// Direction only affects the OPPOSITE-side hand-off nudge. Acted-side
// acks don't vary by direction.
export type HandoffDirection = "default" | "inverse";

// ── FileShape — the input the assembler matches against ──────────────────
//
// Built once per send from the PropertyTransaction row + the confirm event
// context. tenure and purchaseType always set on real files (schema makes
// them required at creation). route and direction set only for bilateral
// emails; undefined otherwise.
export type FileShape = {
  tenure: Tenure;
  purchaseType: PurchaseType;
  route?: ConfirmerRoute;
  direction?: HandoffDirection;
};

// ── ShapeCondition — what a Section's `when` declares ─────────────────────
//
// Four keys, implicit AND between keys. Each key supports the literal
// value, an `{ in: [...] }` set membership, or `{ not: X }` negation.
// No disjunction across keys, no nested logic, no callbacks. If a section
// needs OR across (purchaseType=cash_buyer OR cash_from_proceeds), use
// `purchaseType: { in: ["cash_buyer", "cash_from_proceeds"] }`.
export type ShapeCondition = {
  tenure?: Tenure | { in: Tenure[] } | { not: Tenure };
  purchaseType?: PurchaseType | { in: PurchaseType[] } | { not: PurchaseType };
  route?: ConfirmerRoute | { in: ConfirmerRoute[] };
  direction?: HandoffDirection;
};

// ── Section — one paragraph, optionally conditional ──────────────────────
//
// `text` is a flat string. Existing `{var}` interpolation runs on the
// assembled output AFTER section filtering — so e.g. `{address}` and
// `{First}` still work as today.
//
// `when` omitted → universal (always included). `when` present → included
// only when the current FileShape satisfies every key.
//
// Mutual exclusivity within a paragraph slot (e.g. "exactly one of the
// three purchaseType variants of whatNext fires") is the AUTHOR's
// responsibility — the assembler doesn't enforce it. If two sections
// both match, both are included. Author at paragraph granularity and
// keep conditional sets disjoint.
export type Section = {
  text: string;
  when?: ShapeCondition;
};

// ── RecipientEmailSkeleton — five fields, each a Section[] ───────────────
//
// Mirrors the existing RecipientEmailCopy shape but each field is now an
// array of conditional sections instead of a flat template string.
//
// Field-level separator conventions (set by assembleEmail, not stored
// here): subject + opening + action join with " " (single-paragraph
// fields, conditional fragments rare). whatHappened + whatNext join with
// "\n\n" (each section IS a paragraph). Author whatHappened/whatNext
// sections as complete standalone paragraphs.
export type RecipientEmailSkeleton = {
  subject: Section[];
  heroLabel: Section[];   // H1 in the rendered HTML email
  opening: Section[];
  whatHappened: Section[];
  whatNext?: Section[];   // optional — some milestones have no "what next"
  action: Section[];
};

// ── MilestoneSkeleton — one milestone's full email-copy block ────────────
//
// Up to five recipient variants, mirroring MilestoneEmailCopy. Not all
// milestones define every recipient — e.g. PM7 has no vendorAgent today.
// Undefined recipients fire no email (same behaviour as the existing
// MilestoneEmailCopy).
export type MilestoneSkeleton = {
  vendor?: RecipientEmailSkeleton;
  purchaser?: RecipientEmailSkeleton;
  vendorAgent?: RecipientEmailSkeleton;
  progressor?: RecipientEmailSkeleton;
};
