import "server-only";

// Who may use the TSP survey/provider quote network.
//
// The vetted-surveyor "request a quote" flow is a TSP progression service, so it
// is offered ONLY on files TSP actually progresses (the tsp_outsourced bucket).
// Self-managed agencies and external progression businesses do not get it — their
// buyers are routed to "ask my agent for a recommendation" instead (see
// requestSurveyRecommendationAction). Temporary: agencies will be able to add
// their own providers in the new year, at which point this gate is revisited.

import { prisma } from "@/lib/prisma";
import { fileBucket } from "@/lib/email/audience-buckets";
import { resolveFileBucketByTransaction } from "@/lib/email/bucket-toggles";

export async function txOffersTspProviders(transactionId: string): Promise<boolean> {
  return (await resolveFileBucketByTransaction(transactionId)) === "tsp_outsourced";
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
    select: {
      progressionBusinessId: true,
      progressionBusiness: { select: { isTsp: true } },
      agency: { select: { name: true } },
    },
  });
  const offersTsp = tx
    ? fileBucket({ progressionBusinessId: tx.progressionBusinessId, isTsp: tx.progressionBusiness?.isTsp ?? false }) === "tsp_outsourced"
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
