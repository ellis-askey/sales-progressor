// One-shot: put the 40 Tresco Road Hartwell fixture transaction on hold
// on STAGING so Ellis can walk the new banner + on-hold-freeze UI.
//
// Sets PropertyTransaction.status='on_hold' and opens a TransactionHoldPeriod
// row matching what putFileOnHold() does — so the UI behaves identically to
// a real action click.
//
// Usage: node scripts/put-tresco-on-hold.mjs
// Reads DATABASE_URL from .env (currently staging — verified by env-fix).

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const TX_ID = "cmpfbdh5b0001d9y8lh901sbh"; // 40 Tresco Road

const tx = await p.propertyTransaction.findUnique({
  where: { id: TX_ID },
  select: { id: true, propertyAddress: true, status: true, agentUserId: true, assignedUserId: true, agencyId: true },
});
if (!tx) { console.error("Transaction not found"); process.exit(1); }

console.log(`Found: ${tx.propertyAddress} — currently ${tx.status}`);

if (tx.status === "on_hold") {
  console.log("Already on hold — nothing to do.");
  await p.$disconnect();
  process.exit(0);
}

const userId = tx.agentUserId
  ?? tx.assignedUserId
  ?? (await p.user.findFirst({
    where: { agencyId: tx.agencyId, role: "director" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  }))?.id;

if (!userId) { console.error("No user to attribute the hold to"); process.exit(1); }

const now = new Date();
await p.$transaction([
  p.propertyTransaction.update({
    where: { id: TX_ID },
    data: { status: "on_hold" },
  }),
  p.transactionHoldPeriod.create({
    data: {
      transactionId: TX_ID,
      startedAt: now,
      startedById: userId,
    },
  }),
]);

console.log(`✓ Tresco is now on hold (attributed to user ${userId} at ${now.toISOString()}).`);
console.log("");
console.log("Walk URL (staging):");
console.log(`  https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app/agent/transactions/${TX_ID}`);
console.log("");
console.log("To reactivate later:");
console.log("  npm run db:migrate:status:staging   # to verify connection");
console.log("  Or click 'Reactivate' on the toggle in the UI");

await p.$disconnect();
