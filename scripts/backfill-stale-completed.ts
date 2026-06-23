// One-shot: backfill the txs that have VM20 + PM27 confirmed but are
// still status='active' because the auto-flip didn't exist when they
// were confirmed. Mirrors the gate logic in confirmMilestoneAction's
// new auto-flip block (app/actions/milestones.ts) and the manual gate
// at updateTransactionStatus (app/actions/transactions.ts:478-505):
//   - Both VM20 + PM27 must be state='complete'
//   - PM27 must be on the active buyer round
//   - tx.status must be 'active' (NOT on_hold, NOT withdrawn)
//
// Behaviour: dry-run by default. Pass `--commit` to write.
// Writes per tx: status='completed', outboundMessage internal_note,
// transaction_status_changed event. Idempotent via status='active'
// precondition + onlyIf both-complete check.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const COMMIT = process.argv.includes("--commit");
// Backfill notes carry a synthetic createdById since there's no human
// confirming this one. Fall back to the assignedUser (the SP) so the
// activity-feed row attributes correctly. If that's null, use the
// agentUser. If both null, skip the note.
async function main() {
  console.log(COMMIT ? "MODE: COMMIT" : "MODE: DRY-RUN (pass --commit to write)");

  const targets = await p.$queryRaw<Array<{
    id: string; address: string; status: string; agency_id: string;
    assigned_user_id: string | null; agent_user_id: string | null;
    active_round_id: string | null;
  }>>`
    SELECT
      pt.id, pt."propertyAddress" AS address, pt.status::text AS status,
      pt."agencyId" AS agency_id,
      pt."assignedUserId" AS assigned_user_id,
      pt."agentUserId" AS agent_user_id,
      pt."activeBuyerRoundId" AS active_round_id
    FROM "PropertyTransaction" pt
    WHERE pt.status::text = 'active'
      AND EXISTS (
        SELECT 1 FROM "MilestoneCompletion" mc
        JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
        WHERE mc."transactionId" = pt.id
          AND md.code = 'VM20'
          AND mc.state = 'complete'
      )
      AND EXISTS (
        SELECT 1 FROM "MilestoneCompletion" mc
        JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
        WHERE mc."transactionId" = pt.id
          AND md.code = 'PM27'
          AND mc.state = 'complete'
          AND (mc."buyerRoundId" IS NULL OR mc."buyerRoundId" = pt."activeBuyerRoundId")
      )
    ORDER BY pt."propertyAddress"
  `;

  console.log(`\nFound ${targets.length} txs to flip.`);
  if (targets.length === 0) { console.log("Nothing to do."); return; }
  for (const t of targets) console.log(`  ${t.id}  ${t.address}`);
  if (!COMMIT) { console.log("\nDRY-RUN. Re-run with --commit to apply."); return; }

  let flipped = 0;
  for (const t of targets) {
    const actorId = t.assigned_user_id ?? t.agent_user_id;
    await p.$transaction(async (tx) => {
      const upd = await tx.propertyTransaction.updateMany({
        where: { id: t.id, status: "active" },
        data: { status: "completed" },
      });
      if (upd.count === 0) return;
      if (actorId) {
        await tx.outboundMessage.create({
          data: {
            transactionId: t.id,
            type: "internal_note",
            contactIds: [],
            content: "Marked as completed. Both parties have confirmed.",
            createdById: actorId,
          },
        });
      }
      flipped++;
    });
  }
  console.log(`\nFLIPPED ${flipped} txs.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
