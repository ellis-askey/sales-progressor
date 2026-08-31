// lib/billing/terms-sections.ts
//
// Type definition + parse helper for TermsVersion.bodySections. The DB column
// is Prisma.JsonValue (untyped JSON); the application contract is an array of
// { heading, body } pairs. This is the single place we narrow it.

import type { ClientType } from "@prisma/client";

export type TermsSection = {
  heading: string;
  body: string;
};

/**
 * Narrow Prisma's JsonValue to TermsSection[]. Throws on shape violation —
 * the migration enforces the shape so this should never throw in practice;
 * the throw exists so a future schema drift surfaces loudly rather than
 * rendering a broken disclosure to a director about to enter card details.
 */
export function parseTermsSections(value: unknown): TermsSection[] {
  if (!Array.isArray(value)) {
    throw new Error("TermsVersion.bodySections must be an array");
  }
  return value.map((s, i) => {
    if (
      typeof s !== "object" ||
      s === null ||
      typeof (s as { heading?: unknown }).heading !== "string" ||
      typeof (s as { body?: unknown }).body !== "string"
    ) {
      throw new Error(`TermsVersion.bodySections[${i}] must be { heading: string, body: string }`);
    }
    return { heading: (s as TermsSection).heading, body: (s as TermsSection).body };
  });
}

/**
 * Per-agency display override. The canonical TermsVersion in the DB holds the
 * sliding-scale Charges paragraph used by sliding-tier agencies and the public
 * /billing-terms preview. Legacy agencies are on a fixed fee per their
 * pre-existing contract — they should see THEIR fee in the Charges section,
 * not a scale that doesn't apply to them.
 *
 * Contract:
 *   - identifies the Charges section by exact heading match. v3, v4 and v5 all
 *     use "Charges"; if a future version renames the heading the override will
 *     no-op and legacy agents would see the canonical scale again — easy to
 *     catch at version review.
 *   - defensive no-op when agency is null, feeTier is "standard", or
 *     legacyOutsourcedFeePence is null (admin error case — render canonical
 *     rather than £NaN).
 *   - does NOT mutate the input array.
 *
 * The audit record (PricingAcknowledgement) still points at the canonical
 * TermsVersion id; the legacy variant is reconstructable from (canonical
 * row + agency.feeTier + agency.legacyOutsourcedFeePence at acknowledgement
 * time). Legacy fees are essentially static so this is fine for first-pass;
 * if it ever needs hardening we can denormalise the displayed snapshot.
 */
export function applyAgencyTermsOverrides(
  sections: TermsSection[],
  agency: { feeTier: ClientType; legacyOutsourcedFeePence: number | null } | null | undefined,
): TermsSection[] {
  if (!agency || agency.feeTier !== "legacy" || agency.legacyOutsourcedFeePence == null) {
    return sections;
  }
  const fixedFee = `£${(agency.legacyOutsourcedFeePence / 100).toLocaleString("en-GB")}`;
  return sections.map((s) => {
    if (s.heading === "Charges") {
      return {
        ...s,
        body: `Fees apply only to sales you pass to our team to progress, and only on exchange of that sale. Sales you progress yourself are free, at every stage, with no charge on exchange. For a sale you pass to our team, the fee is a fixed ${fixedFee} per sale, regardless of the agreed sale price at exchange.`,
      };
    }
    // Legacy agencies are grandfathered on their fixed outsourced fee and,
    // unlike sliding-tier agencies, do NOT get a free first outsourced file —
    // they are billable from their first outsourced sale per their pre-existing
    // contract. Self-progress is free for them too. The canonical "Free sales"
    // wording (which promises a free first outsourced file) is misleading for
    // them, so we replace the body with a one-liner that's truthful for their
    // tier.
    if (s.heading === "Free sales") {
      return {
        ...s,
        body: "This agency is on a fixed-fee tier. Sales you progress yourself are free; outsourced sales are charged at the fixed fee from the first sale.",
      };
    }
    return s;
  });
}
