// "One progression route per agency" guard.
//
// Business rule (founder, 2026-10-15): an agency's outsourced sales must all go
// the SAME way — either TSP's own team OR an external progression company — never
// a mix of both at once. Self-progressed sales never count, and an agency may use
// several DIFFERENT external companies together (that is not a mix). This keeps
// billing, branding, and reporting unambiguous and removes the mixed-book edge
// case the service-split donut couldn't represent.
//
// This is a safety net for the edgest of edge cases, not a routine flow: when a
// mix is attempted it is blocked at the create / handover action AND ellis@ is
// alerted. Read-only here beyond the alert email; callers do the blocking.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export type OutsourcingKind = "tsp" | "external";

/**
 * Would adding an outsourced sale of `incoming` kind to this agency put it in a
 * mixed state (some TSP-managed, some external)? Looks at the agency's live
 * (active / on-hold) outsourced sales only. A "tsp" incoming clashes with any
 * existing external sale; an "external" incoming clashes with any existing TSP
 * sale. Two different external companies never clash with each other.
 */
export async function wouldMixOutsourcing(agencyId: string, incoming: OutsourcingKind): Promise<boolean> {
  const rows = await prisma.propertyTransaction.findMany({
    where: { agencyId, serviceType: "outsourced", status: { in: ["active", "on_hold"] } },
    select: { progressionBusinessId: true, progressionBusiness: { select: { isTsp: true } } },
  });
  // TSP-managed = no business tag, or the TSP row. External = a non-TSP business.
  const hasExternal = rows.some((t) => !!t.progressionBusinessId && !t.progressionBusiness?.isTsp);
  const hasTsp = rows.some((t) => !t.progressionBusinessId || t.progressionBusiness?.isTsp);
  return incoming === "tsp" ? hasExternal : hasTsp;
}

/** Alert the founder that a mix attempt was blocked. Best-effort; never throws. */
export async function alertOutsourcingMix(agencyId: string, incoming: OutsourcingKind, where: string): Promise<void> {
  try {
    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    const incomingLabel = incoming === "tsp" ? "TSP's own team" : "an external progression company";
    await sendEmail({
      to: "ellis@thesalesprogressor.co.uk",
      subject: `Blocked: outsourcing mix on ${agency?.name ?? agencyId}`,
      text:
        `A blocked attempt to mix progression routes on one agency.\n\n` +
        `Agency: ${agency?.name ?? "(unknown)"} (${agencyId})\n` +
        `Tried to add a sale going to: ${incomingLabel}\n` +
        `Where: ${where}\n\n` +
        `The agency already has live outsourced sales going the other way, so the ` +
        `action was blocked and nothing was changed. No action needed unless this ` +
        `agency genuinely needs both routes.`,
    });
  } catch (err) {
    console.error("[progression] outsourcing-mix alert email failed", err);
  }
}
