// Async server-component wrapper for ReconcileLaterBanner. Loads the
// milestone definitions the picker needs and renders the banner only
// for claimed files where the agent chose "I'll set this up later"
// during the claim flow (localStorage flag, gated client-side inside
// the banner). Off the critical path; Suspense fallback={null}.

import { Suspense } from "react";
import type { PurchaseType, Tenure } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ReconcileLaterBanner } from "@/components/transaction/ReconcileLaterBanner";
import { getInheritedProgressForTransaction } from "@/lib/services/onward";
import type { ReconciliationState } from "@/components/milestones/ReconcileMilestonePicker";

type Props = {
  transactionId: string;
  chainLinkId: string | null;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
};

async function Inner({ transactionId, chainLinkId, tenure, purchaseType }: Props) {
  if (!chainLinkId) return null;

  const [milestoneDefinitions, completedCount, inherited] = await Promise.all([
    prisma.milestoneDefinition
      .findMany({
        orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
        select: { id: true, code: true, name: true, side: true, orderIndex: true, blocksExchange: true },
      })
      .catch(() => []),
    // The prompt retires itself once the file has any real progress — i.e. the
    // agent has completed their first step (here or on the Steps tab).
    prisma.milestoneCompletion.count({ where: { transactionId, state: "complete" } }).catch(() => 0),
    // Carry-over: what the chain's neighbours reported about this property (both
    // sides), used to pre-tick the list. Anonymised — codes + dates only.
    getInheritedProgressForTransaction(transactionId).catch(() => null),
  ]);

  if (milestoneDefinitions.length === 0) return null;

  // Map the reported codes onto milestone-definition ids the picker uses, keyed
  // by side so a PM code only pre-ticks a purchaser step and vice versa.
  let seed: ReconciliationState | undefined;
  if (inherited) {
    const built: ReconciliationState = {};
    for (const d of milestoneDefinitions) {
      const inSet =
        d.side === "purchaser" ? inherited.purchaserCodes.includes(d.code) : inherited.vendorCodes.includes(d.code);
      if (inSet) built[d.id] = { ticked: true, eventDate: inherited.dates[d.code] ?? "" };
    }
    if (Object.keys(built).length > 0) seed = built;
  }

  return (
    <ReconcileLaterBanner
      transactionId={transactionId}
      milestoneDefinitions={milestoneDefinitions}
      tenure={tenure}
      purchaseType={purchaseType}
      hasProgress={completedCount > 0}
      seed={seed}
    />
  );
}

export function ReconcileLaterAsync(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
