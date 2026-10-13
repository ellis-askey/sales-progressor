// File-detail — Activity tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { ActivityPanel } from "@/components/transaction/ActivityPanel";
import { TabEnter } from "@/components/transaction/TabEnter";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";

export const unstable_dynamicStaleTime = 300;

export default async function ActivityTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalStaff, isProgressor, isAdminRole } = await loadFilePageContext(id);

  // Progression-business members can mark a note private to their team. They can
  // only ever reach their own business's files, so membership + flag is enough;
  // createCommunicationRecord re-checks the business scope as the boundary.
  const canMarkPrivate = progressionBusinessesEnabled() && !!session.user.progressionBusinessId;

  return (
    <TabEnter>
      <ActivityPanel
        transactionId={transaction.id}
        agencyId={session.user.agencyId}
        isInternalStaff={isInternalStaff}
        isProgressor={isProgressor}
        isAdminRole={isAdminRole}
        canMarkPrivate={canMarkPrivate}
        currentUserId={session.user.id}
        currentUserName={session.user.name ?? ""}
        currentUserRole={session.user.role ?? ""}
        contacts={transaction.contacts}
        vendorSolicitor={transaction.vendorSolicitorContact ?? null}
        purchaserSolicitor={transaction.purchaserSolicitorContact ?? null}
      />
    </TabEnter>
  );
}
