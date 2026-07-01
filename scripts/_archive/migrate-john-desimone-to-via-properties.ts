// One-shot prod data fix:
//
//   - Move user John Desimone (cmpy4k2520005p4imtenx00it) from the
//     self-created agency "Via Properties Ltd" to the existing legacy
//     agency "Via Properties".
//   - Move his 14:05 active transaction (14 Cedar Green) to Via
//     Properties along with him.
//   - Delete his 14:03 draft transaction at the same address (false start
//     two minutes earlier).
//   - Move the one FileTimeSession row keyed to the source agencyId so
//     the (agencyId, startedAt) index stays accurate.
//   - Delete "Via Properties Ltd" — now empty.
//
// John signed up via /register instead of accepting an invite from his
// director on the existing Via Properties account, which spawned the
// shadow Ltd agency. Pre-flight inventory (run before this script was
// authored) confirmed the source agency has zero rows in the
// non-cascade blocker tables (AgencyPreferredBroker /
// AgencyRecommendedSolicitor / PropertyChain / VerifiedDomain / etc.),
// so the agency delete at the end will not be blocked.
//
// Wraps every write in a single prisma.$transaction so it is atomic.
// Aborts with a clear error if any pre-flight check fails.
//
// Run (prod):
//   1. Regenerate Prisma client with engine: `npx prisma generate`
//   2. `npx ts-node \
//        --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//        --require tsconfig-paths/register \
//        scripts/migrate-john-desimone-to-via-properties.ts`
//   3. Restore --no-engine: `npx prisma generate --no-engine`

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const EXPECTED_PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const ENV_PROD = resolve(".", ".env.production");

// Migration constants — all hardcoded prod ids, locked from the pre-flight.
const SOURCE_AGENCY = "cmpy4k20u0003p4imozqvmdpp"; // Via Properties Ltd
const DEST_AGENCY = "cmp6s72xa0001pxaxlbuqhq5k"; // Via Properties
const JOHN_USER = "cmpy4k2520005p4imtenx00it";
const ACTIVE_TX = "cmpy52abu000213bi0tzvvymm";
const DRAFT_TX = "cmpy4zrhk0001860rr19lpgax";

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
  // ── Resolve prod connection ────────────────────────────────────────────────
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
  console.log("  Moving John Desimone → Via Properties on PROD");
  console.log("================================================================");
  console.log(`  Project ID:    ${proj}`);
  console.log(`  Source agency: ${SOURCE_AGENCY}  (Via Properties Ltd)`);
  console.log(`  Dest agency:   ${DEST_AGENCY}  (Via Properties)`);
  console.log(`  John (user):   ${JOHN_USER}`);
  console.log(`  Active tx:     ${ACTIVE_TX}  (move)`);
  console.log(`  Draft tx:      ${DRAFT_TX}  (delete)`);
  console.log("================================================================");
  console.log("");

  const prisma = new PrismaClient();

  try {
    // ── Pre-flight ──────────────────────────────────────────────────────────
    console.log("Pre-flight checks…");

    const [source, dest, john, draft, active] = await Promise.all([
      prisma.agency.findUnique({
        where: { id: SOURCE_AGENCY },
        select: { id: true, name: true },
      }),
      prisma.agency.findUnique({
        where: { id: DEST_AGENCY },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: JOHN_USER },
        select: { id: true, name: true, email: true, role: true, agencyId: true },
      }),
      prisma.propertyTransaction.findUnique({
        where: { id: DRAFT_TX },
        select: { id: true, status: true, agencyId: true, propertyAddress: true },
      }),
      prisma.propertyTransaction.findUnique({
        where: { id: ACTIVE_TX },
        select: { id: true, status: true, agencyId: true, propertyAddress: true },
      }),
    ]);

    if (!source) throw new Error(`Source agency ${SOURCE_AGENCY} not found.`);
    if (source.name !== "Via Properties Ltd") {
      throw new Error(`Source agency name is "${source.name}", expected "Via Properties Ltd".`);
    }
    if (!dest) throw new Error(`Dest agency ${DEST_AGENCY} not found.`);
    if (dest.name !== "Via Properties") {
      throw new Error(`Dest agency name is "${dest.name}", expected "Via Properties".`);
    }
    if (!john) throw new Error(`User ${JOHN_USER} not found.`);
    if (john.email !== "john@viavia.co.uk") {
      throw new Error(`User email is "${john.email}", expected "john@viavia.co.uk".`);
    }
    if (john.agencyId !== SOURCE_AGENCY) {
      throw new Error(`John is on agencyId ${john.agencyId}, expected source ${SOURCE_AGENCY}.`);
    }
    if (!draft) throw new Error(`Draft tx ${DRAFT_TX} not found.`);
    if (draft.status !== "draft") {
      throw new Error(`Draft tx status is "${draft.status}", expected "draft".`);
    }
    if (draft.agencyId !== SOURCE_AGENCY) {
      throw new Error(`Draft tx is on agencyId ${draft.agencyId}, expected source.`);
    }
    if (!active) throw new Error(`Active tx ${ACTIVE_TX} not found.`);
    if (active.status !== "active") {
      throw new Error(`Active tx status is "${active.status}", expected "active".`);
    }
    if (active.agencyId !== SOURCE_AGENCY) {
      throw new Error(`Active tx is on agencyId ${active.agencyId}, expected source.`);
    }

    // Re-verify blockers are still zero (something might've been written since
    // the inventory run).
    const [prefBroker, recSols, chains, verDomains] = await Promise.all([
      prisma.agencyPreferredBroker.count({ where: { agencyId: SOURCE_AGENCY } }),
      prisma.agencyRecommendedSolicitor.count({ where: { agencyId: SOURCE_AGENCY } }),
      prisma.propertyChain.count({ where: { agencyId: SOURCE_AGENCY } }),
      prisma.verifiedDomain.count({ where: { agencyId: SOURCE_AGENCY } }),
    ]);
    const blockers = { prefBroker, recSols, chains, verDomains };
    const hasBlocker = Object.values(blockers).some((n) => n > 0);
    if (hasBlocker) {
      console.error("ABORT — non-cascade blocker rows appeared since the inventory run:");
      console.error(blockers);
      process.exit(1);
    }

    console.log("  All pre-flight checks passed.");
    console.log("");

    // ── Migration (single atomic transaction) ──────────────────────────────
    console.log("Running migration…");

    const fileTimeBefore = await prisma.fileTimeSession.count({
      where: { agencyId: SOURCE_AGENCY },
    });

    // Raw SQL writes inside one transaction. Prisma's typed delete/update
    // try to RETURNING all columns, which breaks on prod because the
    // schema-in-code has an `activeBuyerRoundId` column that hasn't been
    // migrated to the prod DB yet. Raw SQL avoids that schema check —
    // we don't need any row data back, only the side effects.
    await prisma.$transaction([
      // 1. Delete the false-start draft. Children cascade via FK.
      prisma.$executeRawUnsafe(
        `DELETE FROM "PropertyTransaction" WHERE id = $1`,
        DRAFT_TX,
      ),

      // 2. Move the active sale to Via Properties.
      prisma.$executeRawUnsafe(
        `UPDATE "PropertyTransaction" SET "agencyId" = $1 WHERE id = $2`,
        DEST_AGENCY,
        ACTIVE_TX,
      ),

      // 3. Move any FileTimeSession rows scoped to the source agency.
      prisma.$executeRawUnsafe(
        `UPDATE "FileTimeSession" SET "agencyId" = $1 WHERE "agencyId" = $2`,
        DEST_AGENCY,
        SOURCE_AGENCY,
      ),

      // 4. Move John. Role stays "negotiator" (already correct).
      prisma.$executeRawUnsafe(
        `UPDATE "User" SET "agencyId" = $1 WHERE id = $2`,
        DEST_AGENCY,
        JOHN_USER,
      ),

      // 5. Delete the now-empty Via Properties Ltd.
      prisma.$executeRawUnsafe(
        `DELETE FROM "Agency" WHERE id = $1`,
        SOURCE_AGENCY,
      ),
    ]);

    console.log("  Transaction committed.");
    console.log("");

    // ── Post-flight verification ───────────────────────────────────────────
    console.log("Post-flight verification…");

    const [sourceAfter, johnAfter, activeAfter, draftAfter, destTxCount, fileTimeAfter] = await Promise.all([
      prisma.agency.findUnique({ where: { id: SOURCE_AGENCY }, select: { id: true } }),
      prisma.user.findUnique({
        where: { id: JOHN_USER },
        select: { agencyId: true, role: true },
      }),
      prisma.propertyTransaction.findUnique({
        where: { id: ACTIVE_TX },
        select: { agencyId: true, status: true, contacts: { select: { id: true } } },
      }),
      prisma.propertyTransaction.findUnique({
        where: { id: DRAFT_TX },
        select: { id: true },
      }),
      prisma.propertyTransaction.count({ where: { agencyId: DEST_AGENCY } }),
      prisma.fileTimeSession.count({ where: { agencyId: DEST_AGENCY } }),
    ]);

    const checks: { label: string; ok: boolean; detail: string }[] = [
      {
        label: "Source agency deleted",
        ok: sourceAfter === null,
        detail: sourceAfter ? "still present" : "gone",
      },
      {
        label: "John's agencyId",
        ok: johnAfter?.agencyId === DEST_AGENCY,
        detail: `now ${johnAfter?.agencyId}`,
      },
      {
        label: "John's role",
        ok: johnAfter?.role === "negotiator",
        detail: `${johnAfter?.role}`,
      },
      {
        label: "Active tx agencyId",
        ok: activeAfter?.agencyId === DEST_AGENCY,
        detail: `now ${activeAfter?.agencyId}, status ${activeAfter?.status}, ${activeAfter?.contacts.length ?? 0} contacts`,
      },
      {
        label: "Draft tx deleted",
        ok: draftAfter === null,
        detail: draftAfter ? "still present" : "gone",
      },
      {
        label: "Dest agency tx count",
        ok: true,
        detail: `${destTxCount} transactions`,
      },
      {
        label: "FileTimeSession moved",
        ok: fileTimeAfter >= fileTimeBefore,
        detail: `dest now has ${fileTimeAfter}; source had ${fileTimeBefore} before`,
      },
    ];

    for (const c of checks) {
      const mark = c.ok ? "✓" : "✗";
      console.log(`  ${mark} ${c.label.padEnd(28)} ${c.detail}`);
    }
    const failed = checks.filter((c) => !c.ok);
    if (failed.length > 0) {
      console.error("");
      console.error("Some post-flight checks failed. Investigate before next step.");
      process.exit(1);
    }

    console.log("");
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
