// scripts/seed-completions.ts
// Adds a test agent user + 5 exchanged transactions to test the Completions page.
// Does NOT wipe existing data — safe to run alongside the main seed.

import { PrismaClient, UserRole } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();
const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0);

function D(offsetDays: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

async function main() {
  console.log("🌱 Seeding completions test data...");

  // ── Find agency ────────────────────────────────────────────────────────────
  const agency = await prisma.agency.findFirst({ where: { name: "Hartwell & Partners" } });
  if (!agency) throw new Error("Agency 'Hartwell & Partners' not found — run the main seed first (npm run db:seed)");

  // ── Test user ──────────────────────────────────────────────────────────────
  const email = "test.completions@hartwellpartners.co.uk";
  const password = "Test1234!";

  let testUser = await prisma.user.findUnique({ where: { email } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "Alex Morgan",
        email,
        password: hashSync(password, 12),
        role: UserRole.negotiator,
        agencyId: agency.id,
        firmName: "Hartwell & Partners",
      },
    });
    console.log(`✓ Created test user: ${email} / ${password}`);
  } else {
    console.log(`✓ Test user already exists: ${email}`);
  }

  // ── VM12 milestone def ─────────────────────────────────────────────────────
  const vm12 = await prisma.milestoneDefinition.findFirst({ where: { code: "VM12" } });
  if (!vm12) throw new Error("VM12 milestone definition not found — run the main seed first");

  // ── Test transactions ──────────────────────────────────────────────────────
  const files = [
    {
      address: "Flat 3, 12 Brunswick Square, Bristol, BS2 8RD",
      price: 32500000, // pence — £325,000
      completionDate: D(-4), // overdue
      vendors: ["Marcus & Diana Webb"],
      purchasers: ["Tom Allsopp"],
    },
    {
      address: "15 Caledonian Road, Bath, BA1 2HQ",
      price: 47500000, // £475,000
      completionDate: D(3), // this week
      vendors: ["Priya Kapoor"],
      purchasers: ["Ben & Lydia Hartley"],
    },
    {
      address: "82 Lansdown Crescent, Bristol, BS8 3EZ",
      price: 68000000, // £680,000
      completionDate: D(9), // next week
      vendors: ["Andrew & Claire Sutton"],
      purchasers: ["Jess Okonkwo"],
    },
    {
      address: "29 Marlborough Terrace, Bath, BA2 6FT",
      price: 51000000, // £510,000
      completionDate: D(21), // later
      vendors: ["Sam & Ruth Deacon"],
      purchasers: ["Oliver Park"],
    },
    {
      address: "7 Victoria Gardens, Clifton, Bristol, BS8 4AW",
      price: 89000000, // £890,000
      completionDate: null, // no date
      vendors: ["Harriet Blake"],
      purchasers: ["Nina & Carlos Reyes"],
    },
  ];

  for (const f of files) {
    // Skip if already exists (idempotent re-runs)
    const exists = await prisma.propertyTransaction.findFirst({
      where: { propertyAddress: f.address },
    });
    if (exists) {
      console.log(`  ↷ Already exists: ${f.address}`);
      continue;
    }

    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: f.address,
        purchasePrice: f.price,
        completionDate: f.completionDate,
        status: "active",
        agentUserId: testUser.id,
        agencyId: agency.id,
        tenure: "freehold",
        purchaseType: "mortgage",
      },
    });

    // Contacts
    for (const name of f.vendors) {
      await prisma.contact.create({
        data: { propertyTransactionId: tx.id, name, roleType: "vendor" },
      });
    }
    for (const name of f.purchasers) {
      await prisma.contact.create({
        data: { propertyTransactionId: tx.id, name, roleType: "purchaser" },
      });
    }

    // VM12 exchange milestone completion
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: tx.id,
        milestoneDefinitionId: vm12.id,
        state: "complete",
        completedAt: D(-7),
        completedById: testUser.id,
        summaryText: "Alex Morgan confirmed that contracts have successfully exchanged",
      },
    });

    const dateLabel = f.completionDate
      ? f.completionDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "no date";
    console.log(`  ✓ ${f.address} — completing ${dateLabel}`);
  }

  console.log("\n✅ Done. Log in as:");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log("   Then visit /agent/completions");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
