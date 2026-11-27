/**
 * Seed the first Progressor Network business — Moves by Wright.
 *
 * Idempotent upsert by a stable id. Founder-curated profile (v1): the declared
 * fields (tagline, blurb, logo, regions, specialisms, availability) are set here;
 * the VERIFIED performance stats are computed from transactions at read time, so
 * this business shows the "new to the network" state until it completes sales on
 * the platform. Safe to run against any environment (additive upsert).
 *
 * Run: ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-moves-by-wright.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ID = "moves-by-wright";

const PROFILE = {
  networkListed: true,
  networkTagline: "Independent sales progression business",
  networkBlurb:
    "Proactive sales progression for estate agents, from sale agreed to completion, coordinating the chain and keeping clients informed.",
  networkLogoPath: "/network/moves-by-wright.png",
  networkBrandColor: "#334155",
  networkRegions: ["Nationwide"],
  networkSpecialisms: ["Chain management"],
  networkAvailability: "accepting",
};

async function main() {
  const biz = await prisma.progressionBusiness.upsert({
    where: { id: ID },
    create: { id: ID, name: "Moves by Wright", isTsp: false, ...PROFILE },
    update: { ...PROFILE },
  });
  console.log(
    `Upserted ProgressionBusiness ${biz.id} (${biz.name}) — networkListed=${biz.networkListed}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
