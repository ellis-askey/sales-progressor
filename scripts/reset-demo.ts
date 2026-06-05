// scripts/reset-demo.ts
//
// Thin wrapper around scripts/seed-demo.ts:runSeedDemo. Seed is already
// idempotent (tears down first, then reseeds), so reset == seed at the
// behavioural level — this exists so the CLI and the Reset Demo button
// in /command/admin/demo each have a clearly-named entry point.

import { PrismaClient } from "@prisma/client";
import {
  assertDemoSafe,
  runSeedDemo,
  DEMO_AGENCY_NAME,
  DEMO_DIRECTOR_EMAIL,
  DEMO_DIRECTOR_PASSWORD,
  DEMO_NEGOTIATOR_EMAIL,
  DEMO_NEGOTIATOR_PASSWORD,
} from "./seed-demo";

async function main(): Promise<void> {
  assertDemoSafe();
  const prisma = new PrismaClient();
  try {
    console.log("=== DEMO RESET ===");
    console.log("Target DB:", (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@"));
    console.log("Tearing down + reseeding…");
    const manifest = await runSeedDemo(prisma);
    console.log("\nReset complete.");
    console.log(`  Agency:     ${DEMO_AGENCY_NAME} (${manifest.agencyId})`);
    console.log(`  Director:   ${DEMO_DIRECTOR_EMAIL} / ${DEMO_DIRECTOR_PASSWORD}`);
    console.log(`  Negotiator: ${DEMO_NEGOTIATOR_EMAIL} / ${DEMO_NEGOTIATOR_PASSWORD}`);
    console.log(`  Fixtures:   ${manifest.fixtures.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nReset failed:", err);
  process.exit(1);
});
