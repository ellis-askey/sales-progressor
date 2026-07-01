// One-off: delete any PricingAcknowledgement rows belonging to the
// trial-expired seed agency, so the next modal trigger surfaces the
// terms step (rather than skipping straight to card).
//
// Run on staging:
//   npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/clear-trial-expired-acknowledgements.ts

import { PrismaClient } from "@prisma/client";

const AGENCY_NAME = "Trial Expired Spot Check Agency";

async function main() {
  const prisma = new PrismaClient();
  try {
    const agency = await prisma.agency.findFirst({
      where: { name: AGENCY_NAME },
      select: { id: true, name: true },
    });
    if (!agency) {
      console.log(`No-op: no agency named '${AGENCY_NAME}' on this DB.`);
      return;
    }
    const result = await prisma.pricingAcknowledgement.deleteMany({
      where: { agencyId: agency.id },
    });
    console.log(`Deleted ${result.count} PricingAcknowledgement row(s) for agency ${agency.id}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
