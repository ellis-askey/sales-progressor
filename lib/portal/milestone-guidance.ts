// Authoritative external guidance links surfaced in the client portal's
// milestone help sheet (the "?" next to a step's Confirm button). Only a
// handful of steps carry one — the moments where a buyer or seller genuinely
// wants to read something official, not every step.
//
// Stamp duty is deliberately absent: buyers already get the full calculator in
// their portal (PortalCostsCard), so a gov link there would be noise. The
// agent's version of the same calculator lives in StampDutyDrawer.
//
// Every URL verified live 2026-08-30.

export type MilestoneGuidance = {
  /** The authoritative page. */
  url: string;
  /** The body the page belongs to — shown quietly beside the link. */
  source: string;
};

const LAW_SOCIETY_FORMS = "https://www.lawsociety.org.uk/topics/property/transaction-forms";
const RICS_SURVEYS = "https://www.rics.org/consumer-guides/house-surveys-uk-the-costs-types-and-benefits-of-an-rics-home-survey";
const GOV_LEASEHOLD = "https://www.gov.uk/leasehold-property";
const GOV_LAND_REGISTRY = "https://www.gov.uk/registering-land-or-property-with-land-registry";
const MONEYHELPER_BUYING = "https://www.moneyhelper.org.uk/en/homes/buying-a-home";

const GUIDANCE: Record<string, MilestoneGuidance> = {
  // Property information forms (TA6 / TA10).
  VM5: { url: LAW_SOCIETY_FORMS, source: "Law Society" },
  VM6: { url: LAW_SOCIETY_FORMS, source: "Law Society" },

  // Surveys — the Level 2 vs Level 3 choice.
  PM9: { url: RICS_SURVEYS, source: "RICS" },
  PM10: { url: RICS_SURVEYS, source: "RICS" },

  // Leasehold / management pack.
  VM8: { url: GOV_LEASEHOLD, source: "GOV.UK" },
  VM9: { url: GOV_LEASEHOLD, source: "GOV.UK" },
  PM12: { url: GOV_LEASEHOLD, source: "GOV.UK" },

  // Registration after completion.
  VM20: { url: GOV_LAND_REGISTRY, source: "GOV.UK" },
  PM27: { url: GOV_LAND_REGISTRY, source: "GOV.UK" },

  // Mortgage — impartial, government-backed guidance.
  PM5: { url: MONEYHELPER_BUYING, source: "MoneyHelper" },
  PM11: { url: MONEYHELPER_BUYING, source: "MoneyHelper" },
};

export function getMilestoneGuidance(code: string | null | undefined): MilestoneGuidance | null {
  if (!code) return null;
  return GUIDANCE[code] ?? null;
}
