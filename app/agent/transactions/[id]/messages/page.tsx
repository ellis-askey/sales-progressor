// File-detail — Messages tab (route segment). Native buyer/seller messaging,
// staff side (Phase 1). Gated to the pilot: non-pilot staff OR non-pilot files
// get notFound() (undiscoverable), on top of loadFilePageContext's access-scope.
import { notFound } from "next/navigation";
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { canUseMessages, fileInMessagesPilot } from "@/lib/agency-features/messages";
import { getStaffFileMessaging } from "@/lib/services/messaging/read";
import { TabEnter } from "@/components/transaction/TabEnter";
import { StaffMessagesTab } from "@/components/messaging/StaffMessagesTab";

export const unstable_dynamicStaleTime = 300;

export default async function MessagesTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction } = await loadFilePageContext(id);
  if (!canUseMessages(session) || !fileInMessagesPilot(transaction.id)) notFound();

  const data = await getStaffFileMessaging(transaction.id, session.user.id);

  return (
    <TabEnter stage>
      <StaffMessagesTab transactionId={transaction.id} initialSides={data.sides} />
    </TabEnter>
  );
}
