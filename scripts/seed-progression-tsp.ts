/**
 * Seed progression business #1 — The Sales Progressor (the platform operator).
 *
 * Idempotent: creates the single isTsp row once, then leaves it untouched. This
 * row is the fallback identity for every transaction whose progressionBusinessId
 * is null (TSP) — see lib/progression/business.ts. Kept in sync with the Phase 1
 * migration's INSERT and prisma/seed.ts.
 *
 * Needed on staging/local because those sync the schema via `prisma db push`,
 * which skips raw migrations (docs/active/progression-businesses/). Production
 * gets the row from the migration itself. Safe to run against any environment.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-progression-tsp.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TSP_ID = "progression_business_tsp";
const TSP_IDENTITY = {
  name: "The Sales Progressor",
  contactWhatsapp: "+447508862929",
  senderEmail: "ellis@thesalesprogressor.co.uk",
  senderDomain: "thesalesprogressor.co.uk",
};

async function main() {
  const existing = await prisma.progressionBusiness.findFirst({ where: { isTsp: true } });
  if (existing) {
    console.log(`TSP ProgressionBusiness already present (${existing.id}) — nothing to do.`);
    return;
  }
  const created = await prisma.progressionBusiness.create({
    data: { id: TSP_ID, isTsp: true, ...TSP_IDENTITY },
  });
  console.log(`Created TSP ProgressionBusiness ${created.id}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
