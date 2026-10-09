// lib/legal/progression-business-terms.ts
//
// Single source of truth for the current Sales Progression Business Terms
// version. The Terms page (app/progression-business-terms/page.tsx) renders this
// as its version, and sign-up records it against the business
// (ProgressionBusiness.termsAcceptedVersion) so we always know which version each
// business agreed to. Bump this string whenever the Terms are amended.
export const PROGRESSION_BUSINESS_TERMS_VERSION = "1.0";
