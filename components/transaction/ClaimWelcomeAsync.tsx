// Async server-component wrapper that fetches the originator agency
// name for the claim welcome modal, then renders ClaimWelcomeModal.
//
// Off the page's critical path because the modal only ever shows when
// ?newUser=1 lands on a freshly-claimed file. Suspense fallback={null}
// so nothing flashes for everyone else.

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ClaimWelcomeModal } from "@/components/transaction/ClaimWelcomeModal";

type Props = {
  address: string;
  chainLinkId: string | null;
};

async function Inner({ address, chainLinkId }: Props) {
  const originatorAgency = chainLinkId
    ? await prisma.chainLink.findUnique({
        where: { id: chainLinkId },
        select: { createdBy: { select: { firmName: true } } },
      }).then((l) => l?.createdBy?.firmName ?? null).catch(() => null)
    : null;

  return <ClaimWelcomeModal address={address} originatorAgency={originatorAgency ?? undefined} />;
}

export function ClaimWelcomeAsync(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
