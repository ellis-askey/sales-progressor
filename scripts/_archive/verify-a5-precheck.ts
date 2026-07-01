// A5 pre-migration validation.
//
// Before applying the migration that drops NOT NULL from
// OutboundEmailQueue.recipientUserId and adds a CHECK constraint that
// requires exactly one of (recipientUserId, recipientContactId) to be
// non-null, verify every existing row already satisfies that condition.
//
// Pre-migration data state:
//   - Every row has recipientUserId set (column is currently NOT NULL).
//   - recipientContactId column does not yet exist.
//   - After migration: recipientContactId added with default NULL → existing
//     rows have userId IS NOT NULL AND contactId IS NULL → CHECK passes.
//
// The check to run NOW: confirm no row has recipientUserId IS NULL. If any
// such row exists, the CHECK constraint would fail at migration time. With
// the column currently NOT NULL this should be impossible, but verify so the
// migration plan rests on facts, not assumptions.
//
// Run against staging via the default DATABASE_URL in .env. For production,
// run the same query via the Supabase SQL editor (or temporarily set
// DATABASE_URL to a read-only prod URL and re-run).

import { prisma } from "../lib/prisma";

async function main() {
  // 1. Total existing rows (for context)
  const total = await prisma.outboundEmailQueue.count();
  console.log(`[a5-precheck] OutboundEmailQueue row count: ${total}`);

  // 2. Rows that would fail the future CHECK
  //    (Pre-migration: only recipientUserId IS NULL matters because
  //    recipientContactId doesn't exist yet.)
  const wouldFail = await prisma.outboundEmailQueue.count({
    where: { recipientUserId: { equals: null } as never },
  }).catch(async () => {
    // The TS narrowing may complain that the column isn't nullable; fall
    // back to a raw query that doesn't care.
    const r = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "OutboundEmailQueue" WHERE "recipientUserId" IS NULL`
    );
    return Number(r[0]?.count ?? 0);
  });
  console.log(`[a5-precheck] Rows with recipientUserId IS NULL: ${wouldFail} (expect 0)`);

  // 3. Sample row shape — confirms the column we're about to alter exists
  //    and is currently typed as we expect.
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; is_nullable: string; data_type: string }>>(
    `SELECT column_name, is_nullable, data_type
     FROM information_schema.columns
     WHERE table_name = 'OutboundEmailQueue'
     ORDER BY ordinal_position`
  );
  console.log(`[a5-precheck] OutboundEmailQueue current columns:`);
  for (const c of cols) {
    console.log(`  - ${c.column_name} ${c.data_type} ${c.is_nullable === "YES" ? "(nullable)" : "(NOT NULL)"}`);
  }

  if (wouldFail > 0) {
    console.error(`[a5-precheck] FAIL: ${wouldFail} row(s) would violate the post-migration CHECK constraint.`);
    process.exit(1);
  }
  console.log(`[a5-precheck] PASS: migration is safe to apply against this database.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
