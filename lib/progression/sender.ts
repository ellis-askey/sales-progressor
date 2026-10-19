// The verified WHITE-LABEL sending address for an OUTSOURCED (external progression
// business) file — resolved so that two progression companies at the same agency
// NEVER share one sending identity (which would merge two separate businesses'
// correspondence into one inbox / one From address).
//
// Resolution order:
//   1. The per-(company, agency) sender — the address the agency provisions THIS
//      company on its own domain (ProgressionBusinessClient.senderEmail), verified.
//   2. The agency's own verified sender (Agency.quoteSenderEmail) — ONLY when the
//      agency has a SINGLE active progressor, so it unambiguously belongs to them.
//      (A multi-progressor agency's shared address can't be attributed to one
//      company, so it is never used — each company must be provisioned its own.)
//   3. The company's OWN verified sender (its own domain, ProgressionBusiness.senderEmail).
//
// Returns null when none is set up. The caller then falls back to the platform
// address for the From line (updates@thesalesprogressor.co.uk — deliverability only,
// we can't send from an unverified address) and to the assigned progressor's own
// inbox for Reply-To / the client-facing contact (never the platform address).

import { prisma } from "@/lib/prisma";

export type WhiteLabelSenderInput = {
  agencyId: string;
  progressionBusinessId: string | null;
  // Agency-level sender (quoteSenderEmail + quoteSenderVerified).
  agencyQuoteSenderEmail: string | null;
  agencyQuoteSenderVerified: boolean;
  // The responsible progression business's OWN verified sender (its own domain).
  business: { senderEmail: string | null; senderVerified: boolean; isTsp: boolean } | null;
};

export async function resolveOutsourcedWhiteLabelSender(
  input: WhiteLabelSenderInput,
): Promise<string | null> {
  const { agencyId, progressionBusinessId, agencyQuoteSenderEmail, agencyQuoteSenderVerified, business } = input;

  // 1. Per-(company, agency) sender — the proper per-company identity.
  if (progressionBusinessId) {
    const link = await prisma.progressionBusinessClient.findUnique({
      where: { progressionBusinessId_agencyId: { progressionBusinessId, agencyId } },
      select: { senderEmail: true, senderVerified: true },
    });
    if (link?.senderVerified && link.senderEmail?.trim()) return link.senderEmail.trim();
  }

  // 2. Agency's own verified sender — only when there's a single active progressor
  // (no ambiguity, so no merge risk). Preserves every single-progressor setup.
  if (agencyQuoteSenderEmail?.trim() && agencyQuoteSenderVerified) {
    const activeProgressors = await prisma.progressionBusinessClient.count({
      where: { agencyId, removedAt: null },
    });
    if (activeProgressors <= 1) return agencyQuoteSenderEmail.trim();
  }

  // 3. The company's own verified sender (its own domain).
  if (business && !business.isTsp && business.senderVerified && business.senderEmail?.trim()) {
    return business.senderEmail.trim();
  }

  return null;
}
