// Phase 1 prereq #2 — re-sync the BuyerRound snapshot fields from the
// live PropertyTransaction values for every ACTIVE round.
//
// Why: Phase 0's backfill copied snapshot columns
// (purchasePrice, purchaserSolicitorFirmId, purchaserSolicitorContactId,
// brokerFirmId, brokerContactId) at backfill time. If a buyer-side
// field has been edited on the transaction since, the round's snapshot
// is stale. This script overwrites those columns with the live
// PropertyTransaction values for every active round.
//
// Why only active rounds: archived rounds carry historical truth that
// must not be overwritten — they represent the buyer-side state at the
// moment the round was archived. (Phase 1 has no archived rounds yet
// because zero withdrawn files exist on prod; but the filter is
// load-bearing for the future when reconcile + relist start writing
// archived rounds.)
//
// Idempotent: re-running rewrites the same values. Run AFTER
// scripts/backfill-buyer-round-phase0.ts (so every transaction has a
// round to re-sync), BEFORE scripts/reconcile-withdrawn-rounds.ts (so
// reconciliation sees fresh snapshots).
//
// Run (dry, default):
//   npx ts-node --transpile-only -O '{"module":"CommonJS","esModuleInterop":true,"moduleResolution":"node"}' scripts/resync-buyer-round-snapshots.ts
// Run (apply):
//   ... scripts/resync-buyer-round-snapshots.ts --apply
//
// Point at staging via DATABASE_URL/DIRECT_URL; never invoke directly
// against prod without explicit approval per Rule 3.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`[resync-buyer-round-snapshots] ${APPLY ? "APPLY" : "DRY RUN"}`);

  // Set-based UPDATE: re-sync every active round's snapshot from its
  // owning transaction. WHERE clause filters out rows that already
  // match (so the affected-row count is the "actually-changed"
  // count — re-runs report 0 because nothing differs).
  const sql = Prisma.sql`
    UPDATE "BuyerRound" r
    SET
      "purchasePrice" = t."purchasePrice",
      "purchaserSolicitorFirmId" = t."purchaserSolicitorFirmId",
      "purchaserSolicitorContactId" = t."purchaserSolicitorContactId",
      "brokerFirmId" = t."brokerFirmId",
      "brokerContactId" = t."brokerContactId"
    FROM "PropertyTransaction" t
    WHERE r."transactionId" = t.id
      AND r.status = 'active'
      AND (
        r."purchasePrice" IS DISTINCT FROM t."purchasePrice"
        OR r."purchaserSolicitorFirmId" IS DISTINCT FROM t."purchaserSolicitorFirmId"
        OR r."purchaserSolicitorContactId" IS DISTINCT FROM t."purchaserSolicitorContactId"
        OR r."brokerFirmId" IS DISTINCT FROM t."brokerFirmId"
        OR r."brokerContactId" IS DISTINCT FROM t."brokerContactId"
      )
  `;

  if (!APPLY) {
    // Dry-run: count what WOULD change.
    const preview = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "BuyerRound" r
      JOIN "PropertyTransaction" t ON r."transactionId" = t.id
      WHERE r.status = 'active'
        AND (
          r."purchasePrice" IS DISTINCT FROM t."purchasePrice"
          OR r."purchaserSolicitorFirmId" IS DISTINCT FROM t."purchaserSolicitorFirmId"
          OR r."purchaserSolicitorContactId" IS DISTINCT FROM t."purchaserSolicitorContactId"
          OR r."brokerFirmId" IS DISTINCT FROM t."brokerFirmId"
          OR r."brokerContactId" IS DISTINCT FROM t."brokerContactId"
        )
    `;
    console.log(`  rounds that WOULD change: ${preview[0].count}`);
    console.log(`\n[resync-buyer-round-snapshots] dry run only — pass --apply to write`);
    return;
  }

  const n = await prisma.$executeRaw(sql);
  console.log(`  rounds re-synced: ${n}`);
  console.log(`\n[resync-buyer-round-snapshots] applied`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
