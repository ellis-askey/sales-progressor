// Async server-component wrapper that fetches the chain (members + each joined
// sale's shared progress %) for the claim welcome modal, then renders it.
//
// Off the page's critical path because the modal only ever shows when
// ?newUser=1 lands on a freshly-claimed file. Suspense fallback={null} so
// nothing flashes for everyone else.
//
// Critique #237: also resolves the chase set-up welcome for a claiming
// DIRECTOR (their agency's current chase flags + theme), so the first-run flow
// can follow the chain welcome with the toggles step. Non-directors (who can't
// save agency prefs) just get the chain welcome, as before.

import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChainForTransactionV2 } from "@/lib/services/chains";
import { getAgentChasePrefs } from "@/lib/services/agent-chase-prefs";
import { readThemeModeFromPrefs } from "@/lib/agent/theme-mode";
import { ClaimFirstRunFlow } from "@/components/transaction/ClaimFirstRunFlow";
import type { ChainMember } from "@/components/transaction/ClaimWelcomeModal";

type Props = {
  address: string;
  transactionId: string;
  chainLinkId: string | null;
};

function shortAddress(a: string): string {
  return a.split(",")[0]?.trim() || a;
}

async function Inner({ address, transactionId, chainLinkId }: Props) {
  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id;

  // Chase set-up props for a director of a customer agency. Resolved here (one
  // user read + one agency read) because this whole subtree is already off the
  // critical path behind Suspense.
  const chaseSetup =
    session?.user?.role === "director" && session.user.agencyId
      ? await (async () => {
          const [prefs, userRecord] = await Promise.all([
            getAgentChasePrefs(session.user.agencyId),
            prisma.user.findUnique({
              where: { id: session.user.id },
              select: { name: true, agentPreferences: true },
            }),
          ]);
          return {
            userName: userRecord?.name ?? session.user.name ?? "",
            initialPrefs: prefs,
            themeMode: readThemeModeFromPrefs(userRecord?.agentPreferences),
          };
        })()
      : null;

  if (!chainLinkId) {
    return <ClaimFirstRunFlow address={address} members={[]} connectedCount={0} chaseSetup={chaseSetup} />;
  }

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
    <ClaimFirstRunFlow
      address={address}
      originatorAgency={originatorAgency ?? undefined}
      members={members}
      connectedCount={connectedCount}
      chaseSetup={chaseSetup}
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
