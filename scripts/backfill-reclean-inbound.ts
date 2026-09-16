// One-shot backfill (2026-09-16): re-clean the displayed text of inbound emails
// that were synced BEFORE the Phase A cleaning improvements. Each stored inbound
// email kept its untouched original in providerWebhookData.raw; the cleaner only
// ran at ingest, and re-syncs de-dupe (skip) rather than re-clean, so older
// emails still show signatures / quoted trails the current cleaner would strip.
//
// This re-runs the CURRENT cleaner over the preserved raw and updates `content`
// where it differs. Safe + reversible: the raw is never touched, so "show
// original" still works and this can be re-run at any time.
//
// Uses a raw `pg` connection (not Prisma) so it doesn't depend on the generated
// Prisma engine — which the local dev server locks. Targets DATABASE_URL by
// default; pass --prod to target PROD_DATABASE_URL.
//
// Run (staging dry run):  npx ts-node --project tsconfig.scripts.json scripts/backfill-reclean-inbound.ts
// Run (staging apply):    ... scripts/backfill-reclean-inbound.ts --apply
// Run (prod dry run):     ... scripts/backfill-reclean-inbound.ts --prod
// Run (prod apply):       ... scripts/backfill-reclean-inbound.ts --prod --apply
// Delete criteria: remove this file once run on staging + prod and confirmed.

import "dotenv/config";
import { Client } from "pg";
import { cleanIngestedEmail } from "../lib/email/clean-inbound";

const APPLY = process.argv.includes("--apply");
const USE_PROD = process.argv.includes("--prod");
const url = USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(USE_PROD ? "PROD_DATABASE_URL not set" : "DATABASE_URL not set"); process.exit(1); }

const BATCH = 500;

function preview(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 140);
}

type Row = { id: string; content: string | null; providerWebhookData: { raw?: unknown } | null };

async function main() {
  let host = "(unknown)";
  try { host = new URL(url ?? "").host; } catch { /* noop */ }
  console.log(`DB host: ${host}   mode: ${APPLY ? "APPLY (will update)" : "DRY RUN"}`);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let cursor = "";
  let scanned = 0;
  let withRaw = 0;
  let changed = 0;
  let updated = 0;
  const samples: { id: string; before: string; after: string }[] = [];

  try {
    for (;;) {
      const res = await client.query<Row>(
        `SELECT id, content, "providerWebhookData"
           FROM "OutboundMessage"
          WHERE type = 'inbound' AND method = 'email' AND id > $1
          ORDER BY id ASC
          LIMIT ${BATCH}`,
        [cursor]
      );
      if (res.rows.length === 0) break;
      cursor = res.rows[res.rows.length - 1]!.id;

      for (const row of res.rows) {
        scanned++;
        const raw = row.providerWebhookData?.raw;
        if (typeof raw !== "string" || !raw.trim()) continue;
        withRaw++;

        const cleaned = cleanIngestedEmail(raw) || raw.trim();
        const current = (row.content ?? "").trim();
        if (cleaned.trim() === current) continue;
        changed++;

        if (samples.length < 6) {
          samples.push({ id: row.id, before: preview(current), after: preview(cleaned) });
        }

        if (APPLY) {
          await client.query(`UPDATE "OutboundMessage" SET content = $1 WHERE id = $2`, [cleaned, row.id]);
          updated++;
        }
      }
    }
  } finally {
    await client.end();
  }

  console.log(`\nScanned inbound emails:      ${scanned}`);
  console.log(`With a preserved original:   ${withRaw}`);
  console.log(`Would re-clean (differs):    ${changed}`);
  if (APPLY) console.log(`Updated:                     ${updated}`);

  if (samples.length) {
    console.log(`\nSample before -> after (first ${samples.length}):`);
    for (const s of samples) {
      console.log(`\n  · ${s.id}`);
      console.log(`    BEFORE: ${s.before}`);
      console.log(`    AFTER:  ${s.after}`);
    }
  }

  if (!APPLY) console.log("\nDRY RUN — nothing changed. Re-run with --apply to write.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
