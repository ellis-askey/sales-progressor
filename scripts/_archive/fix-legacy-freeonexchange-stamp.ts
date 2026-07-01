// One-shot prod data fix:
//
// Flip PropertyTransaction.freeOnExchange from true → false for every
// active/on-hold sale on a legacy-tier agency.
//
// Background: legacy agencies are on a fixed fee per their pre-existing
// contract and should never have any sale flagged as free-on-exchange.
// stampTrialState used to treat them identically to standard agencies,
// so the agency's first sale and any sale within 14 days of
// firstSubmissionAt got freeOnExchange=true. The behaviour itself was
// fixed in the lib/services/trial.ts change that landed alongside this
// script (legacy now always returns false), but existing rows were
// already stamped. None have exchanged yet, so flipping them now
// recovers the £~5,040 of revenue at risk on the current pipeline
// without any retroactive un-billing.
//
// Filters:
//   - agency.feeTier = "legacy"
//   - freeOnExchange = true
//   - exchangedAt IS NULL  (defence: never un-set a flag on a row that's
//     already exchanged with £0 settled — even if such a row exists,
//     leave it alone. Bill audit history first.)
//
// Idempotent: re-runs find zero matching rows. Wrapped in a Prisma
// transaction so it's atomic. Uses raw SQL for the write because prod
// has an unapplied migration on PropertyTransaction (activeBuyerRoundId
// column) that breaks Prisma's typed update RETURNING clause.
//
// Run (prod):
//   1. `npx prisma generate`  (engine-equipped client)
//   2. `npx ts-node \
//        --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//        --require tsconfig-paths/register \
//        scripts/fix-legacy-freeonexchange-stamp.ts`
//   3. `npx prisma generate --no-engine`  (restore)

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const EXPECTED_PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const ENV_PROD = resolve(".", ".env.production");

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function getVar(content: string, key: string): string | null {
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m");
  const m = content.match(re);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, "");
}

function projectIdOf(url: string | undefined): string {
  const m = url?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/);
  return m ? m[1] : "UNKNOWN";
}

async function main() {
  if (!existsSync(ENV_PROD)) {
    console.error(`ABORT: ${ENV_PROD} does not exist.`);
    process.exit(1);
  }
  const dbUrl = getVar(stripBom(readFileSync(ENV_PROD, "utf8")), "DATABASE_URL");
  if (!dbUrl) {
    console.error("ABORT: DATABASE_URL not found in .env.production.");
    process.exit(1);
  }
  const proj = projectIdOf(dbUrl);
  if (proj !== EXPECTED_PROD_PROJECT_ID) {
    console.error(`ABORT: resolved project id (${proj}) is not prod (${EXPECTED_PROD_PROJECT_ID}).`);
    process.exit(1);
  }
  process.env.DATABASE_URL = dbUrl;

  console.log("");
  console.log("================================================================");
  console.log("  Flipping legacy freeOnExchange=true rows on PROD");
  console.log("================================================================");
  console.log(`  Project ID: ${proj}`);
  console.log("================================================================");
  console.log("");

  const prisma = new PrismaClient();
  try {
    // ── Pre-flight ───────────────────────────────────────────────────────
    const legacyAgencies = await prisma.agency.findMany({
      where: { feeTier: "legacy" },
      select: { id: true, name: true, legacyOutsourcedFeePence: true },
      orderBy: { name: "asc" },
    });
    console.log(`Legacy agencies: ${legacyAgencies.length}`);
    for (const a of legacyAgencies) {
      console.log(`  ${a.name.padEnd(24)} £${(a.legacyOutsourcedFeePence ?? 0) / 100}`);
    }
    console.log("");

    const legacyAgencyIds = legacyAgencies.map((a) => a.id);
    if (legacyAgencyIds.length === 0) {
      console.log("No legacy agencies. Nothing to fix. Exiting.");
      return;
    }

    const targets = await prisma.propertyTransaction.findMany({
      where: {
        agencyId: { in: legacyAgencyIds },
        freeOnExchange: true,
        exchangedAt: null,
      },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        createdAt: true,
        agencyId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`Rows to flip: ${targets.length}`);
    console.log("");
    if (targets.length === 0) {
      console.log("Nothing to do. Exiting.");
      return;
    }

    // Group by agency for the printout
    const byAgency = new Map<string, typeof targets>();
    for (const t of targets) {
      const k = t.agencyId;
      if (!byAgency.has(k)) byAgency.set(k, []);
      byAgency.get(k)!.push(t);
    }
    for (const a of legacyAgencies) {
      const rows = byAgency.get(a.id) ?? [];
      if (rows.length === 0) continue;
      console.log(`  ${a.name}  (${rows.length} ${rows.length === 1 ? "row" : "rows"})`);
      for (const r of rows) {
        const created = r.createdAt.toISOString().slice(0, 10);
        console.log(`    ${created}  ${r.status.padEnd(8)}  ${r.id}  ${r.propertyAddress}`);
      }
    }
    console.log("");

    // ── Update (atomic, raw SQL to dodge the prod schema-drift on
    // ── PropertyTransaction.activeBuyerRoundId) ─────────────────────────
    console.log("Applying update…");
    const targetIds = targets.map((t) => t.id);
    const result = await prisma.$transaction(async (tx) => {
      // PostgreSQL's $executeRawUnsafe with an array parameter via Prisma
      // doesn't bind cleanly for `id = ANY($1)` against text[], so we
      // build the parameterised list literal instead. Length is bounded
      // (21 rows audit-confirmed) so this is safe.
      const placeholders = targetIds.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `UPDATE "PropertyTransaction" SET "freeOnExchange" = false WHERE id IN (${placeholders})`;
      return tx.$executeRawUnsafe(sql, ...targetIds);
    });
    console.log(`  Updated ${result} rows.`);
    console.log("");

    // ── Post-flight ──────────────────────────────────────────────────────
    const remaining = await prisma.propertyTransaction.count({
      where: {
        agencyId: { in: legacyAgencyIds },
        freeOnExchange: true,
        exchangedAt: null,
      },
    });
    console.log("Post-flight verification:");
    if (remaining === 0) {
      console.log(`  ✓ Zero remaining legacy + freeOnExchange=true + un-exchanged rows.`);
    } else {
      console.log(`  ✗ ${remaining} rows still flagged. Investigate.`);
      process.exit(1);
    }
    console.log("");
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
