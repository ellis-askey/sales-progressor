// scripts/seed-test-accounts.ts
// Creates the zero-file sales_progressor test account used by the
// Package D / WS2 Playwright suite (PD-5, PD-6).
//
// Safe to run against production — creates one user row, no transactions.
// Idempotent: skips creation if the email already exists.
//
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-accounts.ts

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

const ZERO_PROGRESSOR_EMAIL = "ellis+zero@thesalesprogressor.co.uk";
const ZERO_PROGRESSOR_PASSWORD = "password";

async function main() {
  console.log("Seeding test accounts...");

  // ── Zero-file sales_progressor ────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: ZERO_PROGRESSOR_EMAIL } });

  if (existing) {
    console.log(`  SKIP: ${ZERO_PROGRESSOR_EMAIL} already exists (id: ${existing.id})`);
  } else {
    const user = await prisma.user.create({
      data: {
        name: "Zero Progressor",
        email: ZERO_PROGRESSOR_EMAIL,
        password: hashSync(ZERO_PROGRESSOR_PASSWORD, 12),
        role: "sales_progressor",
        agencyId: null,
        firmName: null,
      },
    });
    console.log(`  CREATED: ${user.email} (id: ${user.id}, role: ${user.role})`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
