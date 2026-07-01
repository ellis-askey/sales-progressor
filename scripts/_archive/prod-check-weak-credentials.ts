// Prod-runbook check — confirm no production account carries a known
// weak password AND no production account matches the staging test
// emails.
//
// Two checks, both must return zero hits:
//   (a) No test-account emails exist on prod.
//   (b) No prod account's hash bcrypt-compares true against the known
//       weak / rotated passwords from the test-accounts history.
//
// Refuses to run if DATABASE_URL is NOT the production project. Reads
// only — never writes. Exits non-zero on any finding so it can be a
// hard gate in CI / the runbook script chain.
//
// Run:
//   npx -y dotenv -e .env.production --override -- npx ts-node \
//     --project tsconfig.scripts.json scripts/prod-check-weak-credentials.ts
//
// Add to docs/active/relist-feature/prod-release-runbook.md Step 8.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";

// Anything previously assigned to a test seed on staging belongs here.
// Includes both the pre-rotation defaults and the rotated values, since
// any of these landing on prod is a finding.
const KNOWN_WEAK_PASSWORDS = [
  // Pre-rotation defaults
  "password",
  "Hartwell2024!",
  "Password123!",
  "test1234",
  "ellis123",
  // Post-rotation 2026-06-04 (FIRST rotation of the day).
  // These were committed to a PUBLIC GitHub repo in 7628d83 before the
  // public-repo finding landed. Treated as compromised; a second
  // rotation that day invalidated them on staging. They live here
  // permanently so the prod gate catches them if anyone ever
  // re-applies them.
  "Sy6BzWF7YKZJ1MwCMb3Vit8I2og8M7Uy",
  "6-dwN72_5McVTb64wbIKmp3hIb-bALWF",
  "BjKcA9LOdqYMRpToNRB2WDKT_IJatuKW",
  "-1xgyS74w0hUifgpsvJXzxt9DxM8XSNg",
  // INVARIANT (added 2026-06-04 after the public-repo finding):
  // CURRENT, ACTIVE staging passwords must NEVER appear in this list.
  // The whole point of the list is to detect compromise — putting active
  // values here would itself BE the compromise. Add a value here only
  // after it has been retired by a fresh rotation. The active values
  // live ONLY in Ellis's password manager.
];

// Emails that are clearly seed/test accounts. None of these should exist
// in prod. Note: ellisaskey@googlemail.com IS the founder's real email,
// so we do NOT flag it here — but its prod password (if it exists on
// prod) is still subject to check (b).
const TEST_EMAILS = [
  "emily@hartwellpartners.co.uk",
  "alex@hartwellpartners.co.uk",
  "sarah@hartwellpartners.co.uk",
  "james@hartwellpartners.co.uk",
];

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes(PROD_PROJECT_ID)) {
    console.error("ABORT: DATABASE_URL is NOT the production project. This script is prod-only.");
    console.error(`  expected project id: ${PROD_PROJECT_ID}`);
    console.error(`  got DATABASE_URL host: ${dbUrl.replace(/.*@/, "").split("/")[0]}`);
    process.exit(2);
  }
  console.log(`DATABASE_URL host: ${dbUrl.replace(/.*@/, "").split("/")[0]}`);
  console.log("");

  // ── Check (a): no test-account emails on prod ─────────────────────
  console.log("── Check (a): no staging test-account emails on prod ────────");
  const testEmailHits = await prisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true, email: true, role: true },
  });
  if (testEmailHits.length === 0) {
    console.log("  PASS: 0 test-account emails on prod.");
  } else {
    console.log(`  FAIL: ${testEmailHits.length} test-account email(s) found on prod:`);
    for (const u of testEmailHits) console.log(`    - ${u.email}  (id=${u.id}, role=${u.role})`);
  }

  // ── Check (b): no prod account on a known weak password ───────────
  console.log("");
  console.log("── Check (b): no prod account on a known weak/rotated password ────────");
  console.log(`  Comparing every prod User.password hash against ${KNOWN_WEAK_PASSWORDS.length} known weak values.`);
  const users = await prisma.user.findMany({
    where: { password: { not: null } },
    select: { id: true, email: true, role: true, password: true },
  });
  console.log(`  Users with a password set: ${users.length}`);
  const weakHits: { email: string; role: string; matched: string }[] = [];
  for (const u of users) {
    if (!u.password) continue;
    for (const pw of KNOWN_WEAK_PASSWORDS) {
      try {
        if (await bcrypt.compare(pw, u.password)) {
          weakHits.push({ email: u.email, role: u.role, matched: pw });
          break;
        }
      } catch {
        // malformed hash — skip silently
      }
    }
  }
  if (weakHits.length === 0) {
    console.log("  PASS: 0 prod accounts on a known weak password.");
  } else {
    console.log(`  FAIL: ${weakHits.length} prod account(s) on a known weak password:`);
    for (const h of weakHits) console.log(`    - ${h.email}  (role=${h.role})  matched: ${h.matched}`);
  }

  await prisma.$disconnect();

  const failed = testEmailHits.length > 0 || weakHits.length > 0;
  if (failed) {
    console.log("");
    console.log("OVERALL: FAIL — rotate the listed accounts before proceeding with deploy.");
    process.exit(1);
  } else {
    console.log("");
    console.log("OVERALL: PASS — prod has no test emails and no known weak passwords.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
