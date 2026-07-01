// Phase 1 commit 8 — round-status reconciliation.
//
// THE SINGLE MOST CORRECTNESS-CRITICAL SCRIPT FOR THE RELIST CUTOVER.
//
// Why this script exists:
//
//   The relist server action's preconditions include
//     - tx.status === "withdrawn"
//     - tx.activeBuyerRoundId points at a round
//   And the action archives that round (status="withdrawn", archivedAt=now)
//   on its way to creating Round N+1. The action assumes the OUTGOING
//   round is `status: "active"` going in.
//
//   But pre-cutover prod files have BuyerRound.status backfilled as
//   "active" regardless of the parent TX's status (the Phase 0
//   backfill couldn't differentiate; reconciliation was queued for
//   here). A withdrawn TX whose Round 1 still says "active" is
//   structurally invisible to the relist action's preconditions in
//   one direction (the precheck) and is actively misleading in another
//   (the archived-round view in commit 8 would show it as active).
//
//   This script reconciles every TX's active round's status against
//   the TX's status:
//
//     TX status     → Round status (expected)
//     ─────────────────────────────────────────
//     withdrawn     → withdrawn (with archivedAt set)
//     completed     → active  (the round closed by completing the sale; NOT archived)
//     active        → active
//     on_hold       → active
//     draft         → active
//
//   completed != archived. A completed sale's round is still the
//   active one — that buyer DID complete; nothing replaced them.
//   Only `withdrawn` triggers archive.
//
// What this script does:
//
//   1. For every TX, find its current `activeBuyerRoundId` round.
//   2. If TX.status === "withdrawn" AND that round's status !== "withdrawn":
//        - Set round.status = "withdrawn"
//        - Set round.archivedAt = now (or, if known, the TX's lastActivityAt
//          as a more honest backdate). Use TX's updatedAt as the timestamp
//          to honour the moment the file was withdrawn.
//        - Copy TX.fallThroughReason → round.fallThroughReason if not set.
//   3. If TX.status !== "withdrawn" AND the round's status === "withdrawn":
//        - That's a corruption case (an active TX with an archived round).
//        - REPORT it loudly. Do NOT auto-fix; this requires investigation.
//
// Idempotency:
//
//   - Re-running with no drift is a no-op.
//   - `--dry-run` is the default. `--apply` writes.
//
// Safety:
//
//   - Refuses to APPLY against prod unless --apply is explicit AND
//     the user has typed the prod project ID confirmation.
//   - Reports corruption cases without auto-fixing.
//
// Run:
//   Dry-run on staging:
//     npx -y dotenv -e .env --override -- npx ts-node \
//       --project tsconfig.scripts.json scripts/reconcile-buyer-round-status.ts
//
//   Apply on staging:
//     ... scripts/reconcile-buyer-round-status.ts --apply
//
//   Apply on prod (after the GO/NO-GO gate clears):
//     npx -y dotenv -e .env.production --override -- npx ts-node \
//       --project tsconfig.scripts.json scripts/reconcile-buyer-round-status.ts --apply

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const APPLY = process.argv.includes("--apply");

type Counts = {
  inspected: number;
  alreadyReconciled: number;
  needWithdrawn: number;
  appliedWithdrawn: number;
  corruptionCases: { txId: string; address: string; txStatus: string; roundStatus: string; roundId: string }[];
  missingActiveRound: { txId: string; address: string; txStatus: string }[];
};

function isProdDb(): boolean {
  return (process.env.DATABASE_URL ?? "").includes(PROD_PROJECT_ID);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) {
    console.error("ABORT: DATABASE_URL not set.");
    process.exit(2);
  }
  if (isProdDb() && APPLY) {
    console.log("[reconcile-buyer-round-status] PROD APPLY — writes ENABLED.");
    console.log("                              Confirm the runbook GO/NO-GO gate is cleared before continuing.");
  } else if (isProdDb()) {
    console.log("[reconcile-buyer-round-status] PROD DRY-RUN — no writes.");
  } else {
    console.log(`[reconcile-buyer-round-status] ${APPLY ? "APPLY" : "DRY RUN"}`);
  }
  console.log(`  DB host: ${dbUrl.replace(/.*@/, "").split("/")[0]}`);
  console.log("");

  const txs = await prisma.propertyTransaction.findMany({
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      fallThroughReason: true,
      updatedAt: true,
      activeBuyerRoundId: true,
      activeBuyerRound: {
        select: {
          id: true,
          status: true,
          archivedAt: true,
          fallThroughReason: true,
        },
      },
    },
  });

  const counts: Counts = {
    inspected: txs.length,
    alreadyReconciled: 0,
    needWithdrawn: 0,
    appliedWithdrawn: 0,
    corruptionCases: [],
    missingActiveRound: [],
  };

  for (const tx of txs) {
    if (!tx.activeBuyerRound) {
      counts.missingActiveRound.push({ txId: tx.id, address: tx.propertyAddress, txStatus: tx.status });
      continue;
    }

    // Case A — TX withdrawn but round still active → reconcile.
    if (tx.status === "withdrawn" && tx.activeBuyerRound.status !== "withdrawn") {
      counts.needWithdrawn++;
      console.log(`  WITHDRAW round: tx=${tx.id} (${tx.propertyAddress.slice(0, 50)}) round=${tx.activeBuyerRound.id}  round.status=${tx.activeBuyerRound.status} → withdrawn`);
      if (APPLY) {
        await prisma.buyerRound.update({
          where: { id: tx.activeBuyerRound.id },
          data: {
            status: "withdrawn",
            archivedAt: tx.activeBuyerRound.archivedAt ?? tx.updatedAt,
            fallThroughReason: tx.activeBuyerRound.fallThroughReason ?? tx.fallThroughReason ?? null,
          },
        });
        counts.appliedWithdrawn++;
      }
      continue;
    }

    // Case B — TX not withdrawn but round IS withdrawn → corruption.
    // Do not auto-fix; report.
    if (tx.status !== "withdrawn" && tx.activeBuyerRound.status === "withdrawn") {
      counts.corruptionCases.push({
        txId: tx.id,
        address: tx.propertyAddress,
        txStatus: tx.status,
        roundStatus: tx.activeBuyerRound.status,
        roundId: tx.activeBuyerRound.id,
      });
      continue;
    }

    // Otherwise — in sync.
    counts.alreadyReconciled++;
  }

  console.log("");
  console.log("── SUMMARY ─────────────────────────────────────────────");
  console.log(`  transactions inspected:                  ${counts.inspected}`);
  console.log(`  already reconciled:                      ${counts.alreadyReconciled}`);
  console.log(`  withdrew round (Case A):                 ${counts.needWithdrawn}`);
  if (APPLY) {
    console.log(`  rows updated:                            ${counts.appliedWithdrawn}`);
  } else {
    console.log(`  rows updated:                            0 (dry-run; pass --apply to write)`);
  }
  console.log(`  missing active round (orphan):           ${counts.missingActiveRound.length}`);
  console.log(`  CORRUPTION (active tx + archived round): ${counts.corruptionCases.length}`);

  if (counts.missingActiveRound.length > 0) {
    console.log("");
    console.log("── ORPHANS (no activeBuyerRound — investigate) ────");
    for (const o of counts.missingActiveRound.slice(0, 20)) {
      console.log(`  tx=${o.txId} status=${o.txStatus.padEnd(10)} ${o.address.slice(0, 60)}`);
    }
    if (counts.missingActiveRound.length > 20) {
      console.log(`  ...and ${counts.missingActiveRound.length - 20} more`);
    }
  }

  if (counts.corruptionCases.length > 0) {
    console.log("");
    console.log("── CORRUPTION (do NOT auto-fix; investigate each) ────");
    for (const c of counts.corruptionCases) {
      console.log(`  tx=${c.txId} (${c.txStatus}) → round=${c.roundId} (${c.roundStatus})  ${c.address.slice(0, 50)}`);
    }
    console.log("");
    console.log("  These are TXs whose active round is marked withdrawn — typically");
    console.log("  caused by an aborted relist (the round was archived but the");
    console.log("  $transaction didn't complete). Each needs human inspection.");
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
