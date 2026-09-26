import { prisma } from "@/lib/prisma";
import { ChainTabPanel } from "@/components/chain/ChainTabPanel";
import type { ChainTabPayload } from "@/lib/services/chains";

// Async server wrapper for the property-file Chain tab. Streams under Suspense
// like the other tab bodies. Its only server-side data is the viewer's chain
// decline notification (an agent declined an invite) — the chain itself is
// fetched client-side by ChainView. Mirrors the decline lookup OverviewPanel
// does for its chain summary card.
export async function ChainTabLoader({
  transactionId,
  currentUserId,
  currentUserRole,
  initialChainData,
}: {
  transactionId: string;
  currentUserId: string;
  currentUserRole?: string | null;
  initialChainData?: ChainTabPayload | null;
}) {
  const user = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { chainDeclineNotificationAddress: true, chainDeclineNotificationAt: true },
  });

  const declineNotification =
    user?.chainDeclineNotificationAddress && user?.chainDeclineNotificationAt
      ? {
          address: user.chainDeclineNotificationAddress,
          at: user.chainDeclineNotificationAt.toISOString(),
        }
      : null;

  return (
    <ChainTabPanel
      transactionId={transactionId}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      declineNotification={declineNotification}
      initialChainData={initialChainData ?? null}
    />
  );
}
