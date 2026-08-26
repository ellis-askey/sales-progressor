// Async server component for the Steps tab on the file detail page.
// Fetches the milestone view + chase metadata and renders the existing
// MilestonePanel. Mounted under <Suspense> so the rest of the page
// paints first.

import type { PurchaseType } from "@prisma/client";
import { getMilestonesCached, getGraceDaysCached, getClientChaseStatesCached } from "@/lib/services/cached-fetchers";
import { MilestonePanel } from "@/components/milestones/MilestonePanel";

type Props = {
  transactionId: string;
  agencyId: string;
  purchaseType: PurchaseType | null;
};

export async function StepsPanel({ transactionId, agencyId, purchaseType }: Props) {
  const [milestoneData, graceDaysMap, clientChaseByCode] = await Promise.all([
    getMilestonesCached(transactionId, agencyId).catch(() => null),
    getGraceDaysCached().catch(() => new Map<string, number>()),
    getClientChaseStatesCached(transactionId).catch(() => ({})),
  ]);

  if (!milestoneData) {
    return <p className="text-sm text-slate-900/40 text-center py-12">No milestone data available</p>;
  }

  const graceDaysByCode: Record<string, number> = Object.fromEntries(graceDaysMap);

  return (
    <>
      {/* Confirm-time cue: agents should know confirming a step emails the
          client, and where to control it. */}
      <p
        className="mb-3 rounded-lg px-3 py-2 text-[12.5px]"
        style={{ background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)", color: "var(--agent-text-muted)" }}
      >
        Confirming a step sends an update to the buyer and seller. You can turn that off per file in Email settings.
      </p>
      <MilestonePanel
        transactionId={transactionId}
        vendor={milestoneData.vendor}
        purchaser={milestoneData.purchaser}
        exchangeReady={milestoneData.exchangeReady}
        vendorGateReady={milestoneData.vendorGateReady}
        purchaserGateReady={milestoneData.purchaserGateReady}
        graceDaysByCode={graceDaysByCode}
        clientChaseByCode={clientChaseByCode}
        purchaseType={purchaseType}
      />
    </>
  );
}
