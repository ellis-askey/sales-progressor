// Segmentation + personalisation allow-list for the outreach engine (Build Order D).
//
// Segments are computed ONLY from verified, structured fields we genuinely hold.
// Derived region (from the stored postcode) is permitted for aggregate analysis
// and targeting, but is NOT a personalisation field — it must never become a
// claim in generated copy. Inferred categories (independent/franchise/corporate,
// owner-led, eXp/self-employed, listing volume, branch-size tiers) do NOT exist
// as structured fields and are explicitly forbidden from both context and copy.

import { extractFirstName } from "@/lib/contacts/displayName";

// ── Segment dimensions (analysis + targeting only) ──────────────────────────

export type SegmentDimension = "source" | "branch_structure" | "contact_history" | "region";

export const SEGMENT_DIMENSIONS: SegmentDimension[] = [
  "source",
  "branch_structure",
  "contact_history",
  "region",
];

// The minimal prospect shape the segment extractors need.
export type ProspectSegmentInput = {
  source: string | null;
  groupId: string | null;
  followUpCount: number;
  lastContactedAt: Date | null;
  postcode: string | null;
};

export function branchStructure(p: { groupId: string | null }): "standalone" | "multi_branch" {
  return p.groupId ? "multi_branch" : "standalone";
}

// ANALYTICAL ONLY. Being in "contacted_before" must never, by itself, make a
// prospect eligible for new outreach — eligibility/suppression are separate and
// deterministic (Build Order H). This is for reporting/segmentation only.
export function contactHistory(p: { followUpCount: number; lastContactedAt: Date | null }): "never_contacted" | "contacted_before" {
  return p.followUpCount > 0 || p.lastContactedAt ? "contacted_before" : "never_contacted";
}

// Coarse region = the UK postcode AREA (the leading letters, e.g. "CT" from
// "CT1 2AB"). Derived, not stored; for aggregate analysis + targeting only.
export function coarseRegionFromPostcode(postcode: string | null): string | null {
  if (!postcode) return null;
  const m = postcode.trim().toUpperCase().match(/^([A-Z]{1,2})\d/);
  return m ? m[1] : null;
}

export function segmentValue(dimension: SegmentDimension, p: ProspectSegmentInput): string {
  switch (dimension) {
    case "source":
      return p.source ?? "unknown";
    case "branch_structure":
      return branchStructure(p);
    case "contact_history":
      return contactHistory(p);
    case "region":
      return coarseRegionFromPostcode(p.postcode) ?? "unknown";
  }
}

// ── Personalisation allow-list (fields the AI may EVER use in copy) ──────────

export type AllowedPersonalisationField = "firstName" | "agencyName";

export const PERSONALISATION_ALLOWLIST: {
  field: AllowedPersonalisationField;
  source: string;
  note: string;
}[] = [
  {
    field: "firstName",
    source: "ProspectContact.name -> extractFirstName()",
    note: "Only when a primary contact name is on file; omitted otherwise.",
  },
  {
    field: "agencyName",
    source: "Prospect.agencyName",
    note: "The verified agency / brand name.",
  },
];

export const ALLOWED_PERSONALISATION_FIELDS: ReadonlySet<AllowedPersonalisationField> = new Set(
  PERSONALISATION_ALLOWLIST.map((f) => f.field),
);

// Attribute keywords the models must NEVER infer or assert. Used to keep both the
// assembled context and (later) generated copy clean of unsupported claims.
export const FORBIDDEN_INFERRED_ATTRIBUTES: string[] = [
  "independent",
  "franchise",
  "corporate",
  "owner-led",
  "owner led",
  "ownerled",
  "exp",
  "self-employed",
  "self employed",
  "listing volume",
  "listings volume",
  "branch size",
  "branch-size",
  "branch tier",
  "size tier",
];

// The ONLY personalisation values allowed for a given prospect/contact. Anything
// not returned here must not appear as a personalised fact in copy.
export function allowedPersonalisation(input: {
  agencyName: string | null;
  primaryContactName: string | null;
}): Partial<Record<AllowedPersonalisationField, string>> {
  const out: Partial<Record<AllowedPersonalisationField, string>> = {};
  const first = input.primaryContactName ? extractFirstName(input.primaryContactName) : "";
  if (first) out.firstName = first;
  if (input.agencyName && input.agencyName.trim()) out.agencyName = input.agencyName.trim();
  return out;
}

// Best-effort guard: flags forbidden inferred-attribute phrases in generated
// text. The primary guarantee is that copy only interpolates allowedPersonalisation
// values (enforced at generation time, Build Order F/G); this catches obvious
// inferred claims as a backstop. Returns the matched forbidden phrases.
export function findForbiddenInferredClaims(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_INFERRED_ATTRIBUTES.filter((attr) => lower.includes(attr));
}
