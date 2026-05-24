// Companion to insert-staging-terms-v1.ts.
// Deletes the 2026-05-payments-v1 TermsVersion row on STAGING ONLY so the
// blocked/pending state of /agent/billing/payment-method can be eyeballed.
//
// Also deletes any PricingAcknowledgement rows pointing at it (FK cleanup).
//
// Same hard guard against prod as the insert script.

import { PrismaClient } from "@prisma/client";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const VERSION_TAG = "2026-05-payments-v1";

function projectIdOf(url: string | undefined): string {
  const m = url?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/);
  return m ? m[1] : "UNKNOWN";
}

async function main() {
  const dbProj = projectIdOf(process.env.DATABASE_URL);
  if (dbProj === PROD_PROJECT_ID) {
    console.error("ABORT — DATABASE_URL points at PRODUCTION. Staging-only script.");
    process.exit(1);
  }
  if (dbProj !== STAGING_PROJECT_ID) {
    console.error(`ABORT — DATABASE_URL project id (${dbProj}) isn't staging (${STAGING_PROJECT_ID}).`);
    process.exit(1);
  }

  const p = new PrismaClient();
  try {
    const row = await p.termsVersion.findUnique({ where: { versionTag: VERSION_TAG } });
    if (!row) {
      console.log(`No-op: '${VERSION_TAG}' doesn't exist on staging (already deleted).`);
      process.exit(0);
    }
    const ackDel = await p.pricingAcknowledgement.deleteMany({ where: { termsVersionId: row.id } });
    await p.termsVersion.delete({ where: { id: row.id } });
    console.log(`✓ Deleted TermsVersion id=${row.id} (versionTag=${VERSION_TAG})`);
    console.log(`  + ${ackDel.count} PricingAcknowledgement row(s) cleaned up`);
    console.log("");
    console.log("Staging /agent/billing/payment-method now shows the BLOCKED (pending) state.");
    console.log("Re-insert with: npx ts-node ... scripts/insert-staging-terms-v1.ts");
  } finally {
    await p.$disconnect();
  }
}

void main();
