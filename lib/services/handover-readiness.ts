// Outsourced handover readiness gate (Resilience audit II.4; solicitor rules
// added by founder decision 2026-09-18).
//
// When a file becomes "outsourced" (the Sales Progressor team takes over
// progressing it), the agency must have supplied the minimum operational
// information the SP team needs to actually work it. Previously the only guard
// was client-side validation in NewSaleFlow, so four server routes (direct
// create, self->outsourced switch, draft promote, migrate) could hand us an
// under-specified file. This is the single server-side standard, applied at
// every accept-the-file point. It reads the SAME shape whether the caller has
// input-shaped or persisted data.
//
// Required at handover (what SP automation genuinely needs to start):
//   - a seller (vendor) with a name and at least one channel (phone or email)
//   - a buyer (purchaser) with a name and at least one channel
//   - tenure (gates the whole milestone engine)
//   - purchase type (gates the milestone engine + exchange path)
//   - BOTH solicitors fully set up: firm AND a named case handler on each
//     side. Founder decision 2026-09-18 (28 Granville Road): an outsourced
//     file must arrive complete — a firm without a named person means our
//     team spends its time finding out who the case handler is, which is
//     the agency's job, not ours. This supersedes the earlier "solicitors
//     can follow later" stance FOR OUTSOURCED FILES ONLY; self-managed
//     files may still start with no solicitors at all.
// Deliberately NOT required (can follow later): purchase price (only needed
// at exchange).
//
// Pure + dependency-free (types only) so it is unit-testable in isolation and
// importable from both the service and action layers without pulling in prisma.

import type { Tenure, PurchaseType, ContactRole } from "@prisma/client";

export type HandoverReadiness = { ready: boolean; missing: string[] };

// Universal solicitor invariant (founder decision 2026-09-18): a solicitor on
// TSP is a PERSON at a firm — a firm may never be attached without a named
// case handler, on ANY service type. (Having no solicitor at all remains
// allowed on self-managed files.) Used by every path that writes the
// solicitor columns: create, draft promote, and the Professionals-tab save.
export function solicitorPairViolation(
  firmId: string | null | undefined,
  contactId: string | null | undefined,
): boolean {
  return !!firmId && !contactId;
}

export function checkOutsourcedHandoverReadiness(input: {
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  contacts: { roleType: ContactRole; name?: string | null; phone?: string | null; email?: string | null }[];
  vendorSolicitorFirmId: string | null;
  vendorSolicitorContactId: string | null;
  purchaserSolicitorFirmId: string | null;
  purchaserSolicitorContactId: string | null;
}): HandoverReadiness {
  const missing: string[] = [];
  const hasReachable = (role: "vendor" | "purchaser") =>
    input.contacts.some(
      (c) =>
        c.roleType === role &&
        (c.name ?? "").trim().length > 0 &&
        (((c.phone ?? "").trim().length > 0) || ((c.email ?? "").trim().length > 0)),
    );
  if (!hasReachable("vendor")) missing.push("a seller with a name and a phone number or email");
  if (!hasReachable("purchaser")) missing.push("a buyer with a name and a phone number or email");
  if (!input.tenure) missing.push("the tenure (freehold or leasehold)");
  if (!input.purchaseType) missing.push("the purchase type (cash or mortgage)");
  if (!input.vendorSolicitorFirmId || !input.vendorSolicitorContactId) {
    missing.push("the seller's solicitor firm and their named case handler");
  }
  if (!input.purchaserSolicitorFirmId || !input.purchaserSolicitorContactId) {
    missing.push("the buyer's solicitor firm and their named case handler");
  }
  return { ready: missing.length === 0, missing };
}

// Human-readable message for the thrown error / returned error string. Kept
// separate so callers can render it directly in a toast or inline checklist.
export function handoverReadinessMessage(missing: string[]): string {
  return `This file can't be handed to the progressor team yet. Please add: ${missing.join("; ")}.`;
}

// Voice-passed message for the universal firm-without-handler violation.
export function solicitorHandlerRequiredMessage(side: "seller" | "buyer"): string {
  return `Add the named case handler for the ${side}'s solicitor. A firm can't be saved without the person handling the file.`;
}
