import { prisma } from "@/lib/prisma";

/**
 * Does this agency currently have a file being progressed by our team (an active
 * outsourced sale)? Used to show the "our team / your progressor" controls only
 * when there's actually a progressor relationship in play. A self-managed-only
 * agency has no team to send notes to or file requests with, so those controls
 * hide until the moment they outsource a file, then reappear.
 */
export async function agencyHasActiveOutsourcedFile(
  agencyId: string | null | undefined,
): Promise<boolean> {
  if (!agencyId) return false;
  const count = await prisma.propertyTransaction.count({
    where: { agencyId, serviceType: "outsourced", status: { in: ["active", "on_hold"] } },
  });
  return count > 0;
}
