/**
 * Deterministic isolation fixture for the progression-businesses feature
 * (docs/active/progression-businesses/, Phase 8). Builds the 3-business /
 * 7-transaction matrix from the plan so the isolation rules can be exercised
 * manually and by e2e/progression-isolation.spec.ts.
 *
 * Businesses: TSP (existing isTsp row), Sarah, Other.
 * Agencies:   Donna, James, Unrelated, Other-agency.
 * Users:      sarah_owner, sarah_prog2, donna, james, tsp_prog, other_prog
 *             (+ tsp_admin is assumed to already exist as a real admin).
 * Txns (address suffix " - PBFIX"):
 *   T1 Donna self-managed | T2 Donna->Sarah | T3 Donna->TSP
 *   T4 James->Sarah       | T5 James self    | T6 Unrelated->TSP | T7 Other-business
 *
 * Expected access (asserted by the e2e spec):
 *   sarah_owner/sarah_prog2 -> T2,T4 only     donna -> T1,T2,T3     james -> T4,T5
 *   tsp_prog -> T3,T6        other_prog -> T7  (tsp_admin -> all)
 *
 * Idempotent (natural keys). Refuses production. Run:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-progression-fixture.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();
const PROD_REF = "gmkfustgwipgihpmpjpr";
const PW = hashSync("Pilot2026!", 12);
const TAG = " - PBFIX";

async function agency(name: string) {
  const existing = await prisma.agency.findFirst({ where: { name } });
  return existing ?? prisma.agency.create({ data: { name } });
}

async function business(name: string) {
  const existing = await prisma.progressionBusiness.findFirst({ where: { name } });
  return existing ?? prisma.progressionBusiness.create({ data: { name, isTsp: false } });
}

async function user(email: string, data: Record<string, unknown>) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return prisma.user.update({ where: { email }, data });
  return prisma.user.create({ data: { email, password: PW, ...data } as never });
}

async function txn(address: string, data: Record<string, unknown>) {
  const addr = `${address}${TAG}`;
  const existing = await prisma.propertyTransaction.findFirst({ where: { propertyAddress: addr } });
  if (existing) return prisma.propertyTransaction.update({ where: { id: existing.id }, data });
  return prisma.propertyTransaction.create({ data: { propertyAddress: addr, ...data } as never });
}

async function link(progressionBusinessId: string, agencyId: string) {
  await prisma.progressionBusinessClient.upsert({
    where: { progressionBusinessId_agencyId: { progressionBusinessId, agencyId } },
    update: {},
    create: { progressionBusinessId, agencyId },
  });
}

async function main() {
  if ((process.env.DATABASE_URL ?? "").includes(PROD_REF)) {
    throw new Error("Refusing to run the isolation fixture against production.");
  }

  const tsp = await prisma.progressionBusiness.findFirst({ where: { isTsp: true } });
  if (!tsp) throw new Error("No TSP ProgressionBusiness row - run seed-progression-tsp first.");
  const sarahBiz = await business("Sarah's Progression Co");
  const otherBiz = await business("Other Progression Co");

  const donnaAgency = await agency("Donna Smith @ eXp (PBFIX)");
  const jamesAgency = await agency("James Okonkwo @ eXp (PBFIX)");
  const unrelatedAgency = await agency("Unrelated Agency (PBFIX)");
  const otherAgency = await agency("Other-biz client agency (PBFIX)");

  const sarahOwner = await user("sarah@sarahprogression.co.uk", {
    name: "Sarah Owner", role: "sales_progressor", agencyId: null,
    progressionBusinessId: sarahBiz.id, progressionBusinessRole: "owner",
  });
  const sarahProg2 = await user("kim@sarahprogression.co.uk", {
    name: "Kim (Sarah's team)", role: "sales_progressor", agencyId: null,
    progressionBusinessId: sarahBiz.id, progressionBusinessRole: "progressor",
  });
  const donna = await user("donna@exp-pbfix.co.uk", { name: "Donna Smith", role: "director", agencyId: donnaAgency.id });
  const james = await user("james@exp-pbfix.co.uk", { name: "James Okonkwo", role: "director", agencyId: jamesAgency.id });
  const tspProg = await user("tspprog@thesalesprogressor.co.uk", { name: "TSP Progressor", role: "sales_progressor", agencyId: null, progressionBusinessId: null });
  const otherProg = await user("owner@otherprogression.co.uk", {
    name: "Other Owner", role: "sales_progressor", agencyId: null,
    progressionBusinessId: otherBiz.id, progressionBusinessRole: "owner",
  });

  await link(sarahBiz.id, donnaAgency.id);
  await link(sarahBiz.id, jamesAgency.id);

  const out = { serviceType: "outsourced", progressedBy: "progressor" } as const;
  const self = { serviceType: "self_managed", progressedBy: "agent" } as const;

  await txn("1 Donna Self St", { agencyId: donnaAgency.id, agentUserId: donna.id, progressionBusinessId: null, ...self });
  await txn("2 Donna To Sarah St", { agencyId: donnaAgency.id, agentUserId: donna.id, progressionBusinessId: sarahBiz.id, assignedUserId: sarahOwner.id, assignedAt: new Date(2026, 0, 1), ...out });
  await txn("3 Donna To TSP St", { agencyId: donnaAgency.id, agentUserId: donna.id, progressionBusinessId: null, assignedUserId: tspProg.id, assignedAt: new Date(2026, 0, 1), ...out });
  await txn("4 James To Sarah St", { agencyId: jamesAgency.id, agentUserId: james.id, progressionBusinessId: sarahBiz.id, assignedUserId: sarahProg2.id, assignedAt: new Date(2026, 0, 1), ...out });
  await txn("5 James Self St", { agencyId: jamesAgency.id, agentUserId: james.id, progressionBusinessId: null, ...self });
  await txn("6 Unrelated To TSP St", { agencyId: unrelatedAgency.id, progressionBusinessId: null, assignedUserId: tspProg.id, assignedAt: new Date(2026, 0, 1), ...out });
  await txn("7 Other Business St", { agencyId: otherAgency.id, progressionBusinessId: otherBiz.id, assignedUserId: otherProg.id, assignedAt: new Date(2026, 0, 1), ...out });

  console.log("Progression isolation fixture seeded:");
  console.log(`  Sarah's business ${sarahBiz.id} (owner sarah@sarahprogression.co.uk, member kim@sarahprogression.co.uk)`);
  console.log(`  Other business   ${otherBiz.id} (owner owner@otherprogression.co.uk)`);
  console.log(`  Agencies: Donna=${donnaAgency.id} James=${jamesAgency.id} Unrelated=${unrelatedAgency.id} Other=${otherAgency.id}`);
  console.log("  7 transactions tagged ' - PBFIX'. All fixture logins use password Pilot2026!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
