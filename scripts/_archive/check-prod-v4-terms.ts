// Read-only: confirm v4 TermsVersion migration + row exist on PRODUCTION.
//
// Loads .env.production manually (same pattern as migrate-prod.mjs), aborts
// if DATABASE_URL doesn't resolve to the prod project, then reads:
//   1. _prisma_migrations row for 20260526100000_terms_version_v4
//   2. TermsVersion row with versionTag = '2026-06-payments-v4'
//
// No writes. Pure check, safe to run any time.
//
// Run:
//   npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/check-prod-v4-terms.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const EXPECTED_PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const ENV_PROD = resolve(".", ".env.production");
const MIGRATION_NAME = "20260526100000_terms_version_v4";
const VERSION_TAG = "2026-06-payments-v4";

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
  const text = stripBom(readFileSync(ENV_PROD, "utf8"));
  const dbUrl = getVar(text, "DATABASE_URL");
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
  const prisma = new PrismaClient();

  try {
    console.log("");
    console.log("=========================================================");
    console.log(`  Checking PRODUCTION (${proj}) for v4 terms readiness`);
    console.log("=========================================================");

    // 1. Migration row in _prisma_migrations
    const migRows = await prisma.$queryRawUnsafe<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >(
      `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"
       WHERE migration_name = $1`,
      MIGRATION_NAME,
    );

    if (migRows.length === 0) {
      console.log(`  Migration:    NOT FOUND  (${MIGRATION_NAME})`);
    } else {
      const r = migRows[0];
      const status = r.rolled_back_at
        ? `ROLLED BACK at ${r.rolled_back_at.toISOString()}`
        : r.finished_at
          ? `applied at ${r.finished_at.toISOString()}`
          : "pending (started but not finished)";
      console.log(`  Migration:    ${status}`);
    }

    // 2. The actual TermsVersion row
    const row = await prisma.termsVersion.findUnique({
      where: { versionTag: VERSION_TAG },
      select: { id: true, versionTag: true, effectiveFrom: true, bodySections: true },
    });

    if (!row) {
      console.log(`  TermsVersion: NOT FOUND  (versionTag '${VERSION_TAG}')`);
    } else {
      const sectionCount = Array.isArray(row.bodySections) ? row.bodySections.length : "n/a";
      const firstHeading =
        Array.isArray(row.bodySections) && row.bodySections.length > 0
          ? (row.bodySections[0] as { heading?: string }).heading
          : null;
      console.log(`  TermsVersion: FOUND`);
      console.log(`    id:            ${row.id}`);
      console.log(`    versionTag:    ${row.versionTag}`);
      console.log(`    effectiveFrom: ${row.effectiveFrom.toISOString()}`);
      console.log(`    sections:      ${sectionCount}`);
      console.log(`    first heading: ${firstHeading ?? "(none)"}`);
    }

    console.log("=========================================================");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
