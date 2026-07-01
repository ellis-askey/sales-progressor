// Verification script for PR 1 (payments_scaffolding) against staging.
// Read-only. Confirms:
//   1. Every Agency that has >=1 PropertyTransaction has non-null firstSubmissionAt
//      (backfill correctness).
//   2. firstSubmissionAt matches MIN(PropertyTransaction.createdAt) for each.
//   3. All new payments fields exist on PropertyTransaction with expected defaults.
//   4. All new payments tables exist and are empty (no behaviour wired yet).
//   5. TermsVersion is empty (no placeholder seeding).
//   6. New enums present in pg_type.

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

console.log("=== 1. Backfill: firstSubmissionAt non-null for agencies with transactions ===");
const agenciesWithTxnsNullFirst = await p.$queryRawUnsafe(`
  SELECT a."id", a."name"
  FROM "Agency" a
  WHERE a."firstSubmissionAt" IS NULL
    AND EXISTS (SELECT 1 FROM "PropertyTransaction" pt WHERE pt."agencyId" = a."id")
`);
check(
  "Every agency with >=1 transaction has firstSubmissionAt set",
  agenciesWithTxnsNullFirst.length === 0,
  agenciesWithTxnsNullFirst.length === 0
    ? `0 violators`
    : `${agenciesWithTxnsNullFirst.length} agencies still null: ${agenciesWithTxnsNullFirst.map((a) => a.name).join(", ")}`,
);

console.log();
console.log("=== 2. Backfill correctness: firstSubmissionAt = MIN(tx.createdAt) per agency ===");
const mismatches = await p.$queryRawUnsafe(`
  SELECT a."id", a."name", a."firstSubmissionAt", sub."earliest"
  FROM "Agency" a
  JOIN (
    SELECT "agencyId", MIN("createdAt") AS "earliest"
    FROM "PropertyTransaction"
    GROUP BY "agencyId"
  ) sub ON sub."agencyId" = a."id"
  WHERE a."firstSubmissionAt" IS DISTINCT FROM sub."earliest"
`);
check(
  "Every backfilled firstSubmissionAt equals MIN(transaction.createdAt)",
  mismatches.length === 0,
  mismatches.length === 0
    ? "all match"
    : `${mismatches.length} mismatches`,
);

console.log();
console.log("=== 3. New PropertyTransaction columns present with expected defaults ===");
const ptCols = await p.$queryRawUnsafe(`
  SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'PropertyTransaction'
    AND column_name IN ('freeOnExchange', 'exchangedAt', 'billedAtExchange', 'priceAtExchange')
  ORDER BY column_name
`);
check("4 new PropertyTransaction columns present", ptCols.length === 4, `found ${ptCols.length}`);
for (const c of ptCols) console.log(`    ${c.column_name}: ${c.data_type}, nullable=${c.is_nullable}, default=${c.column_default ?? "—"}`);

console.log();
console.log("=== 4. New Agency columns present ===");
const agCols = await p.$queryRawUnsafe(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'Agency'
    AND column_name IN ('firstSubmissionAt', 'vatRegisteredAt', 'vatRateBps', 'stripeCustomerId', 'paymentFailedAt', 'newFileCreationBlockedAt')
  ORDER BY column_name
`);
check("6 new Agency columns present", agCols.length === 6, `found ${agCols.length}`);
for (const c of agCols) console.log(`    ${c.column_name}: ${c.data_type}, nullable=${c.is_nullable}`);

console.log();
console.log("=== 5. New tables exist and are empty ===");
const tables = ["Invoice", "InvoiceLine", "TermsVersion", "PricingAcknowledgement", "CreditNote"];
for (const t of tables) {
  const rows = await p.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
  check(`${t} exists and is empty`, rows[0].n === 0, `${rows[0].n} rows`);
}

console.log();
console.log("=== 6. TermsVersion empty (no placeholder copy seeded) ===");
const termsCount = await p.termsVersion.count();
check("TermsVersion has 0 rows", termsCount === 0, `${termsCount} rows`);

console.log();
console.log("=== 7. New enums present ===");
const enums = await p.$queryRawUnsafe(`
  SELECT t.typname, e.enumlabel
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typname IN ('InvoiceStatus', 'InvoiceLineKind')
  ORDER BY t.typname, e.enumsortorder
`);
const byType = {};
for (const row of enums) {
  byType[row.typname] = byType[row.typname] || [];
  byType[row.typname].push(row.enumlabel);
}
check("InvoiceStatus enum has 5 values", (byType.InvoiceStatus?.length ?? 0) === 5, byType.InvoiceStatus?.join(", "));
check("InvoiceLineKind enum has 3 values", (byType.InvoiceLineKind?.length ?? 0) === 3, byType.InvoiceLineKind?.join(", "));

console.log();
console.log("=== 8. Counts for context ===");
const agencyCount = await p.agency.count();
const txCount = await p.propertyTransaction.count();
const agenciesWithTx = await p.$queryRawUnsafe(`
  SELECT COUNT(DISTINCT "agencyId")::int AS n FROM "PropertyTransaction"
`);
const agenciesWithFirst = await p.agency.count({ where: { firstSubmissionAt: { not: null } } });
console.log(`    Agencies total: ${agencyCount}`);
console.log(`    Agencies with >=1 transaction: ${agenciesWithTx[0].n}`);
console.log(`    Agencies with firstSubmissionAt set: ${agenciesWithFirst}`);
console.log(`    PropertyTransactions total: ${txCount}`);

await p.$disconnect();

console.log();
if (failures === 0) {
  console.log("✓ All checks passed");
  process.exit(0);
} else {
  console.log(`✗ ${failures} check(s) failed`);
  process.exit(1);
}
