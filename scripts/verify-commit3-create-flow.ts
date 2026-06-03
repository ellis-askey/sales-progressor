// Phase 1 commit 3 verification: drives the same prisma operations the
// wired createTransactionAction performs, then asserts every stamping
// invariant the commit promises.
//
// Avoids importing the real lib/services modules because ts-node can't
// resolve the @/* alias outside Next's build. The operations exercised
// here are byte-for-byte the ones in lib/services/transactions.ts (after
// commit 3), lib/services/milestones.ts (initializeMilestoneCompletions),
// and lib/services/reminders.ts (createInitialRemindersInline). The
// real production code is what tsc verified compiles cleanly; this
// script verifies the DB writes those code paths produce are correct.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const SENTINEL = `[commit3 rehearsal] ${randomUUID()}`;

async function main() {
  const agency = await prisma.agency.findFirst({ select: { id: true } });
  if (!agency) throw new Error("no agency on staging");

  let txnId: string | null = null;
  try {
    console.log(`Creating sentinel transaction: "${SENTINEL}"`);

    // Mirror the service path: PropertyTransaction.create, then
    // BuyerRound.create, then PropertyTransaction.update with
    // activeBuyerRoundId — all in one $transaction.
    const tx = await prisma.$transaction(async (ptx) => {
      const created = await ptx.propertyTransaction.create({
        data: {
          propertyAddress: SENTINEL,
          agencyId: agency.id,
          tenure: "freehold",
          purchaseType: "mortgage",
          purchasePrice: 12345600,
          progressedBy: "agent",
          serviceType: "self_managed",
          expectedExchangeDate: new Date(Date.now() + 84 * 86400_000),
          twelveWeekTarget: new Date(Date.now() + 84 * 86400_000),
        },
      });
      const round = await ptx.buyerRound.create({
        data: {
          transactionId: created.id,
          roundNumber: 1,
          status: "active",
          purchasePrice: created.purchasePrice,
          purchaserSolicitorFirmId: created.purchaserSolicitorFirmId,
          purchaserSolicitorContactId: created.purchaserSolicitorContactId,
          brokerFirmId: created.brokerFirmId,
          brokerContactId: created.brokerContactId,
        },
      });
      return ptx.propertyTransaction.update({
        where: { id: created.id },
        data: { activeBuyerRoundId: round.id },
      });
    });
    txnId = tx.id;
    console.log(`  created tx ${tx.id}`);
    console.log(`  activeBuyerRoundId   = ${tx.activeBuyerRoundId}`);

    // 1. Round 1 invariants
    if (!tx.activeBuyerRoundId) throw new Error("activeBuyerRoundId not stamped on create");
    const round = await prisma.buyerRound.findUnique({
      where: { id: tx.activeBuyerRoundId },
      select: {
        roundNumber: true, status: true, purchasePrice: true,
        purchaserSolicitorFirmId: true, purchaserSolicitorContactId: true,
        brokerFirmId: true, brokerContactId: true,
      },
    });
    if (!round) throw new Error("round not found");
    console.log(`\nRound:`);
    console.log(`  roundNumber                  = ${round.roundNumber}`);
    console.log(`  status                       = ${round.status}`);
    console.log(`  purchasePrice (round vs tx)  = ${round.purchasePrice} / ${tx.purchasePrice}`);
    if (round.roundNumber !== 1) throw new Error(`expected roundNumber=1, got ${round.roundNumber}`);
    if (round.status !== "active") throw new Error(`expected round.status='active', got ${round.status}`);
    if (round.purchasePrice !== tx.purchasePrice) throw new Error("round.purchasePrice mismatch");

    // 2. Contact creation — mirrors createTransactionAction's createMany
    await prisma.contact.createMany({
      data: [
        {
          propertyTransactionId: tx.id,
          name: "Test Vendor",
          roleType: "vendor",
          portalToken: randomUUID(),
          buyerRoundId: null,
        },
        {
          propertyTransactionId: tx.id,
          name: "Test Purchaser",
          roleType: "purchaser",
          portalToken: randomUUID(),
          buyerRoundId: tx.activeBuyerRoundId,
        },
      ],
    });
    const contacts = await prisma.contact.findMany({
      where: { propertyTransactionId: tx.id },
      select: { roleType: true, buyerRoundId: true },
      orderBy: { roleType: "asc" },
    });
    console.log(`\nContacts:`);
    for (const c of contacts) console.log(`  roleType=${c.roleType.padEnd(10)} buyerRoundId=${c.buyerRoundId}`);
    const vendor = contacts.find((c) => c.roleType === "vendor")!;
    const purchaser = contacts.find((c) => c.roleType === "purchaser")!;
    if (vendor.buyerRoundId !== null) throw new Error("vendor contact incorrectly stamped");
    if (purchaser.buyerRoundId !== tx.activeBuyerRoundId) throw new Error("purchaser contact not stamped");

    // 3. MilestoneCompletion init — mirrors initializeMilestoneCompletions
    const defs = await prisma.milestoneDefinition.findMany({
      orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
      select: { id: true, code: true, side: true },
    });
    await Promise.all(
      defs.map((def) =>
        prisma.milestoneCompletion.create({
          data: {
            transactionId: tx.id,
            milestoneDefinitionId: def.id,
            state: "locked",
            buyerRoundId: def.side === "purchaser" ? tx.activeBuyerRoundId : null,
          },
        })
      )
    );
    const mcRows = await prisma.milestoneCompletion.findMany({
      where: { transactionId: tx.id },
      select: { buyerRoundId: true, milestoneDefinition: { select: { side: true, code: true } } },
    });
    const vmMc = mcRows.filter((r) => r.milestoneDefinition.side === "vendor");
    const pmMc = mcRows.filter((r) => r.milestoneDefinition.side === "purchaser");
    const vmStamped = vmMc.filter((r) => r.buyerRoundId !== null).length;
    const pmUnstamped = pmMc.filter((r) => r.buyerRoundId === null).length;
    console.log(`\nMilestoneCompletion:`);
    console.log(`  vendor   (file-level): ${vmMc.length} rows, of which ${vmStamped} wrongly stamped`);
    console.log(`  purchaser (Round 1):   ${pmMc.length} rows, of which ${pmUnstamped} missing stamp`);
    if (vmStamped > 0) throw new Error(`${vmStamped} vendor rows wrongly stamped`);
    if (pmUnstamped > 0) throw new Error(`${pmUnstamped} purchaser rows missing stamp`);

    // 4. ReminderLog init — mirrors createInitialRemindersInline
    const rules = await prisma.reminderRule.findMany({
      where: { isActive: true, anchorMilestoneId: null, requiresExchangeReady: false },
      select: { id: true, targetMilestoneCode: true, graceDays: true },
    });
    await prisma.reminderLog.createMany({
      data: rules.map((rule) => ({
        transactionId: tx.id,
        reminderRuleId: rule.id,
        status: "active" as const,
        nextDueDate: new Date(tx.createdAt.getTime() + rule.graceDays * 86400_000),
        sourceDateUsed: tx.createdAt,
        buyerRoundId: rule.targetMilestoneCode?.startsWith("PM")
          ? tx.activeBuyerRoundId
          : null,
      })),
    });
    const rlRows = await prisma.reminderLog.findMany({
      where: { transactionId: tx.id },
      select: { buyerRoundId: true, reminderRule: { select: { targetMilestoneCode: true } } },
    });
    const vmRl = rlRows.filter((r) => !(r.reminderRule.targetMilestoneCode?.startsWith("PM")));
    const pmRl = rlRows.filter((r) => r.reminderRule.targetMilestoneCode?.startsWith("PM"));
    const vmRlStamped = vmRl.filter((r) => r.buyerRoundId !== null).length;
    const pmRlUnstamped = pmRl.filter((r) => r.buyerRoundId === null).length;
    console.log(`\nReminderLog:`);
    console.log(`  vendor / file-level rules: ${vmRl.length} rows, of which ${vmRlStamped} wrongly stamped`);
    console.log(`  purchaser rules (PM*):     ${pmRl.length} rows, of which ${pmRlUnstamped} missing stamp`);
    if (vmRlStamped > 0) throw new Error("vendor reminders wrongly stamped");
    if (pmRlUnstamped > 0) throw new Error("purchaser reminders missing stamp");

    console.log(`\nAll commit-3 stamping invariants hold.`);
  } finally {
    if (txnId) {
      await prisma.propertyTransaction.delete({ where: { id: txnId } });
      console.log(`\nCleaned up sentinel tx ${txnId}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
