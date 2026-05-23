// Health audit — read-only checks against prod DB.
// 1. Grammar fix migration: VM4 + PM27 updated, PM26 unchanged (control).
// 2. ChainNotificationQueue schema present and empty (post-recreate).
// 3. ChainWithdrawalStatus enum includes BREAK_CHAIN.
// 4. ChainNotificationType + ChainDirection enums exist.

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

console.log("=== 1. Grammar fix on production ===");
const rows = await p.milestoneDefinition.findMany({
  where: { code: { in: ["VM4", "PM26", "PM27", "VM1"] } },
  select: { code: true, summaryTemplate: true },
  orderBy: { code: "asc" },
});
for (const r of rows) console.log(r.code + ": " + r.summaryTemplate);

console.log();
console.log("=== 2. ChainNotificationQueue (post-recreate) ===");
const cnqCount = await p.chainNotificationQueue.count();
console.log("rows: " + cnqCount);

// Schema introspection via raw query for new columns
const cnqCols = await p.$queryRawUnsafe(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ChainNotificationQueue' ORDER BY ordinal_position"
);
console.log("columns:");
for (const c of cnqCols) console.log("  - " + c.column_name + " (" + c.data_type + ")");

console.log();
console.log("=== 3. Enum values present ===");
const enums = await p.$queryRawUnsafe(`
  SELECT t.typname, e.enumlabel
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typname IN ('ChainWithdrawalStatus', 'ChainNotificationType', 'ChainDirection')
  ORDER BY t.typname, e.enumsortorder
`);
const byType = {};
for (const row of enums) {
  byType[row.typname] = byType[row.typname] || [];
  byType[row.typname].push(row.enumlabel);
}
for (const [k, vs] of Object.entries(byType)) {
  console.log(k + ": " + vs.join(", "));
}

await p.$disconnect();
