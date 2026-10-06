// Spot a likely company/business name so the contact forms can quietly prompt
// for a real contact person (critique 2026-10-05). Deliberately light-touch —
// it only drives a small inline nudge, never anything irreversible. Client-safe.

const BUSINESS_RE =
  /\b(ltd|limited|llp|llc|plc|inc|co|company|developments?|property|properties|homes?|estates?|holdings?|group|partners|partnership|investments?|ventures?|trustees?|trust|enterprises?|construction|builders?|lettings?|associates|solutions|services)\b\.?/i;

export function looksLikeBusiness(name: string | null | undefined): boolean {
  if (!name) return false;
  return BUSINESS_RE.test(name.trim());
}
