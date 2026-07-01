// Pre-flight for the chain_withdrawal_cascade_v1 migration: confirms the
// ChainNotificationQueue table is empty before the DROP+CREATE migration runs.
// Use against staging and production before invoking npm run db:migrate:*.

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const count = await p.chainNotificationQueue.count();
console.log("ChainNotificationQueue row count: " + count);
if (count > 0) {
  console.error("ABORT: table has rows. Investigate before recreating.");
  process.exit(1);
}
console.log("OK to recreate.");
await p.$disconnect();
