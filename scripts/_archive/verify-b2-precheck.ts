// B2 pre-migration validation (run BEFORE prisma migrate deploy).
//
// B2 adds:
//   - a brand new table "ClientChaseState"
//   - a new nullable column "expectedDate" on "MilestoneCompletion"
//
// Both are pure-additive. The migration would only fail if:
//   - a table named "ClientChaseState" already exists in the database
//   - a column named "expectedDate" already exists on "MilestoneCompletion"
//
// Both conditions should be impossible by definition (we're adding them
// for the first time), but the user asked for the same pre-validation
// protocol as A5 — so confirm against the actual data state rather than
// assumption.

import { prisma } from "../lib/prisma";

async function main() {
  console.log(`[b2-precheck] Database: ${(process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "unknown"}`);

  // Q1: Does ClientChaseState table already exist?
  const tableExists = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'ClientChaseState'`,
  );
  console.log(`[b2-precheck] ClientChaseState table exists: ${tableExists.length > 0 ? "YES (BLOCK)" : "no (safe)"}`);

  // Q2: Does MilestoneCompletion.expectedDate column already exist?
  const columnExists = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'MilestoneCompletion' AND column_name = 'expectedDate'`,
  );
  console.log(`[b2-precheck] MilestoneCompletion.expectedDate column exists: ${columnExists.length > 0 ? "YES (BLOCK)" : "no (safe)"}`);

  // Q3: For context — current MilestoneCompletion columns
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'MilestoneCompletion'
     ORDER BY ordinal_position`,
  );
  console.log(`[b2-precheck] MilestoneCompletion has ${cols.length} columns currently:`);
  for (const c of cols) {
    console.log(`  - ${c.column_name} ${c.data_type} ${c.is_nullable === "YES" ? "(nullable)" : "(NOT NULL)"}`);
  }

  if (tableExists.length > 0 || columnExists.length > 0) {
    console.error(`[b2-precheck] FAIL: at least one B2 schema target already exists. Migration cannot apply cleanly.`);
    process.exit(1);
  }

  console.log(`[b2-precheck] PASS: B2 migration is safe to apply against this database.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
