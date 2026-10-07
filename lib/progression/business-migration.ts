// The 48-hour "bring in an existing sale" window for a progression business.
//
// A business onboarding its book can bring in sales that are already underway
// (isMigrated = true). Those are NOT charged TSP's £5 at add — only if they reach
// exchange (see lib/services/billing-trigger.ts). To stop the £5-at-add being
// dodged by labelling everything a migration, the window is time-boxed: it opens
// on the FIRST migrated sale and stays open for 48 hours. After that, bringing in
// more is a "contact support" path. Derived from the earliest migrated sale's
// createdAt — no stored field needed.

import { prisma } from "@/lib/prisma";

export const MIGRATION_WINDOW_HOURS = 48;

export type MigrationWindow = {
  /** Has this business brought in at least one sale yet? */
  everStarted: boolean;
  /** Can they bring in a sale right now? (not started yet, or within 48h of the first) */
  open: boolean;
  /** When the window opened (first migrated sale), or null if not started. */
  startedAt: Date | null;
  /** Whole hours left while open; 0 once closed; full window before it starts. */
  hoursLeft: number;
};

export async function getMigrationWindow(businessId: string, now: Date = new Date()): Promise<MigrationWindow> {
  const first = await prisma.propertyTransaction.findFirst({
    where: { progressionBusinessId: businessId, isMigrated: true },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (!first) {
    return { everStarted: false, open: true, startedAt: null, hoursLeft: MIGRATION_WINDOW_HOURS };
  }
  const windowMs = MIGRATION_WINDOW_HOURS * 3_600_000;
  const elapsedMs = now.getTime() - first.createdAt.getTime();
  const open = elapsedMs < windowMs;
  const hoursLeft = open ? Math.max(0, Math.ceil((windowMs - elapsedMs) / 3_600_000)) : 0;
  return { everStarted: true, open, startedAt: first.createdAt, hoursLeft };
}
