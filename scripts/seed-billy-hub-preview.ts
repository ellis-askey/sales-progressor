// One-shot: seed the ellisaskey+billy@googlemail.com account on staging
// with enough varied data to show off the hub-polish PRs (Wins card,
// PipelineAtAGlance, forecast, service split, etc.).
//
// Refuses to run against prod DB at runtime (checks DATABASE_URL host
// before any write, same guard as seed-playwright-director.ts).
//
// What it seeds:
//   - Agency "Billy Test Agency" (upsert)
//   - User ellisaskey+billy@googlemail.com as director on that agency
//     with password "password"
//   - ~20 transactions covering each pipeline-at-a-glance stage:
//       * 4 in "New"        (0-3 milestone completions each)
//       * 6 in "Legals"     (6-12 completions)
//       * 4 in "Ready"      (16+ completions, no VM19/PM26)
//       * 3 in "Exchanging" (VM19 or PM26 marked)
//       * 3 in "Completed"  (status=completed, completionDate this year)
//   - 2 files with expectedExchangeDate = today (populates diary)
//   - 2 files with expectedExchangeDate = this week (forecast tint)
//   - A mix of self_managed + outsourced serviceType so the service
//     split donut has a real split
//
// Run:
//   env $(grep -E "^DATABASE_URL=|^DIRECT_URL=" .env.preview | xargs) \
//     npx tsx scripts/seed-billy-hub-preview.ts
//
// Idempotent — re-running just top-ups (won't duplicate txs by
// address).
//
// Registered in docs/SCRIPTS_REGISTRY.md per Law 15.
// Lifetime: one-shot (delete after Billy has viewed the hub).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_EMAIL = "ellisaskey+billy@googlemail.com";
const TEST_PASSWORD = "password";
const TEST_NAME = "Billy (Ellis Askey)";
const AGENCY_NAME = "Billy Test Agency";

const prisma = new PrismaClient();

const NEW_ADDRESSES = [
  "3 Ash Grove, Guildford, GU1 4AA",
  "12 Beech Rise, Woking, GU21 2BB",
  "8 Cedar Way, Farnham, GU9 3CC",
  "27 Damson Lane, Godalming, GU7 4DD",
];
const LEGALS_ADDRESSES = [
  "45 Elm Close, Weybridge, KT13 5EE",
  "9 Foxglove Drive, Cobham, KT11 6FF",
  "18 Grange Road, Esher, KT10 7GG",
  "14 Hazel Wynd, Leatherhead, KT22 8HH",
  "6 Ivy Terrace, Kingston, KT2 9II",
  "31 Juniper Court, Richmond, TW10 1JJ",
];
const READY_ADDRESSES = [
  "22 Kingfisher Row, Twickenham, TW1 2KK",
  "17 Larch Avenue, Hampton, TW12 3LL",
  "40 Maple Mews, Teddington, TW11 4MM",
  "5 Nightingale Rise, Shepperton, TW17 5NN",
];
const EXCHANGING_ADDRESSES = [
  "11 Oak Ridge, Sunbury, TW16 6OO",
  "26 Pine Hollow, Walton, KT12 7PP",
  "38 Quince Grove, Molesey, KT8 8QQ",
];
const COMPLETED_ADDRESSES = [
  "2 Rowan Close, Wimbledon, SW19 9RR",
  "19 Sycamore Green, Putney, SW15 0SS",
  "33 Tulip Lane, Barnes, SW13 1TT",
];

const now = new Date();
function daysAgo(n: number) {
  return new Date(now.getTime() - n * 86400000);
}
function daysAhead(n: number) {
  return new Date(now.getTime() + n * 86400000);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  // Refuse to run against prod under any circumstance.
  if (dbUrl.includes("gmkfustgwipgihpmpjpr")) {
    console.error("REFUSING: this script must NOT run against the prod DB.");
    console.error(`Current DATABASE_URL host suggests prod (project id gmkfustgwipgihpmpjpr).`);
    process.exit(1);
  }
  if (!dbUrl.includes("etidawkbqctarmsdjoxp")) {
    console.error("REFUSING: this script only runs against the staging DB.");
    console.error(`Current DATABASE_URL does not point to staging (etidawkbqctarmsdjoxp).`);
    process.exit(1);
  }
  console.log("OK — staging DB confirmed (etidawkbqctarmsdjoxp).");

  // ── Agency ──────────────────────────────────────────────────────────
  // Agency.name isn't unique in the schema, so findFirst + create instead of upsert.
  let agency = await prisma.agency.findFirst({
    where: { name: AGENCY_NAME },
    select: { id: true, name: true },
  });
  if (!agency) {
    agency = await prisma.agency.create({
      data: {
        name: AGENCY_NAME,
        feeTier: "standard",
      },
      select: { id: true, name: true },
    });
  }
  console.log(`Agency ready: ${agency.name} (${agency.id})`);

  // ── User ────────────────────────────────────────────────────────────
  const password = await bcrypt.hash(TEST_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      password,
      role: "director",
      agencyId: agency.id,
      name: TEST_NAME,
      hasSeenAgentWelcome: true,
    },
    create: {
      email: TEST_EMAIL,
      password,
      role: "director",
      agencyId: agency.id,
      name: TEST_NAME,
      hasSeenAgentWelcome: true,
    },
    select: { id: true, email: true, role: true, agencyId: true },
  });
  console.log(`User ready: ${user.email} (${user.id}) — password: ${TEST_PASSWORD}`);

  // ── Milestone defs ──────────────────────────────────────────────────
  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true, orderIndex: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  const defsByCode = new Map(allDefs.map((d) => [d.code, d.id]));
  const vmDefs = allDefs.filter((d) => d.side === "vendor" && !["VM19", "VM20"].includes(d.code));
  const pmDefs = allDefs.filter((d) => d.side === "purchaser" && !["PM26", "PM27"].includes(d.code));
  const vm19 = defsByCode.get("VM19");
  const vm20 = defsByCode.get("VM20");
  const pm26 = defsByCode.get("PM26");
  const pm27 = defsByCode.get("PM27");
  if (!vm19 || !vm20 || !pm26 || !pm27) {
    console.error("Milestone def lookup failed. Aborting.");
    process.exit(1);
  }

  // ── Helper: create tx with N milestone completions ──────────────────
  async function seedTx(opts: {
    address: string;
    createdDaysAgo: number;
    completionCount: number;
    includeExchange?: boolean;
    status?: "active" | "completed";
    completionDate?: Date | null;
    expectedExchangeDate?: Date | null;
    purchasePrice?: number;
    serviceType?: "self_managed" | "outsourced";
  }) {
    const existing = await prisma.propertyTransaction.findFirst({
      where: { propertyAddress: opts.address, agencyId: agency.id },
      select: { id: true },
    });
    if (existing) {
      console.log(`  skip (exists): ${opts.address}`);
      return existing.id;
    }
    const created = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: opts.address,
        agencyId: agency.id,
        agentUserId: user.id,
        status: opts.status ?? "active",
        serviceType: opts.serviceType ?? "self_managed",
        purchasePrice: opts.purchasePrice ?? Math.round(300_000 + Math.random() * 400_000) * 100, // pence
        expectedExchangeDate: opts.expectedExchangeDate ?? null,
        completionDate: opts.completionDate ?? null,
        createdAt: daysAgo(opts.createdDaysAgo),
        lastActivityAt: daysAgo(Math.max(0, opts.createdDaysAgo - 3)),
      },
      select: { id: true },
    });
    // Seed milestone completions to hit the target count.
    // Interleave VM + PM by orderIndex; skip VM19/VM20/PM26/PM27 unless the
    // includeExchange flag is set.
    const pool = [
      ...vmDefs.slice(0, Math.ceil(opts.completionCount / 2)),
      ...pmDefs.slice(0, Math.floor(opts.completionCount / 2)),
    ];
    const chosen = pool.slice(0, opts.completionCount);
    for (const def of chosen) {
      await prisma.milestoneCompletion.create({
        data: {
          transactionId: created.id,
          milestoneDefinitionId: def.id,
          state: "complete",
          completedAt: daysAgo(Math.max(1, opts.createdDaysAgo - 5 - Math.floor(Math.random() * 10))),
          completedById: user.id,
        },
      });
    }
    if (opts.includeExchange) {
      // Mark VM19 completion (exchange).
      await prisma.milestoneCompletion.create({
        data: {
          transactionId: created.id,
          milestoneDefinitionId: vm19!,
          state: "complete",
          completedAt: daysAgo(Math.max(1, Math.floor(opts.createdDaysAgo / 3))),
          completedById: user.id,
        },
      });
    }
    console.log(`  seeded: ${opts.address} (${opts.completionCount} completions${opts.includeExchange ? " + exchange" : ""})`);
    return created.id;
  }

  console.log("\n── Seeding transactions ────────────────────────────────");

  // Tier 1 — NEW (4 files, 0-3 completions)
  console.log("New:");
  for (let i = 0; i < NEW_ADDRESSES.length; i++) {
    await seedTx({
      address: NEW_ADDRESSES[i],
      createdDaysAgo: 5 + i * 3,
      completionCount: i, // 0, 1, 2, 3
      serviceType: i % 2 === 0 ? "self_managed" : "outsourced",
    });
  }

  // Tier 2 — LEGALS (6 files, 6-12 completions)
  console.log("Legals:");
  for (let i = 0; i < LEGALS_ADDRESSES.length; i++) {
    await seedTx({
      address: LEGALS_ADDRESSES[i],
      createdDaysAgo: 30 + i * 5,
      completionCount: 6 + i,
      serviceType: i % 3 === 0 ? "outsourced" : "self_managed",
    });
  }

  // Tier 3 — READY (4 files, 15+ completions, no exchange)
  console.log("Ready:");
  for (let i = 0; i < READY_ADDRESSES.length; i++) {
    // Give one file an expectedExchangeDate today (populates diary).
    const isToday = i === 0;
    // Give another an expectedExchangeDate this week (forecast tint).
    const isThisWeek = i === 1;
    await seedTx({
      address: READY_ADDRESSES[i],
      createdDaysAgo: 60 + i * 7,
      completionCount: 17 + i,
      expectedExchangeDate: isToday ? now : isThisWeek ? daysAhead(3) : daysAhead(10 + i),
      serviceType: i % 2 === 0 ? "outsourced" : "self_managed",
    });
  }

  // Tier 4 — EXCHANGING (3 files, VM19 done)
  console.log("Exchanging:");
  for (let i = 0; i < EXCHANGING_ADDRESSES.length; i++) {
    await seedTx({
      address: EXCHANGING_ADDRESSES[i],
      createdDaysAgo: 90 + i * 10,
      completionCount: 18,
      includeExchange: true,
      completionDate: daysAhead(14 + i * 5),
      serviceType: "outsourced",
    });
  }

  // Tier 5 — COMPLETED (3 files this year)
  console.log("Completed:");
  for (let i = 0; i < COMPLETED_ADDRESSES.length; i++) {
    await seedTx({
      address: COMPLETED_ADDRESSES[i],
      createdDaysAgo: 120 + i * 20,
      completionCount: 20,
      includeExchange: true,
      status: "completed",
      completionDate: daysAgo(20 + i * 15),
      serviceType: i % 2 === 0 ? "outsourced" : "self_managed",
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const finalCount = await prisma.propertyTransaction.count({
    where: { agencyId: agency.id },
  });
  console.log("\n── Ready ──────────────────────────────────────────────");
  console.log(`Login: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`Agency: ${AGENCY_NAME} (${agency.id})`);
  console.log(`Total files on the agency: ${finalCount}`);
  console.log(`Hub URL: https://sales-progressor-staging.vercel.app/agent/hub`);
  console.log(`(or your staging domain equivalent)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
