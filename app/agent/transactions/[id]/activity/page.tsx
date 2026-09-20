// File-detail — Activity tab (route segment). Renders only when this tab is open.
// The SP/admin sender identity for ComposeEmail is resolved here (it was on the
// old monolithic page's critical path; now it only runs when Activity is open).
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { prisma } from "@/lib/prisma";
import { ActivityPanel } from "@/components/transaction/ActivityPanel";

export const unstable_dynamicStaleTime = 300;

export default async function ActivityTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalStaff, isProgressor, isAdminRole } = await loadFilePageContext(id);

  const spSenderIdentity = await (async (): Promise<{ name: string; email: string } | undefined> => {
    if (!isInternalStaff || (!isProgressor && !isAdminRole)) return undefined;
    const agencyId = transaction.agencyId;
    if (!agencyId) return { name: "Sales Progressor", email: "updates@thesalesprogressor.co.uk" };
    const domain = await prisma.verifiedDomain.findFirst({
      where: { agencyId, status: "verified" },
      select: { id: true },
    });
    const userEmail = domain
      ? await prisma.userVerifiedEmail.findFirst({
          where: {
            userId: session.user.id,
            verifiedDomainId: domain.id,
            status: { in: ["verified", "legacy_single_sender"] },
          },
          select: { email: true },
        })
      : null;
    return userEmail
      ? { name: session.user.name!, email: userEmail.email }
      : { name: "Sales Progressor", email: "updates@thesalesprogressor.co.uk" };
  })();

  return (
    <ActivityPanel
      transactionId={transaction.id}
      agencyId={session.user.agencyId}
      isInternal={isInternalStaff}
      isInternalStaff={isInternalStaff}
      isProgressor={isProgressor}
      isAdminRole={isAdminRole}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? ""}
      currentUserRole={session.user.role ?? ""}
      spSenderIdentity={spSenderIdentity}
      contacts={transaction.contacts}
      vendorSolicitor={transaction.vendorSolicitorContact ?? null}
      purchaserSolicitor={transaction.purchaserSolicitorContact ?? null}
    />
  );
}
