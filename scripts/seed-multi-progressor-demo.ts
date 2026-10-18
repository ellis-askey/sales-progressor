/**
 * Multi-progressor demo seed (staging only). Sets up the "one agency, several
 * progressors" scenario so the Phase 1-3 UI can be walked manually:
 *
 *   Agency:      Knights Residential (MP-DEMO)  — director login
 *   Progressors: Key To Completion (MP-DEMO)    — owner "Jo"      [connected, £300/sale]
 *                Moves By Wright (MP-DEMO)       — owner "Annalise"[connected, £350/sale]
 *                Hartwell & Partners (MP-DEMO)   — owner "Marcus"  [PENDING request to Knights, £400]
 *
 * What each surface demonstrates:
 *   - Phase 2 (connect + accept/withdraw):
 *       · Jo/Annalise/Hartwell → Clients → "Add a client" (two routes: new / connect existing)
 *       · Hartwell → Clients → "Requests sent" row (pending to Knights) + Withdraw  (2c)
 *       · Knights director → Hub → "Hartwell & Partners would like to progress…" Accept/Decline (2b)
 *   - Phase 3 (per-sale picker + handover): Knights already has 2 connected progressors
 *       · Knights director → New sale → "Send to us" → "Which progressor handles this sale?" (3a)
 *       · Knights director → the self-managed file → "Managed by" badge → handover picker (3b)
 *
 * All logins share the password below. Everything is tagged "(MP-DEMO)" and
 * emails end "-mpdemo.co.uk" so it's trivially identifiable and removable.
 * Idempotent (natural keys). Refuses to run against production.
 *
 * Run:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-multi-progressor-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();
const PROD_REF = "gmkfustgwipgihpmpjpr";
const PASSWORD = "Demo1234!";
const PW = hashSync(PASSWORD, 12);

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

async function link(progressionBusinessId: string, agencyId: string, feePence: number) {
  const feeModel = { type: "flat", pence: feePence };
  await prisma.progressionBusinessClient.upsert({
    where: { progressionBusinessId_agencyId: { progressionBusinessId, agencyId } },
    update: { removedAt: null, feeModel },
    create: { progressionBusinessId, agencyId, feeModel },
  });
}

async function pendingRequest(progressionBusinessId: string, agencyId: string, requestedByUserId: string, feePence: number) {
  const existing = await prisma.progressionConnectionRequest.findFirst({
    where: { progressionBusinessId, agencyId, status: "pending" },
  });
  if (existing) return existing;
  return prisma.progressionConnectionRequest.create({
    data: { progressionBusinessId, agencyId, requestedByUserId, feeModel: { type: "flat", pence: feePence } },
  });
}

async function selfManagedFile(address: string, agencyId: string, agentUserId: string) {
  const existing = await prisma.propertyTransaction.findFirst({ where: { propertyAddress: address } });
  const data = {
    agencyId,
    agentUserId,
    progressionBusinessId: null,
    serviceType: "self_managed",
    progressedBy: "agent",
    status: "active",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePrice: 42500000, // £425,000 (pence)
  };
  if (existing) return prisma.propertyTransaction.update({ where: { id: existing.id }, data: data as never });
  return prisma.propertyTransaction.create({ data: { propertyAddress: address, ...data } as never });
}

async function main() {
  if ((process.env.DATABASE_URL ?? "").includes(PROD_REF)) {
    throw new Error("Refusing to run the multi-progressor demo seed against production.");
  }

  // Agency + director.
  const knights = await agency("Knights Residential (MP-DEMO)");
  const director = await user("director@knights-mpdemo.co.uk", {
    name: "Rachel Hartley", role: "director", agencyId: knights.id, progressionBusinessId: null,
  });

  // Three progression businesses, each with an owner login.
  const keyToCompletion = await business("Key To Completion (MP-DEMO)");
  const movesByWright = await business("Moves By Wright (MP-DEMO)");
  const hartwell = await business("Hartwell & Partners (MP-DEMO)");

  await user("jo@keytocompletion-mpdemo.co.uk", {
    name: "Jo Saunders", role: "sales_progressor", agencyId: null,
    progressionBusinessId: keyToCompletion.id, progressionBusinessRole: "owner",
  });
  await user("annalise@movesbywright-mpdemo.co.uk", {
    name: "Annalise Wright", role: "sales_progressor", agencyId: null,
    progressionBusinessId: movesByWright.id, progressionBusinessRole: "owner",
  });
  const hartwellOwner = await user("marcus@hartwell-mpdemo.co.uk", {
    name: "Marcus Hartwell", role: "sales_progressor", agencyId: null,
    progressionBusinessId: hartwell.id, progressionBusinessRole: "owner",
  });

  // Two progressors already connected to Knights -> the per-sale picker lights up.
  await link(keyToCompletion.id, knights.id, 30000); // £300
  await link(movesByWright.id, knights.id, 35000);   // £350

  // A third progressor with a PENDING request to Knights -> Accept card on Knights'
  // hub + "Requests sent" row on Hartwell's Clients.
  await pendingRequest(hartwell.id, knights.id, hartwellOwner.id, 40000); // £400

  // A self-managed, active file on Knights -> the handover picker (open the
  // "Managed by" badge on this file as the director).
  const file = await selfManagedFile("12 Oakfield Drive, Elmswood (MP-DEMO)", knights.id, director.id);

  console.log("\n✅ Multi-progressor demo seeded on staging.\n");
  console.log("Password for ALL logins:", PASSWORD, "\n");
  console.log("AGENCY (Knights Residential):");
  console.log("  director@knights-mpdemo.co.uk   (Rachel Hartley, director)");
  console.log("PROGRESSORS:");
  console.log("  jo@keytocompletion-mpdemo.co.uk       (Jo, owner — connected to Knights)");
  console.log("  annalise@movesbywright-mpdemo.co.uk   (Annalise, owner — connected to Knights)");
  console.log("  marcus@hartwell-mpdemo.co.uk          (Marcus, owner — PENDING request to Knights)");
  console.log("\nSelf-managed file for handover demo:", file.id, "(12 Oakfield Drive)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
