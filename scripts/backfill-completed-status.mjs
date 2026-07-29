// scripts/backfill-completed-status.mjs
// One-shot data fix (Ellis, 2026-07-28):
//   1. Flip to status='completed' the outsourced files that have a completion
//      milestone (VM20 or PM27) confirmed but are still stuck on 'active'.
//      Root cause: app/actions/milestones.ts only auto-flips when BOTH VM20
//      AND PM27 are complete; single-sided completions never flip.
//   2. Null out the one Contact whose email field holds a phone number
//      (Emma O'Connell, 20 Williamson Way) — the phone is already in .phone.
//
// Prints before/after evidence. Writes run inside one transaction.
// Run: npx dotenv -e .env.production -- node scripts/backfill-completed-status.mjs
//
// Deletion criteria: one-shot; delete after the 2026-07-28 backfill.
// Tracked in docs/SCRIPTS_REGISTRY.md.

import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// ── Evidence: which files, and which side(s) confirmed completion ──────────
const targets = (await c.query(`
  SELECT pt.id, pt."propertyAddress" AS address, pt.status::text AS status,
         pt."completionDate" AS completion_date,
         bool_or(md.code='VM20' AND mc.state='complete') AS vm20_done,
         bool_or(md.code='PM27' AND mc.state='complete') AS pm27_done
    FROM "PropertyTransaction" pt
    JOIN "Agency" a ON a.id = pt."agencyId"
    LEFT JOIN "MilestoneCompletion" mc ON mc."transactionId" = pt.id
    LEFT JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
   WHERE pt.status = 'active' AND pt."serviceType" = 'outsourced' AND a."isInternal" = false
   GROUP BY pt.id, pt."propertyAddress", pt.status, pt."completionDate"
  HAVING bool_or(md.code IN ('VM20','PM27') AND mc.state = 'complete')
   ORDER BY pt."propertyAddress"
`)).rows;

console.log(`Files to mark completed: ${targets.length}`);
for (const t of targets) {
  const sides = `VM20(seller)=${t.vm20_done ? "✓" : "—"} PM27(buyer)=${t.pm27_done ? "✓" : "—"}`;
  console.log(`  ${t.address} | status=${t.status} | ${sides} | completionDate=${t.completion_date ? String(t.completion_date).slice(0, 10) : "none"}`);
}
const bothCount = targets.filter((t) => t.vm20_done && t.pm27_done).length;
console.log(`  → ${bothCount}/${targets.length} had BOTH sides confirmed; the rest were single-sided (never auto-flipped).`);

// ── Emma O'Connell — phone number in the email field ───────────────────────
const emma = (await c.query(`
  SELECT ct.id, ct.name, ct.email, ct.phone, pt."propertyAddress" AS address
    FROM "Contact" ct JOIN "PropertyTransaction" pt ON pt.id = ct."propertyTransactionId"
   WHERE ct.email = '07964 496 712'
`)).rows;
console.log(`\nContact with phone-in-email: ${emma.length}`);
for (const e of emma) console.log(`  ${e.address} | ${e.name} | email="${e.email}" | phone="${e.phone}"`);

// ── Writes (transactional) ─────────────────────────────────────────────────
const ids = targets.map((t) => t.id);
await c.query("BEGIN");
try {
  // Matches the app's own auto-flip (app/actions/milestones.ts): sets status
  // only. PropertyTransaction has no statusReason column.
  const upd = await c.query(
    `UPDATE "PropertyTransaction"
        SET status = 'completed', "updatedAt" = now()
      WHERE id = ANY($1::text[]) AND status = 'active'`,
    [ids]
  );
  const emmaUpd = await c.query(
    `UPDATE "Contact" SET email = NULL, "updatedAt" = now() WHERE email = '07964 496 712'`
  );
  await c.query("COMMIT");
  console.log(`\n✓ Marked ${upd.rowCount} transactions completed.`);
  console.log(`✓ Cleared ${emmaUpd.rowCount} bogus email (phone kept on the phone field).`);
} catch (err) {
  await c.query("ROLLBACK");
  console.error("Rolled back:", err.message);
  process.exit(1);
}

// ── Verify ─────────────────────────────────────────────────────────────────
const stillActive = (await c.query(`
  SELECT count(*)::int AS n
    FROM "PropertyTransaction" pt
    JOIN "Agency" a ON a.id = pt."agencyId"
    LEFT JOIN "MilestoneCompletion" mc ON mc."transactionId" = pt.id
    LEFT JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
   WHERE pt.status = 'active' AND pt."serviceType" = 'outsourced' AND a."isInternal" = false
     AND md.code IN ('VM20','PM27') AND mc.state = 'complete'
`)).rows[0].n;
console.log(`\nVerify: outsourced files still 'active' with a completion milestone: ${stillActive} (should be 0).`);
await c.end();
