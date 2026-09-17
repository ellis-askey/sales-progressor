// One-shot cleanup (2026-09-17): dismiss "Needs filing" tray rows that have NO
// candidate file. Before the fix in lib/integrations/mail/ingest.ts, the tray
// kept every unmatched inbound email — newsletters, billing, build alerts, test
// mail — none of which relate to any property. Going forward those are dropped;
// this clears the ones already queued.
//
// Dismisses (status='dismissed'), never deletes — fully reversible. Targets only
// OPEN rows with an empty candidates array.
//
// Run (staging dry):  npx ts-node --project tsconfig.scripts.json scripts/cleanup-noise-pending-emails.ts
// Run (staging apply): ... --apply
// Run (prod dry):      ... --prod
// Run (prod apply):    ... --prod --apply
// Delete criteria: remove once run on staging + prod and confirmed.

import "dotenv/config";
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");
const USE_PROD = process.argv.includes("--prod");
const url = USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(USE_PROD ? "PROD_DATABASE_URL not set" : "DATABASE_URL not set"); process.exit(1); }

async function main() {
  let host = "?"; try { host = new URL(url!).host; } catch {}
  console.log(`DB host: ${host}   mode: ${APPLY ? "APPLY (will dismiss)" : "DRY RUN"}`);
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const where = `status='open' AND COALESCE(jsonb_array_length(candidates), 0) = 0`;
  const { rows } = await c.query(
    `SELECT count(*)::int AS n FROM "PendingInboundEmail" WHERE ${where}`
  );
  console.log(`Open no-candidate tray rows: ${rows[0].n}`);

  const sample = await c.query(
    `SELECT direction, "fromEmail", left(subject,55) AS subject FROM "PendingInboundEmail" WHERE ${where} ORDER BY "createdAt" DESC LIMIT 12`
  );
  for (const r of sample.rows) console.log(`  ${r.direction}  ${r.fromEmail}  ${r.subject}`);

  if (!APPLY) { console.log("\nDRY RUN — nothing changed. Re-run with --apply."); await c.end(); return; }
  const res = await c.query(
    `UPDATE "PendingInboundEmail" SET status='dismissed', "resolvedAt"=now() WHERE ${where}`
  );
  console.log(`\nDismissed ${res.rowCount} rows.`);
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
