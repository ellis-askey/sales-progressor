// Seed 3 test transactions on staging covering the shape combinations
// missing for the Model B cutover 4-shape walk-through. The fourth shape
// (Leasehold × Mortgage) is already covered by the existing 18 Oakfield
// Road test file.
//
// Each new transaction:
//   - is owned by Ellis (SP) — assignedUserId = cmpehuy9d000b2ebfl0psqlve
//   - uses the same agencyId as 18 Oakfield Road (cribbed at runtime)
//   - has vendor + purchaser contacts both at ellisaskey+modelb@googlemail.com
//   - has portal tokens generated for each contact (so portal-route
//     verification can also be exercised)
//   - has tenure + purchaseType set (mandatory for Model B FileShape to
//     construct — null shape short-circuits the assembler back to legacy)
//   - has milestoneCompletions initialised so the journey is walkable
//
// Idempotent: skips creation if a matching propertyAddress already exists
// (so re-runs don't pile up duplicate files).
//
// Run:
//   DATABASE_URL="$(grep '^DATABASE_URL' .env.preview | cut -d'=' -f2- | tr -d '"')" \
//   DIRECT_URL="$(grep '^DIRECT_URL' .env.preview | cut -d'=' -f2- | tr -d '"')" \
//   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' \
//     scripts/seed-cutover-shapes.ts

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { initializeMilestoneCompletions } from "../lib/services/milestones";

const ELLIS_SP_ID = "cmpehuy9d000b2ebfl0psqlve"; // Ellis on staging (Sales Progressor)
const BURNER_EMAIL = "ellisaskey+modelb@googlemail.com";

type ShapeFixture = {
  address: string;
  tenure: "freehold" | "leasehold";
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds";
};

const SHAPES: ShapeFixture[] = [
  { address: "1 Cutover Lane, Freehold Town, FH1 1MG", tenure: "freehold",  purchaseType: "mortgage" },
  { address: "2 Cutover Lane, Cashland, CB1 1CB",       tenure: "freehold",  purchaseType: "cash_buyer" },
  { address: "3 Cutover Lane, Leaseville, LH1 1CP",     tenure: "leasehold", purchaseType: "cash_from_proceeds" },
];

function newPortalToken(): string {
  return randomBytes(24).toString("base64url");
}

async function main() {
  console.log(`\n=== Cutover-shapes seed (staging) ===`);

  // Crib the agencyId from an existing test transaction. 18 Oakfield is
  // the leasehold-mortgage file in active use for the cutover — use its
  // agency so the new fixtures live in the same tenant scope.
  const reference = await prisma.propertyTransaction.findFirst({
    where: { propertyAddress: { startsWith: "18 Oakfield Road" } },
    select: { agencyId: true, agentUserId: true, serviceType: true },
  });

  if (!reference) {
    throw new Error(
      "Couldn't find a reference transaction to crib agencyId from. " +
      "Looked for any tx starting with '18 Oakfield Road'. Adjust the " +
      "reference lookup if your staging data doesn't include this file."
    );
  }

  const { agencyId, agentUserId, serviceType } = reference;
  console.log(`Reference agency: ${agencyId}`);
  console.log(`Reference agent:  ${agentUserId ?? "(none)"}`);
  console.log(`Reference serviceType: ${serviceType}\n`);

  for (const shape of SHAPES) {
    const existing = await prisma.propertyTransaction.findFirst({
      where: { propertyAddress: shape.address },
      select: { id: true },
    });

    if (existing) {
      console.log(`↻ ${shape.address} already exists [${existing.id}] — skipping`);
      continue;
    }

    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress:  shape.address,
        agencyId,
        agentUserId:      agentUserId ?? null,
        assignedUserId:   ELLIS_SP_ID,
        serviceType,
        status:           "active",
        tenure:           shape.tenure,
        purchaseType:     shape.purchaseType,
        purchasePrice:    500_000_00, // £500,000 in pence
      },
      select: { id: true },
    });

    await prisma.contact.createMany({
      data: [
        {
          propertyTransactionId: tx.id,
          name:                  "Test Seller",
          email:                 BURNER_EMAIL,
          roleType:              "vendor",
          portalToken:           newPortalToken(),
        },
        {
          propertyTransactionId: tx.id,
          name:                  "Test Buyer",
          email:                 BURNER_EMAIL,
          roleType:              "purchaser",
          portalToken:           newPortalToken(),
        },
      ],
    });

    const autoNr = await initializeMilestoneCompletions(
      tx.id,
      shape.tenure,
      shape.purchaseType,
      ELLIS_SP_ID,
    );

    console.log(`✓ ${shape.address}`);
    console.log(`    tx id:        ${tx.id}`);
    console.log(`    tenure:       ${shape.tenure}`);
    console.log(`    purchaseType: ${shape.purchaseType}`);
    console.log(`    auto-NR'd:    ${Array.from(autoNr).join(", ") || "(none)"}`);
    console.log("");
  }

  console.log(`=== Done. Three cutover-shape fixtures ready. ===\n`);
  console.log(`Burner inbox: ${BURNER_EMAIL}`);
  console.log(`Owner:        Ellis (SP) [${ELLIS_SP_ID}]\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
