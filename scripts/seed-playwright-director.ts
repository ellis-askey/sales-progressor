// One-shot: create or refresh a staging director user dedicated to
// Playwright screenshot capture and the surface-file-detail E2E test.
//
// Why: TEST_PASSWORD in .env.test.local is "password" but the staging
// taylor@akeman-residential.co.uk account uses a different password
// (kept out of CC's reach for safety). Without a working login the
// Phase 3 Step 1 baseline capture can't run autonomously.
//
// Solution: a dedicated test director with a known password, attached
// to an existing agency that has visible files. Idempotent — re-running
// just resets the password.
//
// Run (staging only):
//   env $(grep -E "^DATABASE_URL=|^DIRECT_URL=" .env.preview | xargs) \
//     npx tsx scripts/seed-playwright-director.ts
//
// Registered in docs/SCRIPTS_REGISTRY.md per Law 15.
// Lifetime: ongoing (re-runnable to reset password if it ever rotates).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs"; // matches lib/auth.ts

const TEST_EMAIL = "playwright-baseline@thesalesprogressor.test";
const TEST_PASSWORD = "password";
const TEST_NAME = "Playwright Baseline";

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  // Refuse to run against prod under any circumstance.
  if (dbUrl.includes("gmkfustgwipgihpmpjpr")) {
    console.error("REFUSING: this script must NOT run against the prod DB.");
    console.error(`Current DATABASE_URL host suggests prod (project id gmkfustgwipgihpmpjpr).`);
    process.exit(1);
  }
  if (!dbUrl.includes("etidawkbqctarmsdjoxp")) {
    console.error("REFUSING: this script only runs against the staging DB.");
    console.error(`Current DATABASE_URL does not point to staging (etidawkbqctarmsdjoxp).`);
    process.exit(1);
  }
  console.log("OK — staging DB confirmed (etidawkbqctarmsdjoxp).");

  // Pick the first agency with at least one active transaction so the
  // test director has visible files to render in screenshots.
  const agency = await prisma.agency.findFirst({
    where: {
      transactions: { some: { status: "active" } },
    },
    select: { id: true, name: true },
  });
  if (!agency) {
    console.error("No agency with active transactions found on staging. Seed one first.");
    process.exit(1);
  }
  console.log(`Attaching to agency: ${agency.name} (${agency.id})`);

  const password = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      password,
      role: "director",
      agencyId: agency.id,
      name: TEST_NAME,
    },
    create: {
      email: TEST_EMAIL,
      password,
      role: "director",
      agencyId: agency.id,
      name: TEST_NAME,
    },
    select: { id: true, email: true, role: true, agencyId: true },
  });

  console.log("\nUser ready:");
  console.log(`  id:       ${user.id}`);
  console.log(`  email:    ${user.email}`);
  console.log(`  password: ${TEST_PASSWORD}`);
  console.log(`  role:     ${user.role}`);
  console.log(`  agencyId: ${user.agencyId}`);
  console.log(`\nVisible active transactions for this director:`);
  const txCount = await prisma.propertyTransaction.count({
    where: { agencyId: agency.id, status: "active" },
  });
  console.log(`  ${txCount} active in ${agency.name}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
