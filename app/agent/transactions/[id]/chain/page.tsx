// File-detail — Chain tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { ChainTabLoader } from "@/components/transaction/ChainTabLoader";
import { TabEnter } from "@/components/transaction/TabEnter";

export const unstable_dynamicStaleTime = 300;

export default async function ChainTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction } = await loadFilePageContext(id);
  return (
    <TabEnter>
      <ChainTabLoader
        transactionId={transaction.id}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </TabEnter>
  );
}
