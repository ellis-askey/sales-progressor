import type { ProspectStatus, ProspectSource } from "@prisma/client";

// Pure constants for Prospects — no server imports, so client components can use
// them. The data layer (lib/command/prospects.ts) re-exports these.

export const PROSPECT_STATUSES: ProspectStatus[] = ["new", "contacted", "replied", "interested", "trial", "active", "lost"];
export const PROSPECT_SOURCES: ProspectSource[] = ["cold", "google", "linkedin", "referral", "chain", "solicitor", "existing_contact", "inbound", "other"];

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: "New", contacted: "Contacted", replied: "Replied", interested: "Interested",
  trial: "Trial / first sale", active: "Active", lost: "Lost",
};
export const SOURCE_LABEL: Record<ProspectSource, string> = {
  cold: "Cold outreach", google: "Google", linkedin: "LinkedIn", referral: "Referral",
  chain: "Chain exposure", solicitor: "Solicitor", existing_contact: "Existing contact",
  inbound: "Inbound", other: "Other",
};

export const CALL_OUTCOMES = ["no_answer", "spoke", "interested", "call_back", "not_interested", "other"] as const;
export const CALL_OUTCOME_LABEL: Record<string, string> = {
  no_answer: "No answer", spoke: "Spoke", interested: "Interested", call_back: "Call back",
  not_interested: "Not interested", other: "Other",
};

export const LOST_REASONS = ["not_interested", "existing_solution", "price", "no_response", "timing", "corporate_decision", "doesnt_outsource", "other"] as const;
export const LOST_REASON_LABEL: Record<string, string> = {
  not_interested: "Not interested", existing_solution: "Has a solution", price: "Price",
  no_response: "No response", timing: "Timing", corporate_decision: "Corporate decision",
  doesnt_outsource: "Doesn't outsource", other: "Other",
};

// Status pill colours for the list + drawer.
export const STATUS_TONE: Record<ProspectStatus, string> = {
  new: "bg-neutral-800 text-neutral-300 border-neutral-700",
  contacted: "bg-blue-950 text-blue-300 border-blue-900",
  replied: "bg-cyan-950 text-cyan-300 border-cyan-900",
  interested: "bg-violet-950 text-violet-300 border-violet-900",
  trial: "bg-amber-950 text-amber-300 border-amber-900",
  active: "bg-emerald-950 text-emerald-300 border-emerald-900",
  lost: "bg-red-950 text-red-400 border-red-900",
};

// ─── Research provenance + per-field verification ────────────────────────────

// verified = strong authoritative evidence. needs_check = probably right but not
// conclusive (single weaker source, conflict, or an inferred value). confirmed =
// Ellis personally reviewed and confirmed it (never overwritten by re-research).
export type FieldState = "verified" | "needs_check" | "confirmed";
export type FieldMeta = {
  state: FieldState;
  sourceUrl?: string;
  sourceName?: string; // "Companies House", "Official website", ...
  confidence?: "high" | "medium" | "low";
  researchedAt?: string; // ISO
  note?: string; // conflict / inference explanation
};
export type ResearchMeta = Record<string, FieldMeta>;

// Fields whose EMPTINESS should draw the eye — a genuine gap worth filling.
export const EXPECTED_PROSPECT_FIELDS = ["website", "phone", "generalEmail", "postcode", "location", "sizeNote"] as const;
export const EXPECTED_CONTACT_FIELDS = ["email", "phone", "jobTitle"] as const;

export type FieldVerdict = "normal" | "flag" | "missing";

// Visual verdict for one field: "missing" (empty + expected → highlight), "flag"
// (has a value but NEEDS_CHECK → warning), or "normal" (verified/confirmed/plain).
export function fieldVerdict(value: string | null | undefined, meta: FieldMeta | undefined, expected: boolean): FieldVerdict {
  const empty = value == null || String(value).trim() === "";
  if (empty) return expected ? "missing" : "normal";
  if (meta?.state === "needs_check") return "flag";
  return "normal";
}
