// Read-only prevalence query: how many ClientChaseState rows are
// orphaned in prod?
//
// Two flavours of orphaned:
//   (a) "Old buyer" — CCS row for a purchaser contact whose
//        contact.buyerRoundId != tx.activeBuyerRoundId. Caused by the
//        chase cron's purchaser query not filtering by buyerRoundId
//        (Bug A from the 2026-06-17 investigation).
//   (b) "Withdrawn file" — CCS row with status='active' on a tx whose
//        status != 'active'. Caused by the withdraw flow not cancelling
//        CCS rows (Bug B).
//
// Categories (a) and (b) overlap heavily. The script reports both plus
// the union, grouped by transaction so the per-file sweep can be sized.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // (a) Old buyer rows
  const oldBuyerRows = await prisma.$queryRaw<Array<{
    id: string; transactionId: string; tx_status: string;
    contact_name: string; contact_buyer_round: string | null;
    tx_active_round: string | null; milestone_code: string;
    chase_count: number; last_chased_at: Date | null;
  }>>`
    SELECT
      ccs.id, ccs."transactionId", pt.status::text AS tx_status,
      c.name AS contact_name, c."buyerRoundId" AS contact_buyer_round,
      pt."activeBuyerRoundId" AS tx_active_round,
      ccs."milestoneCode" AS milestone_code, ccs."chaseCount" AS chase_count,
      ccs."lastChasedAt" AS last_chased_at
    FROM "ClientChaseState" ccs
    JOIN "Contact" c ON c.id = ccs."contactId"
    JOIN "PropertyTransaction" pt ON pt.id = ccs."transactionId"
    WHERE ccs.status = 'active'
      AND c."roleType" = 'purchaser'
      AND c."buyerRoundId" IS NOT NULL
      AND c."buyerRoundId" IS DISTINCT FROM pt."activeBuyerRoundId"
    ORDER BY ccs."transactionId", c.name, ccs."milestoneCode"
  `;

  console.log(`(a) OLD-BUYER CCS rows (purchaser on archived round): ${oldBuyerRows.length}`);
  const aTxIds = new Set(oldBuyerRows.map((r) => r.transactionId));
  console.log(`    Across ${aTxIds.size} transactions`);

  // (b) Withdrawn-file rows
  const withdrawnRows = await prisma.$queryRaw<Array<{
    id: string; transactionId: string; tx_status: string;
    contact_name: string; contact_role: string;
    milestone_code: string; chase_count: number;
  }>>`
    SELECT
      ccs.id, ccs."transactionId", pt.status::text AS tx_status,
      c.name AS contact_name, c."roleType"::text AS contact_role,
      ccs."milestoneCode" AS milestone_code, ccs."chaseCount" AS chase_count
    FROM "ClientChaseState" ccs
    JOIN "Contact" c ON c.id = ccs."contactId"
    JOIN "PropertyTransaction" pt ON pt.id = ccs."transactionId"
    WHERE ccs.status = 'active'
      AND pt.status::text != 'active'
    ORDER BY pt.status::text, ccs."transactionId", c.name, ccs."milestoneCode"
  `;
  console.log(`\n(b) CCS rows status=active on non-active tx: ${withdrawnRows.length}`);
  const bTxIds = new Set(withdrawnRows.map((r) => r.transactionId));
  console.log(`    Across ${bTxIds.size} transactions`);
  // By tx status
  const byStatus = new Map<string, number>();
  for (const r of withdrawnRows) byStatus.set(r.tx_status, (byStatus.get(r.tx_status) ?? 0) + 1);
  console.log(`    Breakdown: ${Array.from(byStatus.entries()).map(([s, n]) => `${s}=${n}`).join(", ")}`);

  // Union — what the sweep will actually touch
  const unionIds = new Set([...oldBuyerRows.map((r) => r.id), ...withdrawnRows.map((r) => r.id)]);
  console.log(`\nUNION of (a) ∪ (b): ${unionIds.size} CCS rows total to clean`);
  const unionTxs = new Set([
    ...oldBuyerRows.map((r) => r.transactionId),
    ...withdrawnRows.map((r) => r.transactionId),
  ]);
  console.log(`    Across ${unionTxs.size} transactions`);

  // Per-tx summary (top 10)
  const perTx = new Map<string, { tx_status: string; rows: number; oldBuyer: number; withdrawn: number }>();
  for (const r of oldBuyerRows) {
    const e = perTx.get(r.transactionId) ?? { tx_status: r.tx_status, rows: 0, oldBuyer: 0, withdrawn: 0 };
    e.oldBuyer++; e.rows++; perTx.set(r.transactionId, e);
  }
  for (const r of withdrawnRows) {
    const e = perTx.get(r.transactionId) ?? { tx_status: r.tx_status, rows: 0, oldBuyer: 0, withdrawn: 0 };
    e.withdrawn++;
    // Avoid double-counting in `rows`
    if (!oldBuyerRows.some((o) => o.id === r.id)) e.rows++;
    perTx.set(r.transactionId, e);
  }
  const sorted = [...perTx.entries()].sort((a, b) => b[1].rows - a[1].rows).slice(0, 10);
  console.log(`\nTop affected tx (up to 10):`);
  for (const [txId, e] of sorted) {
    console.log(`  ${txId}  ${e.tx_status.padEnd(10)} total=${e.rows} (oldBuyer=${e.oldBuyer}, withdrawn=${e.withdrawn})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
