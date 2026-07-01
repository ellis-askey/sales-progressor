// Data sweep — cancel stale ClientChaseState rows. Three flavours:
//
//   (a) "Old buyer" — purchaser CCS where contact.buyerRoundId
//       != tx.activeBuyerRoundId. Caused by the chase cron's
//       purchaser query not filtering by buyerRoundId (Bug A,
//       2026-06-17, on cmpmjsnfd0052ltxowy2ss249).
//   (b) "Dead file" — any status='active' CCS on a tx whose
//       status='withdrawn' or 'completed'. Bug B's footprint:
//       the withdraw flow didn't cancel CCS rows. Excludes
//       on_hold by design — those resume on unpause
//       (see app/actions/automation.ts unpauseFile).
//   (c) "Milestone complete" — active CCS row whose target
//       milestone is already state='complete' or 'not_required'.
//       Bug C's footprint: completeMilestone() didn't cancel CCS
//       until 2026-07-01. The row survives, kept surfacing ghost
//       "chase X of 2" predictions in /agent/transactions/[id]'s
//       Upcoming strip even though the milestone was long done.
//       Fix landed at lib/services/milestones.ts:671 area.
//
// Behaviour: dry-run by default. Pass `--commit` to actually write.
// Idempotent via status='active' precondition.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const COMMIT = process.argv.includes("--commit");

async function main() {
  console.log(COMMIT ? "MODE: COMMIT" : "MODE: DRY-RUN (pass --commit to write)");

  // Single SQL for both flavours, returning the ids to cancel.
  const targets = await prisma.$queryRaw<Array<{
    id: string; transactionId: string; tx_status: string;
    contact_name: string; contact_role: string;
    contact_buyer_round: string | null;
    tx_active_round: string | null;
    milestone_code: string; chase_count: number;
    reason: string;
  }>>`
    SELECT
      ccs.id, ccs."transactionId", pt.status::text AS tx_status,
      c.name AS contact_name, c."roleType"::text AS contact_role,
      c."buyerRoundId" AS contact_buyer_round,
      pt."activeBuyerRoundId" AS tx_active_round,
      ccs."milestoneCode" AS milestone_code, ccs."chaseCount" AS chase_count,
      CASE
        WHEN pt.status::text IN ('withdrawn', 'completed') THEN 'dead_file'
        WHEN mc.state::text IN ('complete', 'not_required') THEN 'milestone_complete'
        ELSE 'old_buyer'
      END AS reason
    FROM "ClientChaseState" ccs
    JOIN "Contact" c ON c.id = ccs."contactId"
    JOIN "PropertyTransaction" pt ON pt.id = ccs."transactionId"
    -- Join to the milestone completion row for this tx + code.
    -- The join is via the milestone definition's code, then to the
    -- completion row for the same transaction. Rows without a matching
    -- MilestoneCompletion (very rare) are treated as "not complete".
    LEFT JOIN "MilestoneDefinition" md ON md.code = ccs."milestoneCode"
    LEFT JOIN "MilestoneCompletion" mc
      ON mc."transactionId" = ccs."transactionId"
     AND mc."milestoneDefinitionId" = md.id
    WHERE ccs.status = 'active'
      AND (
        pt.status::text IN ('withdrawn', 'completed')
        OR (
          c."roleType" = 'purchaser'
          AND c."buyerRoundId" IS NOT NULL
          AND c."buyerRoundId" IS DISTINCT FROM pt."activeBuyerRoundId"
        )
        OR mc.state::text IN ('complete', 'not_required')
      )
    ORDER BY ccs."transactionId", c.name, ccs."milestoneCode"
  `;

  console.log(`\nFound ${targets.length} stale active CCS rows to cancel.`);
  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }
  // Per-tx breakdown
  const byTx = new Map<string, typeof targets>();
  for (const t of targets) {
    const arr = byTx.get(t.transactionId) ?? [];
    arr.push(t);
    byTx.set(t.transactionId, arr);
  }
  for (const [txId, rows] of byTx) {
    console.log(`\n  TX ${txId}  (${rows[0].tx_status})  ${rows.length} rows:`);
    for (const r of rows) {
      console.log(`    ${r.milestone_code.padEnd(6)} cnt=${r.chase_count} contact=${r.contact_name} (${r.contact_role}) reason=${r.reason} id=${r.id}`);
    }
  }

  if (!COMMIT) {
    console.log("\nDRY-RUN — no writes performed. Re-run with --commit to apply.");
    return;
  }

  const ids = targets.map((t) => t.id);
  const result = await prisma.clientChaseState.updateMany({
    where: { id: { in: ids }, status: "active" },
    data: { status: "cancelled" },
  });
  console.log(`\nCANCELLED ${result.count} CCS rows.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
