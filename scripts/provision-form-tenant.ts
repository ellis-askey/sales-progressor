// Provision a Boardwalk Forms tenant + owner account with a one-time
// temporary password. The password is printed ONCE to the console and stored
// only as a bcrypt hash; the account is flagged mustChangePassword so the
// user is forced to choose their own on first sign-in.
//
// Usage (runs against the DB in DATABASE_URL — staging by default):
//   npx ts-node --transpile-only --compiler-options "{\"module\":\"CommonJS\",\"moduleResolution\":\"node\",\"esModuleInterop\":true}" \
//     scripts/provision-form-tenant.ts -- \
//     --tenant boardwalk --tenant-name "Boardwalk" --email agent@boardwalk.co.uk --name "Agent Name"
//
// To provision on PROD, set PROVISION_ON_PROD=yes explicitly — the script
// refuses the prod project id otherwise.
//
// Idempotent-ish: re-running with the same email resets that user's password
// to a fresh temporary one (useful if credentials are lost before first login).

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import crypto from "crypto";

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function tempPassword(): string {
  // 3 words-ish chunks of base32 — easy to read out over the phone, ~60 bits.
  const raw = crypto.randomBytes(12).toString("base64url").replace(/[-_]/g, "x");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`.toLowerCase();
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes(PROD_PROJECT_ID) && process.env.PROVISION_ON_PROD !== "yes") {
    throw new Error("ABORT: DATABASE_URL is PROD. Set PROVISION_ON_PROD=yes to provision on production deliberately.");
  }

  const slug = (arg("tenant") ?? "boardwalk").toLowerCase();
  const tenantName = arg("tenant-name") ?? "Boardwalk";
  const email = arg("email")?.toLowerCase().trim();
  const userName = arg("name") ?? "Boardwalk";
  if (!email || !/@/.test(email)) {
    throw new Error("Pass --email <address> for the account to provision.");
  }

  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.formTenant.upsert({
      where: { slug },
      create: { slug, name: tenantName },
      update: {},
    });
    console.log(`Tenant ready: ${tenant.name} (${tenant.slug}) [${tenant.id}]`);

    const password = tempPassword();
    const passwordHash = await hash(password, 12);

    const existing = await prisma.formTenantUser.findFirst({
      where: { tenantId: tenant.id, email },
    });
    if (existing) {
      await prisma.formTenantUser.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });
      console.log(`Existing user ${email} — password RESET to a new temporary one.`);
    } else {
      await prisma.formTenantUser.create({
        data: {
          tenantId: tenant.id,
          email,
          name: userName,
          passwordHash,
          role: "owner",
          mustChangePassword: true,
        },
      });
      console.log(`Created owner account for ${email}.`);
    }

    console.log("");
    console.log("────────────────────────────────────────────");
    console.log("  Share these once, over a secure channel:");
    console.log(`  Sign-in:   /boardwalk  (login page)`);
    console.log(`  Email:     ${email}`);
    console.log(`  Temp pass: ${password}`);
    console.log("  They'll be asked to choose their own password");
    console.log("  the first time they sign in.");
    console.log("────────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
