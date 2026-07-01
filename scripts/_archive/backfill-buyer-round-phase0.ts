// Phase 0 of the relist feature — shadow backfill.
//
// For every existing PropertyTransaction:
//   1. Create exactly one Round 1 (status=active) if it doesn't already exist.
//   2. Stamp PropertyTransaction.activeBuyerRoundId to that round.
//   3. Copy buyer-side snapshot fields onto the round.
//   4. Stamp buyerRoundId on attributable child rows (see rules below).
//
// All steps idempotent. Safe to re-run — every UPDATE filters on
// buyerRoundId IS NULL, every round-creation step uses a unique
// (transactionId, roundNumber) constraint and skips on conflict.
//
// Per-table attribution rules (approved 2026-06-03):
//   Contact:             roleType = 'purchaser'
//   MilestoneCompletion: milestoneDefinition.side = 'purchaser'
//   PortalMessage:       contact.roleType = 'purchaser'
//   PriceHistory:        all rows (price is always the buyer's offer)
//   ReminderLog:         reminderRule.targetMilestoneCode LIKE 'PM%'
//   ChaseTask:           inherit from parent ReminderLog
//   ClientChaseState:    contact.roleType = 'purchaser'
//   OutboundMessage:     stamp iff EVERY contactId resolves to a
//                        purchaser-role Contact AND cardinality > 0
//   TransactionDocument: stamp iff contactId resolves to a purchaser
//                        Contact (null-contactId rows stay file-level)
//
// Run (dry):     npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' scripts/backfill-buyer-round-phase0.ts
// Run (apply):  ... scripts/backfill-buyer-round-phase0.ts --apply
//
// Point at staging via DATABASE_URL/DIRECT_URL. The script does not
// touch prod unless you point it at prod env vars, which Rule 3 says
// you don't.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Counts = Record<string, number>;

async function main() {
  console.log(`[backfill-buyer-round-phase0] ${APPLY ? "APPLY" : "DRY RUN"}`);

  const txns = await prisma.propertyTransaction.findMany({
    select: {
      id: true,
      activeBuyerRoundId: true,
      purchasePrice: true,
      purchaserSolicitorFirmId: true,
      purchaserSolicitorContactId: true,
      brokerFirmId: true,
      brokerContactId: true,
    },
  });
  console.log(`  transactions:           ${txns.length}`);

  // ── Step 1+2+3: create Round 1 and stamp activeBuyerRoundId ────────────

  let createdRounds = 0;
  let stampedActive = 0;
  let alreadyHadRound = 0;

  for (const t of txns) {
    const existing = await prisma.buyerRound.findUnique({
      where: { transactionId_roundNumber: { transactionId: t.id, roundNumber: 1 } },
      select: { id: true },
    });

    let roundId: string;
    if (existing) {
      alreadyHadRound++;
      roundId = existing.id;
    } else {
      if (APPLY) {
        const created = await prisma.buyerRound.create({
          data: {
            transactionId: t.id,
            roundNumber: 1,
            status: "active",
            purchasePrice: t.purchasePrice,
            purchaserSolicitorFirmId: t.purchaserSolicitorFirmId,
            purchaserSolicitorContactId: t.purchaserSolicitorContactId,
            brokerFirmId: t.brokerFirmId,
            brokerContactId: t.brokerContactId,
          },
          select: { id: true },
        });
        roundId = created.id;
      } else {
        roundId = "(dry-run-no-id)";
      }
      createdRounds++;
    }

    if (!t.activeBuyerRoundId) {
      if (APPLY && roundId !== "(dry-run-no-id)") {
        await prisma.propertyTransaction.update({
          where: { id: t.id },
          data: { activeBuyerRoundId: roundId },
        });
      }
      stampedActive++;
    }
  }
  console.log(`  Round 1 created:        ${createdRounds}`);
  console.log(`  Round 1 already there:  ${alreadyHadRound}`);
  console.log(`  activeBuyerRoundId set: ${stampedActive}`);

  // ── Step 4: per-table attribution sweeps (raw SQL for set-based UPDATEs) ─
  // Each sweep is keyed on buyerRoundId IS NULL so re-running is a no-op.

  const sweepResults: Counts = {};

  // Contact: purchaser-role rows.
  sweepResults.Contact = await runSweep(
    "Contact",
    Prisma.sql`
      UPDATE "Contact" c
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r
      WHERE r."transactionId" = c."propertyTransactionId"
        AND r."roundNumber" = 1
        AND c."buyerRoundId" IS NULL
        AND c."roleType" = 'purchaser'
    `,
  );

  // MilestoneCompletion: PM-side milestones (purchaser).
  sweepResults.MilestoneCompletion = await runSweep(
    "MilestoneCompletion",
    Prisma.sql`
      UPDATE "MilestoneCompletion" mc
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r, "MilestoneDefinition" d
      WHERE r."transactionId" = mc."transactionId"
        AND r."roundNumber" = 1
        AND d.id = mc."milestoneDefinitionId"
        AND d.side = 'purchaser'
        AND mc."buyerRoundId" IS NULL
    `,
  );

  // PortalMessage: contact is a purchaser.
  sweepResults.PortalMessage = await runSweep(
    "PortalMessage",
    Prisma.sql`
      UPDATE "PortalMessage" pm
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r, "Contact" c
      WHERE r."transactionId" = pm."transactionId"
        AND r."roundNumber" = 1
        AND c.id = pm."contactId"
        AND c."roleType" = 'purchaser'
        AND pm."buyerRoundId" IS NULL
    `,
  );

  // PriceHistory: every row (the price is always the buyer's offer).
  sweepResults.PriceHistory = await runSweep(
    "PriceHistory",
    Prisma.sql`
      UPDATE "PriceHistory" ph
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r
      WHERE r."transactionId" = ph."transactionId"
        AND r."roundNumber" = 1
        AND ph."buyerRoundId" IS NULL
    `,
  );

  // ReminderLog: targetMilestoneCode starts with 'PM'.
  sweepResults.ReminderLog = await runSweep(
    "ReminderLog",
    Prisma.sql`
      UPDATE "ReminderLog" rl
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r, "ReminderRule" rr
      WHERE r."transactionId" = rl."transactionId"
        AND r."roundNumber" = 1
        AND rr.id = rl."reminderRuleId"
        AND rr."targetMilestoneCode" LIKE 'PM%'
        AND rl."buyerRoundId" IS NULL
    `,
  );

  // ChaseTask: inherit from parent ReminderLog (run AFTER ReminderLog sweep).
  sweepResults.ChaseTask = await runSweep(
    "ChaseTask",
    Prisma.sql`
      UPDATE "ChaseTask" ct
      SET "buyerRoundId" = rl."buyerRoundId"
      FROM "ReminderLog" rl
      WHERE rl.id = ct."reminderLogId"
        AND rl."buyerRoundId" IS NOT NULL
        AND ct."buyerRoundId" IS NULL
    `,
  );

  // ClientChaseState: contact is a purchaser.
  sweepResults.ClientChaseState = await runSweep(
    "ClientChaseState",
    Prisma.sql`
      UPDATE "ClientChaseState" ccs
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r, "Contact" c
      WHERE r."transactionId" = ccs."transactionId"
        AND r."roundNumber" = 1
        AND c.id = ccs."contactId"
        AND c."roleType" = 'purchaser'
        AND ccs."buyerRoundId" IS NULL
    `,
  );

  // OutboundMessage: stamp iff every contactId is a purchaser-role contact
  // AND there is at least one contactId. Mixed / vendor / solicitor / empty
  // rows stay file-level.
  sweepResults.OutboundMessage = await runSweep(
    "OutboundMessage",
    Prisma.sql`
      UPDATE "OutboundMessage" om
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r
      WHERE r."transactionId" = om."transactionId"
        AND r."roundNumber" = 1
        AND om."buyerRoundId" IS NULL
        AND cardinality(om."contactIds") > 0
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(om."contactIds") AS cid
          WHERE NOT EXISTS (
            SELECT 1 FROM "Contact" cx
            WHERE cx.id = cid AND cx."roleType" = 'purchaser'
          )
        )
    `,
  );

  // TransactionDocument: contactId resolves to a purchaser Contact.
  // Null-contactId rows stay file-level.
  sweepResults.TransactionDocument = await runSweep(
    "TransactionDocument",
    Prisma.sql`
      UPDATE "TransactionDocument" td
      SET "buyerRoundId" = r.id
      FROM "BuyerRound" r, "Contact" c
      WHERE r."transactionId" = td."transactionId"
        AND r."roundNumber" = 1
        AND td."contactId" IS NOT NULL
        AND c.id = td."contactId"
        AND c."roleType" = 'purchaser'
        AND td."buyerRoundId" IS NULL
    `,
  );

  console.log(`\n  per-table attributions:`);
  for (const [table, n] of Object.entries(sweepResults)) {
    console.log(`    ${table.padEnd(22)} ${n}`);
  }

  console.log(`\n[backfill-buyer-round-phase0] ${APPLY ? "applied" : "dry run only"}`);
}

async function runSweep(label: string, sql: Prisma.Sql): Promise<number> {
  if (!APPLY) {
    // Dry-run: rewrite UPDATE ... SET x = y FROM ... WHERE ... into a
    // SELECT COUNT(*) using the same FROM/WHERE so we report what WOULD
    // be touched without writing.
    // For Phase 0 simplicity we just return -1; the user can re-run
    // post-apply with --apply to get real counts. Verification queries
    // afterwards confirm row counts independently.
    return -1;
  }
  const n = await prisma.$executeRaw(sql);
  return Number(n);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
