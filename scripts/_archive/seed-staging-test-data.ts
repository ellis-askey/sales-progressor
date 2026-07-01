// scripts/seed-staging-test-data.ts
// Seeds staging Supabase with a minimal test fixture for Email Arc testing.
// Idempotent: wipes existing data first, then creates fresh.
//
// IMPORTANT: Only run against STAGING. Set DATABASE_URL + DIRECT_URL to the
// staging connection strings before invoking.
//
// What it creates:
//   - 2 agencies: Hartwell & Partners, Brennan & Co
//   - 4 customer-agency users (1 director + 1 negotiator per agency)
//   - 3 internal users (SP, admin, superadmin)
//   - 4 transactions (2 per agency): 1 "just entered", 1 "halfway through"
//   - All passwords = "password"
//   - No transactions at exchange or completion
//
// Usage (PowerShell):
//   $env:DATABASE_URL = "postgresql://..."
//   $env:DIRECT_URL   = "postgresql://..."
//   npx tsx scripts/seed-staging-test-data.ts

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { execSync } from "node:child_process";

const PASSWORD = hashSync("password", 12);
const prisma = new PrismaClient();

async function main() {
  console.log("=== STAGING SEED ===");
  console.log("Target DB:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"));

  // Safety check — refuse to run against production
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
    throw new Error("ABORT: DATABASE_URL points to production. This script is staging-only.");
  }

  // ── Step 1: Bootstrap milestone definitions via existing prisma/seed.ts ────
  console.log("\n[1/3] Running prisma db seed to populate milestone definitions...");
  execSync("npx prisma db seed", { stdio: "inherit" });

  // ── Step 2: Wipe seed-created users/agencies/txns (keep milestone defs) ────
  console.log("\n[2/3] Wiping bootstrap users/agencies (keeping milestone definitions)...");
  await prisma.milestoneCompletion.deleteMany();
  await prisma.chaseTask.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.transactionNote.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.propertyTransaction.deleteMany();
  await prisma.userVerifiedEmail.deleteMany();
  await prisma.verifiedDomain.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();

  // ── Step 3: Create the fixture Ellis asked for ─────────────────────────────
  console.log("\n[3/3] Creating fresh fixture...");

  const hartwell = await prisma.agency.create({ data: { name: "Hartwell & Partners" } });
  const brennan = await prisma.agency.create({ data: { name: "Brennan & Co" } });
  console.log("  ✓ 2 agencies created");

  // Customer-agency users (director + negotiator each)
  const hartwellDir = await prisma.user.create({
    data: { name: "Alex Morgan", email: "alex@hartwellpartners.co.uk", role: "director", agencyId: hartwell.id, firmName: "Hartwell & Partners", password: PASSWORD },
  });
  const hartwellNeg = await prisma.user.create({
    data: { name: "Emily Chen", email: "emily@hartwellpartners.co.uk", role: "negotiator", agencyId: hartwell.id, firmName: "Hartwell & Partners", password: PASSWORD },
  });
  const brennanDir = await prisma.user.create({
    data: { name: "Sam Brennan", email: "sam@brennanco.co.uk", role: "director", agencyId: brennan.id, firmName: "Brennan & Co", password: PASSWORD },
  });
  const brennanNeg = await prisma.user.create({
    data: { name: "Priya Rao", email: "priya@brennanco.co.uk", role: "negotiator", agencyId: brennan.id, firmName: "Brennan & Co", password: PASSWORD },
  });
  console.log("  ✓ 4 agency users created (director + neg per agency)");

  // Internal users (no agency)
  await prisma.user.create({
    data: { name: "Ellis (SP)", email: "ellis@thesalesprogressor.co.uk", role: "sales_progressor", agencyId: null, password: PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Ellis (Admin)", email: "ellisaskey@googlemail.com", role: "admin", agencyId: null, password: PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Ellis (Superadmin)", email: "ellisaskey+superadmin@googlemail.com", role: "superadmin", agencyId: null, password: PASSWORD },
  });
  console.log("  ✓ 3 internal users created (SP, admin, superadmin)");

  // Load milestone definitions for transaction setup
  const defs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true },
  });
  const idByCode = new Map(defs.map((d) => [d.code, d.id]));
  console.log(`  ✓ ${defs.length} milestone definitions loaded`);

  async function createTransaction(opts: {
    agencyId: string;
    agentUserId: string;
    address: string;
    completeCodes: string[]; // milestone codes to mark complete
    tenure: "freehold" | "leasehold";
    purchaseType: "mortgage" | "cash_buyer";
    purchasePrice: number;
  }) {
    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: opts.address,
        agencyId: opts.agencyId,
        agentUserId: opts.agentUserId,
        status: "active",
        tenure: opts.tenure,
        purchaseType: opts.purchaseType,
        purchasePrice: opts.purchasePrice,
        progressedBy: "agent",
        serviceType: "self_managed",
      },
    });

    // Create a milestone completion row for every definition
    // - in completeCodes → state=complete with completedAt + completedById
    // - else → state=available (UI will show as todo)
    const now = new Date();
    for (const def of defs) {
      const isComplete = opts.completeCodes.includes(def.code);
      await prisma.milestoneCompletion.create({
        data: {
          transactionId: tx.id,
          milestoneDefinitionId: def.id,
          state: isComplete ? "complete" : "available",
          completedAt: isComplete ? now : null,
          completedById: isComplete ? opts.agentUserId : null,
        },
      });
    }
    return tx;
  }

  // Hartwell — 1 just-entered, 1 halfway
  await createTransaction({
    agencyId: hartwell.id,
    agentUserId: hartwellNeg.id,
    address: "42 Briarwood Avenue, Hampton, TW12 1AB",
    completeCodes: [], // just entered
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePrice: 485000,
  });
  await createTransaction({
    agencyId: hartwell.id,
    agentUserId: hartwellNeg.id,
    address: "Flat 7, Riverdale Mansions, Putney, SW15 2EF",
    completeCodes: ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "PM1", "PM2", "PM4", "PM5"], // halfway
    tenure: "leasehold",
    purchaseType: "mortgage",
    purchasePrice: 625000,
  });

  // Brennan — 1 just-entered, 1 halfway
  await createTransaction({
    agencyId: brennan.id,
    agentUserId: brennanNeg.id,
    address: "18 Oakfield Road, Surbiton, KT6 4DH",
    completeCodes: [],
    tenure: "freehold",
    purchaseType: "cash_buyer",
    purchasePrice: 410000,
  });
  await createTransaction({
    agencyId: brennan.id,
    agentUserId: brennanNeg.id,
    address: "5 The Limes, Twickenham, TW1 3QR",
    completeCodes: ["VM1", "VM2", "VM3", "VM4", "VM5", "PM1", "PM2", "PM4"],
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePrice: 555000,
  });

  console.log("  ✓ 4 transactions created (2 per agency)");
  console.log("\n=== DONE ===");
  console.log("Login credentials (all passwords = 'password'):");
  console.log("  Agency users:");
  console.log("    Hartwell director:  alex@hartwellpartners.co.uk");
  console.log("    Hartwell neg:       emily@hartwellpartners.co.uk");
  console.log("    Brennan director:   sam@brennanco.co.uk");
  console.log("    Brennan neg:        priya@brennanco.co.uk");
  console.log("  Internal users:");
  console.log("    Sales progressor:   ellis@thesalesprogressor.co.uk");
  console.log("    Admin:              ellisaskey@googlemail.com");
  console.log("    Superadmin:         ellisaskey+superadmin@googlemail.com");
}

main()
  .catch((e) => {
    console.error("\n❌ FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
