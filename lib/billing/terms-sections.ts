// lib/billing/terms-sections.ts
//
// Type definition + parse helper for TermsVersion.bodySections. The DB column
// is Prisma.JsonValue (untyped JSON); the application contract is an array of
// { heading, body } pairs. This is the single place we narrow it.

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
