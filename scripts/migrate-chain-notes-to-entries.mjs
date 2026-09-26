// One-shot: migrate the legacy single ChainLink.chainNotes blob into dated
// ChainLinkEntry rows (b1ey9l). Splits a note on newlines, pulls a leading
// UK-format date (DD.MM.YYYY / DD/MM/YYYY / DD:MM:YYYY) off each line to use as
// the entry's timestamp, and strips that date from the body. Undated lines fall
// back to the link's lastChainCheckAt (else createdAt). After creating entries
// it nulls chainNotes so the note isn't shown twice. Idempotent: links that
// already have entries are skipped.
//
// Usage (from project root):
//   node --env-file=.env scripts/migrate-chain-notes-to-entries.mjs            # dry-run on staging
//   node --env-file=.env scripts/migrate-chain-notes-to-entries.mjs --apply    # write to staging
//   node --env-file=.env scripts/migrate-chain-notes-to-entries.mjs --prod            # dry-run on prod
//   node --env-file=.env scripts/migrate-chain-notes-to-entries.mjs --prod --apply    # write to prod
//
// Registry: docs/SCRIPTS_REGISTRY.md. Delete after the b1ey9l rollout is verified
// on prod (one-shot; no ongoing use).

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const PROD = process.argv.includes("--prod");
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(PROD ? "PROD_DATABASE_URL not set" : "DATABASE_URL not set");
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url } } });

const DATE_RE = /^(\d{1,2})[.\/:](\d{1,2})[.\/:](\d{4})\s*:?\s*/;

function parseNotesToEntries(note, fallback) {
  const segments = note.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  segments.forEach((seg, i) => {
    let when = fallback;
    let body = seg;
    const m = seg.match(DATE_RE);
    if (m) {
      const day = +m[1], mon = +m[2], year = +m[3];
      if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && year >= 2000 && year < 2100) {
        when = new Date(Date.UTC(year, mon - 1, day, 12, 0, 0));
        body = seg.slice(m[0].length).trim();
      }
    }
    if (!body) return; // a date-only line with no text
    // +i seconds keeps multi-line notes in source order under newest-first sort.
    out.push({ body, createdAt: new Date(when.getTime() + i * 1000) });
  });
  return out;
}

const links = await db.chainLink.findMany({
  where: { chainNotes: { not: null } },
  select: { id: true, chainNotes: true, lastChainCheckAt: true, createdAt: true },
});

// Idempotency: skip links that already have entries. Tolerate the entries table
// not existing yet (a dry-run before the prod migration has deployed).
const alreadyMigrated = new Set();
try {
  const rows = await db.chainLinkEntry.findMany({
    where: { chainLinkId: { in: links.map((l) => l.id) } },
    select: { chainLinkId: true },
  });
  rows.forEach((r) => alreadyMigrated.add(r.chainLinkId));
} catch {
  console.log("(entries table not present yet — treating all as un-migrated for this preview)\n");
}

console.log(`\n${PROD ? "PROD" : "STAGING"}  ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`Links with chainNotes: ${links.length}\n`);

let linksMigrated = 0;
let entriesCreated = 0;
let skipped = 0;

for (const l of links) {
  if (alreadyMigrated.has(l.id)) {
    skipped++;
    continue; // already migrated
  }
  const fallback = l.lastChainCheckAt ?? l.createdAt;
  const parsed = parseNotesToEntries(l.chainNotes, fallback);
  if (parsed.length === 0) {
    skipped++;
    continue;
  }
  console.log(`--- link ${l.id.slice(-6)}: ${parsed.length} entr${parsed.length === 1 ? "y" : "ies"} ---`);
  for (const e of parsed) {
    console.log(`   ${e.createdAt.toISOString().slice(0, 10)}  ${e.body.slice(0, 90)}${e.body.length > 90 ? "…" : ""}`);
  }
  if (APPLY) {
    await db.$transaction([
      db.chainLinkEntry.createMany({
        data: parsed.map((e) => ({ chainLinkId: l.id, body: e.body, authorId: null, authorName: null, createdAt: e.createdAt })),
      }),
      db.chainLink.update({ where: { id: l.id }, data: { chainNotes: null } }),
    ]);
  }
  linksMigrated++;
  entriesCreated += parsed.length;
}

console.log(`\n${APPLY ? "Migrated" : "Would migrate"}: ${linksMigrated} links → ${entriesCreated} entries (skipped ${skipped}).`);
if (!APPLY) console.log("Dry-run only. Re-run with --apply to write.");
await db.$disconnect();
