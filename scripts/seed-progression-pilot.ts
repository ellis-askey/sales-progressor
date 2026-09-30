/**
 * Seed a PILOT progression business + owner for local/staging proof-seeing of
 * the progression-businesses feature (docs/active/progression-businesses/,
 * Phase 4). Creates "Sarah's Progression Co" and an owner login so you can log
 * in as the progression-business owner and use the /agent/clients screen.
 *
 * Idempotent (skips/updates by natural key). Refuses to run against production.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-progression-pilot.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

const PROD_PROJECT_REF = "gmkfustgwipgihpmpjpr"; // production Supabase project
const PILOT_BUSINESS_NAME = "Sarah's Progression Co";
const OWNER_EMAIL = "sarah@sarahprogression.co.uk";
const OWNER_PASSWORD = "Pilot2026!";

async function main() {
  if ((process.env.DATABASE_URL ?? "").includes(PROD_PROJECT_REF)) {
    throw new Error("Refusing to run the pilot seed against production.");
  }

  let business = await prisma.progressionBusiness.findFirst({ where: { name: PILOT_BUSINESS_NAME } });
  if (!business) {
    business = await prisma.progressionBusiness.create({
      data: { name: PILOT_BUSINESS_NAME, isTsp: false },
    });
    console.log(`Created pilot progression business ${business.id}`);
  } else {
    console.log(`Pilot progression business already present (${business.id})`);
  }

  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (existing) {
    await prisma.user.update({
      where: { email: OWNER_EMAIL },
      data: {
        role: "sales_progressor",
        agencyId: null,
        progressionBusinessId: business.id,
        progressionBusinessRole: "owner",
      },
    });
    console.log(`Updated pilot owner ${existing.id} (${OWNER_EMAIL})`);
  } else {
    const owner = await prisma.user.create({
      data: {
        name: "Sarah Owner",
        email: OWNER_EMAIL,
        password: hashSync(OWNER_PASSWORD, 12),
        role: "sales_progressor",
        agencyId: null,
        progressionBusinessId: business.id,
        progressionBusinessRole: "owner",
      },
    });
    console.log(`Created pilot owner ${owner.id} (${OWNER_EMAIL} / ${OWNER_PASSWORD})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
