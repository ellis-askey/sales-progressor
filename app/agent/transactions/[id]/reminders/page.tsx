// File-detail — Reminders tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { RemindersPanel } from "@/components/transaction/RemindersPanel";

export const unstable_dynamicStaleTime = 300;

export default async function RemindersTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction } = await loadFilePageContext(id);
  return (
    <RemindersPanel
      transactionId={transaction.id}
      agencyId={session.user.agencyId}
      propertyAddress={transaction.propertyAddress}
      transactionStatus={transaction.status}
      contacts={transaction.contacts}
      vendorSolicitor={
        transaction.vendorSolicitorContact
          ? { ...transaction.vendorSolicitorContact, firm: transaction.vendorSolicitorFirm ?? null }
          : null
      }
      purchaserSolicitor={
        transaction.purchaserSolicitorContact
          ? { ...transaction.purchaserSolicitorContact, firm: transaction.purchaserSolicitorFirm ?? null }
          : null
      }
    />
  );
}
