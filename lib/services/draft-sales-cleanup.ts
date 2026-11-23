// Permanently remove draft sales (status "draft" — started but never completed)
// that nobody has touched in 30 days. A buyer who hasn't progressed in a month
// almost certainly isn't, so this saves clearing them up by hand (Ellis, founder
// — delete for good, measured from last touch).
//
// "Last touched" = updatedAt (Prisma @updatedAt), so a draft anyone is actively
// working on never gets swept. Demo and migrated rows are left to their own
// lifecycles. Related records (contacts, buyer rounds, milestone rows, …) go
// with the transaction via the schema's onDelete: Cascade — the exact path the
// user-facing discardDraftAction already relies on.

import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";

const DRAFT = "draft" as TransactionStatus;
const STALE_DAYS = 30;

export async function deleteStaleDraftSales(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.propertyTransaction.deleteMany({
    where: {
      status: DRAFT,
      isDemo: false,
      isMigrated: false,
      updatedAt: { lt: cutoff },
    },
  });
  return count;
}
