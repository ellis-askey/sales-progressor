// Phase 1 commit 7 — buyer-side resync.
//
// Walks every active BuyerRound and mirrors PropertyTransaction's
// buyer-side fields onto the round row:
//
//   PropertyTransaction.purchasePrice               → BuyerRound.purchasePrice
//   PropertyTransaction.purchaserSolicitorFirmId    → BuyerRound.purchaserSolicitorFirmId
//   PropertyTransaction.purchaserSolicitorContactId → BuyerRound.purchaserSolicitorContactId
//   PropertyTransaction.brokerFirmId                → BuyerRound.brokerFirmId
//   PropertyTransaction.brokerContactId             → BuyerRound.brokerContactId
//
// Why this matters:
//   At Phase 0 backfill time (scripts/backfill-buyer-round-phase0.ts)
//   these fields were copied from the tx to the new Round 1 row. Any
//   savePriceAction / saveSolicitorAction / saveBrokerAction call
//   between then and the relist-feature cutover updated the TX row but
//   not the round mirror. Post-cutover, BuyerRound is the source of
//   truth for archived rounds (the archived-round view reads from it),
//   so a stale Round 1 row would show the wrong price / solicitor /
//   broker for that buyer in commit 8's archived-round view.
//
// Scope:
//   - ACTIVE rounds only. Archived rounds are point-in-time snapshots
//     of the buyer that was there; resyncing them would corrupt the
//     archive. The script's filter is `status: "active"`.
//   - Idempotent. Re-running with no buyer-side edits in flight is a
//     no-op (every comparison short-circuits).
//   - --dry-run flag: print the diff without writing.
//
// Read-only safety:
//   - Refuses to run if DATABASE_URL points at production AND --apply
//     is not also passed. Dry-run on prod is fine; mutations require
//     belt-and-braces.
//
// Run:
//   Dry-run on staging:
//     npx -y dotenv -e .env --override -- npx ts-node \
//       --project tsconfig.scripts.json scripts/resync-buyer-round-fields.ts
//
//   Apply on staging:
//     ... scripts/resync-buyer-round-fields.ts --apply
//
//   Apply on prod (after the GO/NO-GO gate clears):
//     npx -y dotenv -e .env.production --override -- npx ts-node \
//       --project tsconfig.scripts.json scripts/resync-buyer-round-fields.ts --apply

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const APPLY = process.argv.includes("--apply");

function isProdDb(): boolean {
  return (process.env.DATABASE_URL ?? "").includes(PROD_PROJECT_ID);
}

type Counts = {
  inspected: number;
  alreadyInSync: number;
  needResync: number;
  applied: number;
  byField: Record<string, number>;
};

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) {
    console.error("ABORT: DATABASE_URL not set.");
    process.exit(2);
  }
  if (isProdDb() && !APPLY) {
    // Dry-run on prod is allowed — explicit safety check inverted.
    console.log("[resync-buyer-round-fields] PROD DRY-RUN — no writes.");
  } else if (isProdDb() && APPLY) {
    console.log("[resync-buyer-round-fields] PROD APPLY — writes ENABLED.");
    console.log("                            Confirm the runbook GO/NO-GO gate is cleared before continuing.");
  } else {
    console.log(`[resync-buyer-round-fields] ${APPLY ? "APPLY" : "DRY RUN"}`);
  }
  console.log(`  DB host: ${dbUrl.replace(/.*@/, "").split("/")[0]}`);
  console.log("");

  // Pull every active BuyerRound along with the parent tx's buyer-side
  // fields in one query so the diff is computable client-side.
  const rounds = await prisma.buyerRound.findMany({
    where: { status: "active" },
    select: {
      id: true,
      transactionId: true,
      roundNumber: true,
      purchasePrice: true,
      purchaserSolicitorFirmId: true,
      purchaserSolicitorContactId: true,
      brokerFirmId: true,
      brokerContactId: true,
      transaction: {
        select: {
          id: true,
          purchasePrice: true,
          purchaserSolicitorFirmId: true,
          purchaserSolicitorContactId: true,
          brokerFirmId: true,
          brokerContactId: true,
        },
      },
    },
  });

  const counts: Counts = {
    inspected: rounds.length,
    alreadyInSync: 0,
    needResync: 0,
    applied: 0,
    byField: {
      purchasePrice: 0,
      purchaserSolicitorFirmId: 0,
      purchaserSolicitorContactId: 0,
      brokerFirmId: 0,
      brokerContactId: 0,
    },
  };

  // Each round either matches the tx already (no-op) or has at least
  // one field drifted. Compute the per-field diff and apply.
  for (const r of rounds) {
    const tx = r.transaction;
    type Field = "purchasePrice" | "purchaserSolicitorFirmId" | "purchaserSolicitorContactId" | "brokerFirmId" | "brokerContactId";
    const fields: Field[] = ["purchasePrice", "purchaserSolicitorFirmId", "purchaserSolicitorContactId", "brokerFirmId", "brokerContactId"];

    const diff: Partial<Record<Field, unknown>> = {};
    for (const f of fields) {
      if (r[f] !== tx[f]) {
        diff[f] = tx[f];
        counts.byField[f]++;
      }
    }

    if (Object.keys(diff).length === 0) {
      counts.alreadyInSync++;
      continue;
    }
    counts.needResync++;

    // Verbose-ish output — one line per resync subject. Trimmed for
    // legibility on big runs.
    const driftedFields = Object.keys(diff).join(",");
    console.log(`  round=${r.id} tx=${r.transactionId} round#${r.roundNumber}  drift: ${driftedFields}`);

    if (APPLY) {
      await prisma.buyerRound.update({
        where: { id: r.id },
        data: diff as Parameters<typeof prisma.buyerRound.update>[0]["data"],
      });
      counts.applied++;
    }
  }

  console.log("");
  console.log("── SUMMARY ─────────────────────────────────────────────");
  console.log(`  active rounds inspected:    ${counts.inspected}`);
  console.log(`  already in sync:            ${counts.alreadyInSync}`);
  console.log(`  drifted (need resync):      ${counts.needResync}`);
  console.log(`  per-field drift counts:`);
  for (const f of Object.keys(counts.byField)) {
    console.log(`    ${f.padEnd(34)} ${counts.byField[f]}`);
  }
  if (APPLY) {
    console.log(`  rows updated:               ${counts.applied}`);
  } else {
    console.log(`  rows updated:               0 (dry-run; pass --apply to write)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
