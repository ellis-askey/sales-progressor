// One-shot cleanup (2026-09-16): remove the redundant internal_note rows created
// on portal milestone confirmations — the "X confirmed \"...\" via the client
// portal" notes that were stamped with the file agent's id (so they wore the
// agent's photo) and duplicated the "Confirmed by client" completion entry that
// already shows in the activity timeline.
//
// The write that created these was removed from lib/services/portal.ts on
// 2026-09-16, so no new ones are produced. This clears the historical rows.
//
// Targets ONLY the confirm notes: type = internal_note, content contains
// `confirmed "` AND ends with `via the client portal`. The other portal
// internal_notes ("... told us ... they're expecting ..." and "... left a note
// ... about ...") do not match, so they are untouched.
//
// Targets DATABASE_URL by default; pass --prod to target PROD_DATABASE_URL
// (both read from .env via dotenv, so quoting is handled correctly).
//
// Run (staging dry run):  npx ts-node --project tsconfig.scripts.json scripts/cleanup-portal-confirm-dupes.ts
// Run (staging delete):   ... scripts/cleanup-portal-confirm-dupes.ts --apply
// Run (prod dry run):     ... scripts/cleanup-portal-confirm-dupes.ts --prod
// Run (prod delete):      ... scripts/cleanup-portal-confirm-dupes.ts --prod --apply
// Delete criteria: remove this file once run on staging + prod and confirmed.

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const USE_PROD = process.argv.includes("--prod");
const url = USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(USE_PROD ? "PROD_DATABASE_URL not set" : "DATABASE_URL not set"); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

const where: Prisma.OutboundMessageWhereInput = {
  type: "internal_note",
  AND: [
    { content: { contains: 'confirmed "' } },
    { content: { endsWith: "via the client portal" } },
  ],
};

async function main() {
  let host = "(unknown)";
  try { host = new URL(url ?? "").host; } catch { /* noop */ }
  console.log(`DB host: ${host}   mode: ${APPLY ? "APPLY (will delete)" : "DRY RUN"}`);

  const count = await prisma.outboundMessage.count({ where });
  console.log(`Redundant portal-confirm notes matched: ${count}`);

  const samples = await prisma.outboundMessage.findMany({
    where,
    select: { id: true, content: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  for (const s of samples) console.log(`  · ${s.createdAt.toISOString()}  ${s.content}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply to delete.");
    return;
  }
  const res = await prisma.outboundMessage.deleteMany({ where });
  console.log(`\nDeleted ${res.count} rows.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
