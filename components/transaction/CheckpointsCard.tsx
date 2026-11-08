import { prisma } from "@/lib/prisma";
import { listCheckpoints } from "@/lib/services/checkpoints";
import { nameWithoutTitle } from "@/lib/contacts/displayName";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { CheckpointsPanel } from "./CheckpointsPanel";

// Agent-side "Checkpoints" card on the file Overview tab (critique #21 + #23).
// Server wrapper: loads the checkpoints + every principal client's full name
// (critique #294 — list everybody, individually, full names via
// nameWithoutTitle so "Mr Askey" stays "Mr Askey"), then hands off to the
// interactive client panel. Purchasers are scoped to the active buyer round so
// a relisted file doesn't resurrect a fallen-through buyer.
export async function CheckpointsCard({ transactionId }: { transactionId: string }) {
  const [items, contacts, tx] = await Promise.all([
    listCheckpoints(transactionId),
    prisma.contact.findMany({
      where: { propertyTransactionId: transactionId, roleType: { in: ["vendor", "purchaser"] }, isPrincipal: true },
      select: { roleType: true, name: true, buyerRoundId: true, image: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: { activeBuyerRoundId: true },
    }),
  ]);
  const vendorPeople = contacts
    .filter((c) => c.roleType === "vendor")
    .map((c) => ({ name: nameWithoutTitle(c.name), image: c.image }));
  const purchaserPeople = contacts
    .filter((c) => c.roleType === "purchaser" && isActiveRoundContact(c, tx?.activeBuyerRoundId ?? null))
    .map((c) => ({ name: nameWithoutTitle(c.name), image: c.image }));
  return (
    <CheckpointsPanel
      transactionId={transactionId}
      vendorPeople={vendorPeople}
      purchaserPeople={purchaserPeople}
      items={items}
    />
  );
}
