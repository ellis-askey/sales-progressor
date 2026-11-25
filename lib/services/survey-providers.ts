import "server-only";

// Who may use the TSP survey/provider quote network.
//
// The vetted-surveyor "request a quote" flow is a TSP progression service, so it
// is offered ONLY on files TSP actually progresses AND has been outsourced to us
// (the outsourced-to-TSP case). Self-managed agencies and external progression
// businesses do not get it — their buyers are routed to "ask my agent for a
// recommendation" instead (see requestSurveyRecommendationAction). Temporary:
// agencies will be able to add their own providers in the new year, at which
// point this gate is revisited.
//
// IMPORTANT (fix 2026-11): an outsourced-to-TSP file is NOT identified by the
// email-audience bucket. Those files carry progressionBusinessId = null (the
// legacy/default TSP representation) with serviceType = "outsourced", which the
// bucket helper maps to "free_agency" — so the old `fileBucket(...) ===
// "tsp_outsourced"` gate never matched a real outsourced-to-TSP sale and the
// whole quote network was dark for them. We mirror the access-scope
// discriminator instead: progressed by TSP (progressionBusinessId null OR the
// isTsp row) AND serviceType "outsourced". See lib/security/access-scope.ts.

import { prisma } from "@/lib/prisma";
import type { ServiceType } from "@prisma/client";

/**
 * Does this file get the TSP vetted-surveyor quote network?
 *   - serviceType "outsourced"              → outsourced to us (not self-managed)
 *   - progressionBusinessId null OR isTsp   → TSP progresses it (not an external firm)
 * Both conditions must hold.
 */
export function fileOffersTspProviders(tx: {
  serviceType: ServiceType;
  progressionBusinessId: string | null;
  isTsp: boolean;
}): boolean {
  if (tx.serviceType !== "outsourced") return false; // self-managed agency
  return tx.progressionBusinessId == null || tx.isTsp; // TSP, not an external business
}

const OWNER_SELECT = {
  serviceType: true,
  progressionBusinessId: true,
  progressionBusiness: { select: { isTsp: true } },
} as const;

export async function txOffersTspProviders(transactionId: string): Promise<boolean> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: OWNER_SELECT,
  });
  if (!tx) return false;
  return fileOffersTspProviders({
    serviceType: tx.serviceType,
    progressionBusinessId: tx.progressionBusinessId,
    isTsp: tx.progressionBusiness?.isTsp ?? false,
  });
}

// Everything a buyer surface needs to decide the survey path in the fewest
// queries: whether this file gets the TSP quote network, the agency name to show
// in the "ask my agent" copy, and whether this buyer has already asked.
export async function getSurveyProviderContext(
  transactionId: string,
  contactId: string,
): Promise<{ offersTsp: boolean; agencyName: string; askedForReco: boolean }> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { ...OWNER_SELECT, agency: { select: { name: true } } },
  });
  const offersTsp = tx
    ? fileOffersTspProviders({
        serviceType: tx.serviceType,
        progressionBusinessId: tx.progressionBusinessId,
        isTsp: tx.progressionBusiness?.isTsp ?? false,
      })
    : false;
  const agencyName = tx?.agency?.name ?? "";
  const askedForReco = offersTsp ? false : await hasRequestedSurveyReco(transactionId, contactId);
  return { offersTsp, agencyName, askedForReco };
}

// Marker subject on the outbound note we write when a (non-TSP) buyer asks their
// agent for a surveyor recommendation. Used both to record the ask on the file
// timeline and to detect the "we've asked them" state so the card can't refire.
export const SURVEY_RECO_REQUEST_SUBJECT = "Survey recommendation requested";

export async function hasRequestedSurveyReco(transactionId: string, contactId: string): Promise<boolean> {
  const n = await prisma.outboundMessage.count({
    where: { transactionId, contactIds: { has: contactId }, subject: SURVEY_RECO_REQUEST_SUBJECT },
  });
  return n > 0;
}
