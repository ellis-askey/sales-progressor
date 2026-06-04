// Idempotently ensure the dedicated Playwright test account exists on
// staging with a strong, password-manager-supplied password.
//
// WHY THIS SCRIPT EXISTS:
//   The visual verification suite (scripts/verify-8-playwright.ts) used
//   to log in as emily@hartwellpartners.co.uk — a seeded fixture also
//   used by manual QA and by docs/test-accounts.md. That coupling meant
//   any of the following could break the suite mid-run, and DID on
//   2026-06-04:
//     - The rotation script rewriting emily's password.
//     - A re-seed wiping it.
//     - Manual QA changing it from the password manager.
//     - The auth rate limiter locking out the suite's IP and the
//       resulting symptom (HTTP 200 + null) reading as "credentials
//       rewritten" rather than "rate-limited".
//   A verification tool must never mutate the credentials it
//   authenticates with. The fix is a dedicated, rotation-excluded
//   account whose password lives in the password manager and reaches
//   the script via env.
//
// CONTRACT:
//   - Account email is PLAYWRIGHT_TEST_EMAIL (default
//     "playwright-bot@hartwellpartners.co.uk"). The email is also added
//     to a BLOCKLIST in scripts/rotate-staging-test-passwords.ts so the
//     rotation script will abort if anyone ever tries to include it.
//   - Password is PLAYWRIGHT_TEST_PASSWORD (required, no default).
//     Must be ≥24 chars and must not appear in KNOWN_WEAK_PASSWORDS
//     (the same list scripts/prod-check-weak-credentials.ts gates prod
//     on). This is the same entropy floor the rotation script writes.
//   - Role is director on the Hartwell & Partners agency — matches what
//     the previous verification user (emily) had access to, so existing
//     test fixtures (TX_ID_WITHDRAWN / TX_ID_ACTIVE) remain reachable.
//   - Staging-only. Aborts if DATABASE_URL points at production.
//   - Idempotent. Safe to run repeatedly; no-op if the account already
//     has the supplied password.
//
// Run:
//   npx -y dotenv -e .env --override -- npx ts-node \
//     --project tsconfig.scripts.json scripts/ensure-playwright-test-user.ts

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const DEFAULT_EMAIL = "playwright-bot@hartwellpartners.co.uk";
const AGENCY_NAME = "Hartwell & Partners";
const MIN_PASSWORD_LENGTH = 24;

// Mirror of scripts/prod-check-weak-credentials.ts. Importing across
// scripts would couple two independent maintenance paths; the
// duplicated list is short and the prod-check file is the canonical
// one. If you rotate a staging password, append the previous value
// THERE first, then mirror it here only if you want this script to
// reject it too. (We mirror so the ensure script never accidentally
// re-applies a known-burned value.)
const KNOWN_WEAK_PASSWORDS = new Set([
  "password",
  "Hartwell2024!",
  "Password123!",
  "test1234",
  "ellis123",
  "Sy6BzWF7YKZJ1MwCMb3Vit8I2og8M7Uy",
  "6-dwN72_5McVTb64wbIKmp3hIb-bALWF",
  "BjKcA9LOdqYMRpToNRB2WDKT_IJatuKW",
  "-1xgyS74w0hUifgpsvJXzxt9DxM8XSNg",
]);

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) {
    console.error("ABORT: DATABASE_URL not set.");
    process.exit(2);
  }
  if (dbUrl.includes(PROD_PROJECT_ID)) {
    console.error("ABORT: DATABASE_URL points at the production project. This script is staging-only.");
    process.exit(2);
  }

  const email = (process.env.PLAYWRIGHT_TEST_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "";

  if (!password) {
    console.error("ABORT: PLAYWRIGHT_TEST_PASSWORD env not set. Supply from Ellis's password manager entry");
    console.error("       'Sales Progressor — staging test accounts → playwright-bot'.");
    process.exit(2);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`ABORT: PLAYWRIGHT_TEST_PASSWORD is ${password.length} chars; need ≥${MIN_PASSWORD_LENGTH}.`);
    process.exit(2);
  }
  if (KNOWN_WEAK_PASSWORDS.has(password)) {
    console.error("ABORT: PLAYWRIGHT_TEST_PASSWORD matches a value in KNOWN_WEAK_PASSWORDS (rotated/leaked).");
    console.error("       Generate a fresh value and update the password manager entry.");
    process.exit(2);
  }

  console.log(`DATABASE_URL host: ${dbUrl.replace(/.*@/, "").split("/")[0]}`);
  console.log(`Target account:    ${email}`);
  console.log("");

  const agency = await prisma.agency.findFirst({
    where: { name: AGENCY_NAME },
    select: { id: true, name: true },
  });
  if (!agency) {
    console.error(`ABORT: Agency "${AGENCY_NAME}" not found on this database. Seed it first (npm run db:seed).`);
    process.exit(3);
  }

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, role: true, agencyId: true, password: true },
  });

  const hash = await bcrypt.hash(password, 10);

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        name: "Playwright Bot",
        email,
        role: UserRole.director,
        agencyId: agency.id,
        firmName: AGENCY_NAME,
        password: hash,
      },
      select: { id: true, email: true, role: true },
    });
    console.log(`CREATED  ${created.email}  role=${created.role}  agency=${agency.name}`);
  } else {
    // Update only what's drifted. Compare the supplied password against
    // the stored hash; if it already matches, leave the row alone so
    // updatedAt doesn't churn.
    const passwordMatches = existing.password
      ? await bcrypt.compare(password, existing.password)
      : false;
    const needsRoleFix = existing.role !== UserRole.director;
    const needsAgencyFix = existing.agencyId !== agency.id;

    if (passwordMatches && !needsRoleFix && !needsAgencyFix) {
      console.log(`UNCHANGED  ${existing.email}  role=${existing.role}  agency=${agency.name}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: passwordMatches ? undefined : hash,
          role: needsRoleFix ? UserRole.director : undefined,
          agencyId: needsAgencyFix ? agency.id : undefined,
          firmName: AGENCY_NAME,
        },
      });
      const parts: string[] = [];
      if (!passwordMatches) parts.push("password");
      if (needsRoleFix) parts.push("role");
      if (needsAgencyFix) parts.push("agencyId");
      console.log(`UPDATED  ${existing.email}  fields=[${parts.join(", ")}]`);
    }
  }

  // Round-trip verify so a hash-corruption bug can't pass silently.
  const reread = await prisma.user.findFirst({ where: { email }, select: { password: true } });
  const roundTrip = reread?.password ? await bcrypt.compare(password, reread.password) : false;
  if (!roundTrip) {
    console.error("ABORT: round-trip bcrypt compare failed. Password not usable for login.");
    process.exit(4);
  }
  console.log("Round-trip bcrypt compare: OK");
  console.log("");
  console.log("This account is BLOCKED from scripts/rotate-staging-test-passwords.ts");
  console.log("by an explicit blocklist. Do not add it to TEST_ACCOUNT_EMAILS there.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
