// Outsourced handover readiness gate (Resilience audit II.4).
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
// Deliberately NOT required (can follow later): solicitor details (downstream),
// purchase price (only needed at exchange).
//
// Pure + dependency-free (types only) so it is unit-testable in isolation and
// importable from both the service and action layers without pulling in prisma.

import type { Tenure, PurchaseType, ContactRole } from "@prisma/client";

export type HandoverReadiness = { ready: boolean; missing: string[] };

export function checkOutsourcedHandoverReadiness(input: {
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  contacts: { roleType: ContactRole; name?: string | null; phone?: string | null; email?: string | null }[];
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
  return { ready: missing.length === 0, missing };
}

// Human-readable message for the thrown error / returned error string. Kept
// separate so callers can render it directly in a toast or inline checklist.
export function handoverReadinessMessage(missing: string[]): string {
  return `This file can't be handed to the progressor team yet. Please add: ${missing.join("; ")}.`;
}
