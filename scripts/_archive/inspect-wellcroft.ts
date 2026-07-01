// One-shot: dump status of 14-16 Wellcroft, Ivinghoe so we can see why
// it's still status=active after the completion milestone was confirmed.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const tx = await p.propertyTransaction.findFirst({
    where: { propertyAddress: { contains: "14-16 Wellcroft" } },
    select: {
      id: true, propertyAddress: true, status: true, completionDate: true, exchangedAt: true,
      serviceType: true, agencyId: true, activeBuyerRoundId: true, createdAt: true,
    },
  });
  console.log("TX:", tx);
  if (!tx) return;

  const defs = await p.milestoneDefinition.findMany({
    where: { code: { in: ["VM19","VM20","PM26","PM27"] } },
    select: { id: true, code: true, side: true, name: true },
  });
  const completions = await p.milestoneCompletion.findMany({
    where: { transactionId: tx.id, milestoneDefinitionId: { in: defs.map(d=>d.id) } },
    select: {
      milestoneDefinitionId: true, state: true, completedAt: true, completedById: true,
      eventDate: true, buyerRoundId: true, reconciledAtClaim: true, reconciledAtExchange: true,
    },
  });
  const codeOf = new Map(defs.map(d => [d.id, d.code]));
  console.log("\n--- Exchange/Completion milestones ---");
  for (const c of completions) {
    console.log(`  ${codeOf.get(c.milestoneDefinitionId)} state=${c.state} completedAt=${c.completedAt?.toISOString() ?? "—"} eventDate=${c.eventDate?.toISOString() ?? "—"} round=${c.buyerRoundId ?? "—"} reconciledClaim=${c.reconciledAtClaim} reconciledExch=${c.reconciledAtExchange}`);
  }

  // All completions count
  const allComps = await p.milestoneCompletion.count({ where: { transactionId: tx.id, state: "complete" } });
  const allDefs = await p.milestoneDefinition.count();
  console.log(`\nTotal complete: ${allComps} / ${allDefs} milestone defs`);

  // Status change history via event log
  const events = await p.commandEventLog.findMany({
    where: { entityType: "PropertyTransaction", entityId: tx.id, type: "transaction_status_changed" },
    select: { occurredAt: true, type: true, metadata: true, userId: true },
    orderBy: { occurredAt: "asc" },
  }).catch((e) => { console.log("(event log not queryable:", (e as Error).message, ")"); return []; });
  console.log("\n--- Status change events ---");
  for (const e of events) console.log(` ${e.occurredAt.toISOString()} ${JSON.stringify(e.metadata)}`);
})().catch(console.error).finally(()=>p.$disconnect());
