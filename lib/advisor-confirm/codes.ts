// The mortgage milestones a mortgage advisor sees in their portal and (from
// Phase 2) can confirm: application submitted → lender valuation → mortgage offer.
// The solicitor flow is left untouched — PM11 stays confirmable by the buyer's
// solicitor too (whoever confirms the shared step first completes it).

export const ADVISOR_CODES = ["PM5", "PM6", "PM11"] as const;
export type AdvisorCode = (typeof ADVISOR_CODES)[number];

const ADVISOR_STEP_LABELS: Record<string, string> = {
  PM5: "Mortgage application submitted",
  PM6: "Lender valuation booked",
  PM11: "Mortgage offer received",
};

export function advisorStepLabel(code: string, fallback: string): string {
  return ADVISOR_STEP_LABELS[code] ?? fallback;
}
