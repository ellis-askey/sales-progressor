// Async server-component wrapper that fetches the chain (members + each joined
// sale's shared progress %) for the claim welcome modal, then renders it.
//
// Off the page's critical path because the modal only ever shows when
// ?newUser=1 lands on a freshly-claimed file. Suspense fallback={null} so
// nothing flashes for everyone else.

import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChainForTransactionV2 } from "@/lib/services/chains";
import { ClaimWelcomeModal, type ChainMember } from "@/components/transaction/ClaimWelcomeModal";

type Props = {
  address: string;
  transactionId: string;
  chainLinkId: string | null;
};

function shortAddress(a: string): string {
  return a.split(",")[0]?.trim() || a;
}

async function Inner({ address, transactionId, chainLinkId }: Props) {
  if (!chainLinkId) {
    return <ClaimWelcomeModal address={address} members={[]} connectedCount={0} />;
  }

  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id;

  const [originatorAgency, chain] = await Promise.all([
    prisma.chainLink
      .findUnique({ where: { id: chainLinkId }, select: { createdBy: { select: { firmName: true } } } })
      .then((l) => l?.createdBy?.firmName ?? null)
      .catch(() => null),
    viewerUserId ? getChainForTransactionV2(transactionId, viewerUserId).catch(() => null) : Promise.resolve(null),
  ]);

  const members: ChainMember[] = (chain?.links ?? []).map((l) => {
    const isYou = l.transactionId === transactionId;
    const isJoined = l.transactionId != null;
    const addr = shortAddress(isJoined ? (l.transaction?.propertyAddress ?? "") : (l.stubPropertyAddress ?? ""));
    return {
      address: addr || "A sale in the chain",
      status: isYou ? "you" : isJoined ? "joined" : "pending",
      progress: isJoined ? (l.progressPercent ?? null) : null,
    };
  });
  const connectedCount = (chain?.links ?? []).filter((l) => l.transactionId != null).length;

  return (
    <ClaimWelcomeModal
      address={address}
      originatorAgency={originatorAgency ?? undefined}
      members={members}
      connectedCount={connectedCount}
    />
  );
}

export function ClaimWelcomeAsync(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
