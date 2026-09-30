import { prisma } from "@/lib/prisma";
import { listCheckpoints } from "@/lib/services/checkpoints";
import { extractFirstName } from "@/lib/contacts/displayName";
import { CheckpointsPanel } from "./CheckpointsPanel";

// Agent-side "Checkpoints" card on the file Overview tab (critique #21 + #23).
// Server wrapper: loads the checkpoints + the two clients' first names, then
// hands off to the interactive client panel.
export async function CheckpointsCard({ transactionId }: { transactionId: string }) {
  const [items, contacts] = await Promise.all([
    listCheckpoints(transactionId),
    prisma.contact.findMany({
      where: { propertyTransactionId: transactionId, roleType: { in: ["vendor", "purchaser"] }, isPrincipal: true },
      select: { roleType: true, name: true },
    }),
  ]);
  const vendor = contacts.find((c) => c.roleType === "vendor");
  const purchaser = contacts.find((c) => c.roleType === "purchaser");
  return (
    <CheckpointsPanel
      transactionId={transactionId}
      vendorName={vendor ? extractFirstName(vendor.name) : "the seller"}
      purchaserName={purchaser ? extractFirstName(purchaser.name) : "the buyer"}
      hasVendor={!!vendor}
      hasPurchaser={!!purchaser}
      items={items}
    />
  );
}
