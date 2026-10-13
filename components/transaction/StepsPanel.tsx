// Async server component for the Steps tab on the file detail page.
// Fetches the milestone view + chase metadata and renders the existing
// MilestonePanel. Mounted under <Suspense> so the rest of the page
// paints first.

import type { PurchaseType } from "@prisma/client";
import { getMilestonesCached, getGraceDaysCached, getClientChaseStatesCached } from "@/lib/services/cached-fetchers";
import { prisma } from "@/lib/prisma";
import { MilestonePanel } from "@/components/milestones/MilestonePanel";
import { StepsEmailHint } from "@/components/transaction/StepsEmailHint";
import type { PartyNameContext } from "@/lib/milestones/step-name";

type Props = {
  transactionId: string;
  agencyId: string;
  userId: string;
  purchaseType: PurchaseType | null;
  // Buyer name(s) for the "re-open mortgage steps" modal's subtitle.
  buyerNames?: string[];
  // Real party names for personalising the step labels (firm + seller/buyer).
  partyNames?: PartyNameContext;
};

export async function StepsPanel({ transactionId, agencyId, userId, purchaseType, buyerNames, partyNames }: Props) {
  const [milestoneData, graceDaysMap, clientChaseByCode, activeRound] = await Promise.all([
    getMilestonesCached(transactionId, agencyId).catch(() => null),
    getGraceDaysCached().catch(() => new Map<string, number>()),
    getClientChaseStatesCached(transactionId).catch(() => ({})),
    // Active round's createdAt — floors the "Awaiting X days" staleness badge so
    // a relisted file's new buyer doesn't inherit a prior round's prereq date
    // (same clamp OverviewPanel applies to "days stuck on milestone").
    prisma.propertyTransaction
      .findUnique({ where: { id: transactionId }, select: { activeBuyerRound: { select: { createdAt: true } } } })
      .then((r) => r?.activeBuyerRound?.createdAt ?? null)
      .catch(() => null),
  ]);

  if (!milestoneData) {
    return <p className="text-sm text-slate-900/40 text-center py-12">No milestone data available</p>;
  }

  const graceDaysByCode: Record<string, number> = Object.fromEntries(graceDaysMap);

  return (
    <>
      {/* Confirm-time cue: agents should know confirming a step emails the
          client, and where to control it. Dismissible per user, once. */}
      <StepsEmailHint userId={userId} />
      <MilestonePanel
        transactionId={transactionId}
        vendor={milestoneData.vendor}
        purchaser={milestoneData.purchaser}
        exchangeReady={milestoneData.exchangeReady}
        vendorGateReady={milestoneData.vendorGateReady}
        purchaserGateReady={milestoneData.purchaserGateReady}
        completionDate={milestoneData.completionDate}
        graceDaysByCode={graceDaysByCode}
        clientChaseByCode={clientChaseByCode}
        purchaseType={purchaseType}
        buyerNames={buyerNames}
        partyNames={partyNames}
        activeRoundStartedAt={activeRound}
      />
    </>
  );
}
