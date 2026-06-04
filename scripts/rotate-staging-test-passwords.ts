// Rotate every staging test account's password to a strong generated value.
//
// Triggered by a security finding (2026-06-04): the staging deploy is
// publicly reachable, may contain real-looking client data, and at least
// one director account had the literal password "password". This script
// rotates every test account to a 32-character base64url password
// generated from crypto.randomBytes(24), bcrypts it, writes it to the
// User table, and prints the new credentials to stdout for hand-off
// into test-accounts.md.
//
// SAFETY:
//   - Hard-coded to operate on the STAGING DATABASE_URL only — refuses
//     to run if DATABASE_URL points at the production project ID
//     (gmkfustgwipgihpmpjpr).
//   - Refuses to run on emails that aren't in the explicit test-account
//     allowlist below. Real users (e.g. ellis@thesalesprogressor.co.uk
//     if it is a real account, not a seeded one) are NOT touched.
//
// Run: npx -y dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/rotate-staging-test-passwords.ts

import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Anyone in this list is a known seed/test account on staging. Real
// accounts are not in this list and stay untouched.
const TEST_ACCOUNT_EMAILS = [
  "ellisaskey@googlemail.com",           // admin seed
  "ellis@thesalesprogressor.co.uk",      // sales_progressor seed
  "sarah@hartwellpartners.co.uk",        // (may not exist on staging — handled)
  "james@hartwellpartners.co.uk",        // (may not exist on staging — handled)
  "emily@hartwellpartners.co.uk",        // director seed
  "alex@hartwellpartners.co.uk",         // director seed
];

// HARD BLOCKLIST — never rotate these emails, even if a future
// maintainer adds them to TEST_ACCOUNT_EMAILS above. The Playwright
// verification suite logs in as this account and the password lives in
// the password manager (supplied via PLAYWRIGHT_TEST_PASSWORD env to
// scripts/ensure-playwright-test-user.ts). If this script rewrote it,
// the verification suite would fail on the next run with no recovery
// path short of regenerating + re-handing-off a new password — exactly
// the failure mode that prompted creating the dedicated account on
// 2026-06-04.
const ROTATION_BLOCKLIST = new Set<string>([
  "playwright-bot@hartwellpartners.co.uk",
]);

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";

function generateStrongPassword(): string {
  // 24 random bytes → 32 base64url characters. ~192 bits of entropy.
  return randomBytes(24).toString("base64url");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.includes(PROD_PROJECT_ID)) {
    console.error("ABORT: DATABASE_URL points at the production project. This script is staging-only.");
    process.exit(2);
  }
  if (!dbUrl) {
    console.error("ABORT: DATABASE_URL not set.");
    process.exit(2);
  }
  // Sanity probe — staging Supabase project should be the only one.
  console.log(`DATABASE_URL host: ${dbUrl.replace(/.*@/, "").split("/")[0]}`);
  console.log("");

  // Defence-in-depth: if a maintainer accidentally adds a blocked
  // email to TEST_ACCOUNT_EMAILS, abort BEFORE writing anything. We
  // don't silently skip — the act of someone putting it on the
  // rotation list is itself the bug we want to surface.
  for (const email of TEST_ACCOUNT_EMAILS) {
    if (ROTATION_BLOCKLIST.has(email)) {
      console.error(`ABORT: ${email} is on ROTATION_BLOCKLIST but appeared in TEST_ACCOUNT_EMAILS.`);
      console.error("       Remove it from TEST_ACCOUNT_EMAILS. The Playwright suite owns this account.");
      process.exit(2);
    }
  }

  const rotations: { email: string; newPassword: string; role: string }[] = [];
  const skipped: string[] = [];

  for (const email of TEST_ACCOUNT_EMAILS) {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, role: true, password: true },
    });
    if (!user) {
      skipped.push(`${email} (not in DB)`);
      continue;
    }
    if (!user.password) {
      skipped.push(`${email} (no existing password — passwordless account, skipping)`);
      continue;
    }
    const newPassword = generateStrongPassword();
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });
    // Verify the round trip — the hash must compare true to the plaintext.
    const verify = await bcrypt.compare(newPassword, hash);
    if (!verify) {
      console.error(`ABORT: bcrypt round-trip failed for ${email}.`);
      process.exit(3);
    }
    rotations.push({ email, newPassword, role: user.role });
  }

  console.log("── ROTATED ─────────────────────────────────────────────────");
  console.log("| Email                                | Role                | New password                        |");
  console.log("|--------------------------------------|---------------------|-------------------------------------|");
  for (const r of rotations) {
    console.log(`| ${r.email.padEnd(36)} | ${r.role.padEnd(19)} | ${r.newPassword.padEnd(35)} |`);
  }
  if (skipped.length > 0) {
    console.log("");
    console.log("── SKIPPED ─────────────────────────────────────────────────");
    for (const s of skipped) console.log(`  ${s}`);
  }
  console.log("");
  console.log("Done.");
  console.log("");
  console.log("⚠ The new passwords above MUST NOT be committed to the repo (public on GitHub).");
  console.log("  Paste them into Ellis's password manager entry 'Sales Progressor — staging test accounts'.");
  console.log("  When the NEXT rotation runs, append the values above to KNOWN_WEAK_PASSWORDS in");
  console.log("  scripts/prod-check-weak-credentials.ts so the prod gate keeps catching them.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
