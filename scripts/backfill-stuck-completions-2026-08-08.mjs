// scripts/backfill-stuck-completions-2026-08-08.mjs
// One-shot backfill for 4 files stuck in Active after the user confirmed both
// completion milestones via the reconciliation modal on 2026-08-08. Root cause
// (missing maybeAutoCompleteTransaction in confirmExchangeReconciliationAction)
// fixed in same PR — but the 4 files are already past the confirm; they need
// the flip run against them once. Mirrors exactly what maybeAutoCompleteTransaction
// would write: status update + internal-note OutboundMessage + Event log line.
//
// Delete this script after the run (SCRIPTS_REGISTRY: one-shot, delete 2026-08-15).
//
// Run:  npx dotenv -e .env.production -- node scripts/backfill-stuck-completions-2026-08-08.mjs

import pg from "pg";
// Prisma's cuid() default is a fine target format but we don't need the
// exact algorithm — just a URL-safe unique string. Postgres treats id as
// text; the app never parses it. nanoid is already a dep.
import { nanoid } from "nanoid";
const createId = () => `bf_${nanoid(20)}`;

const ELLIS_USER_ID = "cmokcvjr10000g9efynttc10z"; // admin user (audit trail)
const IDS = [
  "cmpmlervx0002t426bz7esttn", // 18 Commissioner Road, Strood
  "cmpml22jn0002gyw5epfj21sd", // 17 Bushy Avenue, Broxbourne
  "cmp2x52cz0005bkt3aasbzu4d", // 29 Sears Drive, Tring
  "cmpmjb05l0002ltxohb00qa9g", // 54 Launcelot Road, London
];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

let flipped = 0;
let skipped = 0;

for (const id of IDS) {
  console.log(`\n── ${id}`);

  // Re-run the same guard maybeAutoCompleteTransaction runs. If the file has
  // drifted (already completed, on hold, missing a side) we skip — safe rerun.
  const tx = (await c.query(`
    SELECT id, "propertyAddress", status::text AS status,
           "activeBuyerRoundId", "agencyId"
      FROM "PropertyTransaction" WHERE id = $1
  `, [id])).rows[0];

  if (!tx) { console.log(`   skip: not found`); skipped++; continue; }
  if (tx.status !== "active") {
    console.log(`   skip: status=${tx.status} (already flipped or on hold)`);
    skipped++;
    continue;
  }

  const complete = await c.query(`
    SELECT md.code
      FROM "MilestoneCompletion" mc
      JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
     WHERE mc."transactionId" = $1
       AND md.code IN ('VM20','PM27')
       AND mc.state = 'complete'
       AND (mc."buyerRoundId" IS NULL OR mc."buyerRoundId" = $2)
  `, [id, tx.activeBuyerRoundId]);

  const codes = new Set(complete.rows.map((r) => r.code));
  if (!codes.has("VM20") || !codes.has("PM27")) {
    console.log(`   skip: bothComplete=false (VM20=${codes.has("VM20")} PM27=${codes.has("PM27")})`);
    skipped++;
    continue;
  }

  // Three writes in one transaction — status flip + activity note + audit event.
  await c.query("BEGIN");
  try {
    await c.query(`UPDATE "PropertyTransaction" SET status = 'completed', "updatedAt" = NOW() WHERE id = $1`, [id]);

    await c.query(`
      INSERT INTO "OutboundMessage" (id, "transactionId", type, "contactIds", content, "createdById", "createdAt", "updatedAt")
      VALUES ($1, $2, 'internal_note', '{}', $3, $4, NOW(), NOW())
    `, [createId(), id, "Marked as completed. Both parties have confirmed.", ELLIS_USER_ID]);

    await c.query(`
      INSERT INTO "Event" (id, type, "agencyId", "userId", "entityType", "entityId", metadata, "occurredAt")
      VALUES ($1, 'transaction_status_changed', $2, $3, 'PropertyTransaction', $4, $5::jsonb, NOW())
    `, [
      createId(),
      tx.agencyId,
      ELLIS_USER_ID,
      id,
      JSON.stringify({ from: "active", to: "completed", trigger: "manual_backfill_2026_08_08" }),
    ]);

    await c.query("COMMIT");
    console.log(`   ✓ flipped: ${tx.propertyAddress}`);
    flipped++;
  } catch (err) {
    await c.query("ROLLBACK");
    console.error(`   ✗ failed: ${tx.propertyAddress}`, err);
  }
}

console.log(`\nDone. flipped=${flipped}  skipped=${skipped}  total=${IDS.length}`);
await c.end();
