import { loadFilePageContext } from "@/lib/services/file-page-context";
import { prisma } from "@/lib/prisma";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { nameWithoutTitle } from "@/lib/contacts/displayName";
import { TabEnter } from "@/components/transaction/TabEnter";
import { ClientPortalPreview, type PortalPreviewClient } from "@/components/transaction/ClientPortalPreview";

export const unstable_dynamicStaleTime = 300;

export default async function ClientPortalTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Access-checked: notFound() if the agent can't see this file.
  const { transaction } = await loadFilePageContext(id);

  // The file's portal-eligible clients, scoped to the active buyer round so a
  // relisted file never surfaces a previous buyer's portal (round-scope.ts).
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transaction.id },
    select: {
      activeBuyerRoundId: true,
      contacts: {
        select: {
          id: true,
          name: true,
          roleType: true,
          portalToken: true,
          portalEligible: true,
          buyerRoundId: true,
        },
      },
    },
  });

  const clients: PortalPreviewClient[] = (tx?.contacts ?? [])
    .filter((c) => c.portalEligible && !!c.portalToken)
    .filter((c) => isActiveRoundContact(c, tx?.activeBuyerRoundId ?? null))
    // Sellers first, then buyers — the natural "your client, then the other side"
    // reading order on a listing file.
    .sort((a, b) => (a.roleType === b.roleType ? 0 : a.roleType === "vendor" ? -1 : 1))
    .map((c) => ({
      id: c.id,
      name: nameWithoutTitle(c.name) || "Client",
      roleType: c.roleType,
      token: c.portalToken as string,
    }));

  return (
    <TabEnter>
      <ClientPortalPreview clients={clients} transactionId={transaction.id} />
    </TabEnter>
  );
}
