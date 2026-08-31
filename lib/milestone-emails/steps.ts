// lib/milestone-emails/steps.ts
//
// Builds the ordered list of milestone steps for the email-copy editors (the
// Command Centre matrix and the agency-facing Account editor): which sides each
// step emails, and which scenario a step is specific to (mortgage-only buyer
// steps, leasehold-only management-pack steps). Brand-neutral so both surfaces
// can import it (the agent app must not import lib/command — Law 8).

import "server-only";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { JOURNEY_ORDER } from "@/lib/email-skeletons/journey-order";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";

// Buyer steps that only happen with a mortgage (no email for a cash buyer).
export const MORTGAGE_ONLY_CODES = new Set(["PM5", "PM6", "PM11"]);
// Management-pack steps that only happen on a leasehold sale/purchase.
export const LEASEHOLD_ONLY_CODES = new Set(["VM8", "VM9", "VM12", "PM12"]);

export type StepMeta = {
  code: string;
  label: string;
  sides: string[]; // which recipient sides have copy: vendor/purchaser/vendorAgent/progressor
  mortgageOnly: boolean;
  leaseholdOnly: boolean;
};

const SIDES = ["vendor", "purchaser", "vendorAgent", "progressor"] as const;

export function buildStepList(): StepMeta[] {
  const out: StepMeta[] = [];
  for (const code of JOURNEY_ORDER) {
    if (RETIRED_ENQUIRY_CODES.has(code)) continue;
    const c = getMilestoneCopy(code);
    if (!c.emailCopy) continue;
    const sides = SIDES.filter((s) => c.emailCopy?.[s]);
    out.push({
      code,
      label: c.label,
      sides,
      mortgageOnly: MORTGAGE_ONLY_CODES.has(code),
      leaseholdOnly: LEASEHOLD_ONLY_CODES.has(code),
    });
  }
  return out;
}
