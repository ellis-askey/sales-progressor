// Phase 1 prereq #3 — reconcile genuinely fallen-through buyer rounds.
//
// Every PropertyTransaction whose status is 'withdrawn' AND whose
// activeBuyerRound is still status='active' is mis-aligned: that
// round did genuinely fall through. Set the round's status to
// 'withdrawn', archivedAt to now, and copy the transaction's
// fallThroughReason onto the round.
//
// Why: Phase 0 backfill stamped every round as active because Phase 0
// had no way to express "this file's buyer went away." This script
// closes that gap, so round status can be trusted before any Phase 1
// code reads it. On prod today this is a no-op (zero withdrawn files),
// but the script must EXIST and RUN before round status drives any
// behaviour.
//
// Idempotent: re-runs filter on round.status='active' AND
// transaction.status='withdrawn'; once reconciled, round.status is
// 'withdrawn' so the row is skipped.
//
// Run order: AFTER scripts/backfill-buyer-round-phase0.ts and
// scripts/resync-buyer-round-snapshots.ts.
//
// Run (dry, default):
//   npx ts-node --transpile-only -O '{"module":"CommonJS","esModuleInterop":true,"moduleResolution":"node"}' scripts/reconcile-withdrawn-rounds.ts
// Run (apply):
//   ... scripts/reconcile-withdrawn-rounds.ts --apply

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`[reconcile-withdrawn-rounds] ${APPLY ? "APPLY" : "DRY RUN"}`);

  // Preview what would be touched. Always run; helps surface scale
  // before writes.
  const candidates = await prisma.$queryRaw<
    { transactionId: string; address: string; reason: string | null; roundId: string }[]
  >`
    SELECT t.id AS "transactionId",
           t."propertyAddress" AS "address",
           t."fallThroughReason" AS "reason",
           r.id AS "roundId"
    FROM "BuyerRound" r
    JOIN "PropertyTransaction" t ON r.id = t."activeBuyerRoundId"
    WHERE r.status = 'active'::"BuyerRoundStatus"
      AND t.status = 'withdrawn'::"TransactionStatus"
  `;

  console.log(`  candidates (withdrawn tx with active round): ${candidates.length}`);
  for (const c of candidates) {
    const reason = c.reason ?? "(no reason captured on transaction)";
    console.log(`    ${c.transactionId} — ${c.address} — reason="${reason}"`);
  }

  if (!APPLY) {
    console.log(`\n[reconcile-withdrawn-rounds] dry run only — pass --apply to write`);
    return;
  }

  if (candidates.length === 0) {
    console.log(`\n[reconcile-withdrawn-rounds] nothing to do`);
    return;
  }

  // Set-based UPDATE — round.status, archivedAt, fallThroughReason
  // copied from the matching transaction. Idempotency comes from the
  // WHERE clause (round.status = 'active' filters out anything
  // already reconciled).
  const sql = Prisma.sql`
    UPDATE "BuyerRound" r
    SET status = 'withdrawn'::"BuyerRoundStatus",
        "archivedAt" = NOW(),
        "fallThroughReason" = t."fallThroughReason"
    FROM "PropertyTransaction" t
    WHERE r.id = t."activeBuyerRoundId"
      AND r.status = 'active'::"BuyerRoundStatus"
      AND t.status = 'withdrawn'::"TransactionStatus"
  `;
  const n = await prisma.$executeRaw(sql);
  console.log(`\n  rounds reconciled: ${n}`);
  console.log(`[reconcile-withdrawn-rounds] applied`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
