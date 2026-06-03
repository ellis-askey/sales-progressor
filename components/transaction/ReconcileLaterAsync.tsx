// Async server-component wrapper for ReconcileLaterBanner. Loads the
// milestone definitions the picker needs and renders the banner only
// for claimed files where the agent chose "I'll set this up later"
// during the claim flow (localStorage flag, gated client-side inside
// the banner). Off the critical path; Suspense fallback={null}.

import { Suspense } from "react";
import type { PurchaseType, Tenure } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ReconcileLaterBanner } from "@/components/transaction/ReconcileLaterBanner";

type Props = {
  transactionId: string;
  chainLinkId: string | null;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
};

async function Inner({ transactionId, chainLinkId, tenure, purchaseType }: Props) {
  if (!chainLinkId) return null;

  const milestoneDefinitions = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    select: { id: true, code: true, name: true, side: true, orderIndex: true, blocksExchange: true },
  }).catch(() => []);

  if (milestoneDefinitions.length === 0) return null;

  return (
    <ReconcileLaterBanner
      transactionId={transactionId}
      milestoneDefinitions={milestoneDefinitions}
      tenure={tenure}
      purchaseType={purchaseType}
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
