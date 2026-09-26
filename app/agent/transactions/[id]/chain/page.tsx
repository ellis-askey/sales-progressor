// File-detail — Chain tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { ChainTabLoader } from "@/components/transaction/ChainTabLoader";
import { TabEnter } from "@/components/transaction/TabEnter";
import { getChainTabPayload } from "@/lib/services/chains";
import { getAccessScope } from "@/lib/security/access-scope";

export const unstable_dynamicStaleTime = 300;

export default async function ChainTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction } = await loadFilePageContext(id);
  // Render the chain SERVER-side so it arrives with the tab — no client fetch +
  // second skeleton (ij13f6). ChainView reconciles + polls live via refreshKey.
  const initialChainData = await getChainTabPayload(transaction.id, {
    userId: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
    scope: getAccessScope(session),
  });
  return (
    <TabEnter>
      <ChainTabLoader
        transactionId={transaction.id}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        initialChainData={initialChainData}
      />
    </TabEnter>
  );
}
