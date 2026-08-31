// lib/milestone-emails/preview.ts
//
// Fills a milestone email's {tokens} with representative example values so the
// email-copy editors (Command Centre matrix + agency Account editor) show
// roughly what a real recipient would see for the selected scenario. The
// conditional strings mirror the live logic in lib/services/portal.ts (kept in
// sync by hand — this is preview only, never what actually sends). Brand-neutral
// so the agent app can import it without reaching into lib/command (Law 8).

import "server-only";
import type { RecipientEmailCopy } from "@/lib/portal-copy";
import type { Scenario } from "@/lib/services/milestone-copy-overrides";

// Mirrors the mortgage-only paragraph in portal.ts ({valuationNote}).
const MORTGAGE_VALUATION_NOTE =
  " This is your own survey and is separate from your lender's valuation. The lender's valuation is primarily for their benefit, whereas your survey gives you a much more detailed picture of the property's condition.";
const PURCHASER_PHYSICAL_NOTE =
  " Their primary concern is that it's worth enough to secure their loan. It's not a structural survey and won't flag problems with the condition of the property.";
const VENDOR_VISIT_NOTE =
  " A surveyor acting for the lender will visit to value the property. Access has been arranged, so nothing else for you to do right now.";

function previewVars(code: string, scenario: Scenario): Record<string, string> {
  const isPM6 = code === "PM6";
  const isPM9 = code === "PM9";
  return {
    address: "12 Example Road, Harlow, CM17 9PH",
    eventDate: isPM6 || isPM9 ? ", Thursday 14 May 2026" : "",
    eventDateClause: isPM6 ? "booked for Thursday 14 May 2026" : "",
    attendClause: isPM6 ? " and will attend on the 14th of May" : "",
    purchaserPhysicalNote: isPM6 ? PURCHASER_PHYSICAL_NOTE : "",
    vendorVisitNote: isPM6 ? VENDOR_VISIT_NOTE : "",
    completionDate: "Friday 15 August 2026",
    surveyorClause: isPM9 ? " with Hentons Surveyors" : "",
    valuationNote: isPM9 && scenario.method === "mortgage" ? MORTGAGE_VALUATION_NOTE : "",
  };
}

function interp(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export type RenderedPreview = {
  subject: string;
  heroLabel: string;
  opening: string;
  whatHappened: string;
  whatNext: string | null;
  action: string | null;
};

export function renderPreview(
  copy: RecipientEmailCopy,
  code: string,
  scenario: Scenario
): RenderedPreview {
  const vars = previewVars(code, scenario);
  return {
    subject: interp(copy.subject, vars),
    heroLabel: interp(copy.heroLabel, vars),
    opening: interp(copy.opening, vars),
    whatHappened: interp(copy.whatHappened, vars),
    whatNext: copy.whatNext ? interp(copy.whatNext, vars) : null,
    action: copy.action,
  };
}
