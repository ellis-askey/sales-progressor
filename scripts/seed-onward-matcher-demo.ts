// One-off LOCAL seed (staging DB) for the Phase 2 "same person?" matcher
// (docs/active/onward-portal-mirror.md). Creates, for Emily Chen (Hartwell),
// a client who SELLS one home and BUYS another through us — but with AMBIGUOUS
// contacts (short vs long names, no emails) so auto-match can't tie them and the
// matcher is needed. Both files are self-managed (same team) and chain-linked
// (the purchase sits directly above the sale), so resolveOwnOnwardFileId finds it.
//
// NOT committed to prod behaviour — a dev/test fixture. Idempotent: deletes its
// own prior rows (MARKER) before re-creating. Refuses to run against prod.
//
// Run:
//   TS_NODE_PROJECT=tsconfig.seed.json npx dotenv -e .env --override -- \
//     ts-node --transpile-only -r tsconfig-paths/register scripts/seed-onward-matcher-demo.ts

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const MARKER = "· Onward Matcher Demo";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to run against PROD DB.");

  const user = await prisma.user.findFirst({
    where: { email: "emily@hartwellpartners.co.uk" },
    select: { id: true, name: true, agencyId: true },
  });
  if (!user?.agencyId) throw new Error("emily@hartwellpartners.co.uk not found or has no agency");
  const agencyId = user.agencyId;
  const owner = user.id;

  // ── Clean up any prior run ──────────────────────────────────────────────────
  const prior = await prisma.propertyTransaction.findMany({
    // Match by notes (new) OR address (old runs that put the marker in the address).
    where: { agencyId, OR: [{ notes: { contains: MARKER } }, { propertyAddress: { contains: MARKER } }] },
    select: { id: true, chainLink: { select: { chainId: true } } },
  });
  if (prior.length) {
    const ids = prior.map((p) => p.id);
    const chainIds = [...new Set(prior.map((p) => p.chainLink?.chainId).filter((x): x is string => !!x))];
    if (chainIds.length) await prisma.propertyChain.deleteMany({ where: { id: { in: chainIds } } });
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: { in: ids } } });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: { in: ids } } });
    await prisma.propertyTransaction.updateMany({ where: { id: { in: ids } }, data: { activeBuyerRoundId: null } });
    await prisma.buyerRound.deleteMany({ where: { transactionId: { in: ids } } });
    await prisma.propertyTransaction.deleteMany({ where: { id: { in: ids } } });
    console.log(`cleaned ${ids.length} prior seeded file(s)\n`);
  }

  const { initializeMilestoneCompletions } = await import("../lib/services/milestones");

  async function makeFile(address: string, purchasePrice: number) {
    return prisma.$transaction(async (ptx) => {
      const created = await ptx.propertyTransaction.create({
        data: {
          propertyAddress: address,
          notes: MARKER,
          agencyId, assignedUserId: owner, agentUserId: owner,
          progressedBy: "agent", serviceType: "self_managed", status: "active",
          tenure: "freehold", purchaseType: "mortgage", purchasePrice,
          agentFeeAmount: 400000, agentFeeIsVatInclusive: false, freeOnExchange: false,
          createdAt: new Date(), lastActivityAt: new Date(),
        },
      });
      const round = await ptx.buyerRound.create({
        data: { transactionId: created.id, roundNumber: 1, status: "active", purchasePrice: created.purchasePrice },
      });
      return ptx.propertyTransaction.update({ where: { id: created.id }, data: { activeBuyerRoundId: round.id } });
    });
  }

  // fileB — the onward PURCHASE. The Smiths are the buyers here (short names, no email).
  const fileB = await makeFile("22 Elm Grove, Westbourne, BH4 9DN", 62_000000);
  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: fileB.id, name: "Bob Smith", roleType: "purchaser", portalToken: randomUUID(), buyerRoundId: fileB.activeBuyerRoundId },
      { propertyTransactionId: fileB.id, name: "Pat Smith", roleType: "purchaser", portalToken: randomUUID(), buyerRoundId: fileB.activeBuyerRoundId },
      { propertyTransactionId: fileB.id, name: "Helen Carter", email: `v-${randomUUID().slice(0, 6)}@matcher-demo.test`, roleType: "vendor", portalToken: randomUUID(), buyerRoundId: null },
    ],
  });
  await initializeMilestoneCompletions(fileB.id, "freehold", "mortgage", owner, fileB.activeBuyerRoundId, prisma);

  // fileA — the SALE. The same Smiths are the sellers here (long names, no email),
  // plus the buyer of their sale.
  const fileA = await makeFile("7 Rowan Close, Harbreck, BH12 3LT", 45_000000);
  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: fileA.id, name: "Robert Smith", roleType: "vendor", portalToken: randomUUID(), buyerRoundId: null },
      { propertyTransactionId: fileA.id, name: "Patricia Smith", roleType: "vendor", portalToken: randomUUID(), buyerRoundId: null },
      { propertyTransactionId: fileA.id, name: "Tom Baker", email: `p-${randomUUID().slice(0, 6)}@matcher-demo.test`, roleType: "purchaser", portalToken: randomUUID(), buyerRoundId: fileA.activeBuyerRoundId },
    ],
  });
  await initializeMilestoneCompletions(fileA.id, "freehold", "mortgage", owner, fileA.activeBuyerRoundId, prisma);

  // fileA gets a chain (with a stub below) so it's openable in Chains and the
  // agent can self-link fileB ABOVE it. fileB stays standalone so it's the file
  // they add — that self-link is the real flow the matcher fires from.
  const { createChainV2 } = await import("../lib/services/chains");
  await createChainV2({
    transactionId: fileA.id,
    agencyId,
    userId: owner,
    stubs: [{ direction: "below", stubPropertyAddress: "3 Market Street, Poole, BH15 1NB", stubAgencyName: "Bay Estates", stubAgentName: "Dawn Reed", stubAgentEmail: "", stubAgentPhone: "", stubNotes: "" }],
  });

  console.log("── Seeded ─────────────────────────────────────────────────────────────");
  console.log(`Sale (fileA, in a chain):  ${fileA.propertyAddress}  [${fileA.id}]`);
  console.log(`Purchase (fileB, standalone): ${fileB.propertyAddress}  [${fileB.id}]`);
  console.log(`\nReal flow (logged in as Emily):`);
  console.log(`   1. Chains → open the "7 Rowan Close" chain`);
  console.log(`   2. Add a node ABOVE → "One of my sales" → search "22 Elm Grove" → link it`);
  console.log(`   3. The "same person?" matcher appears: Robert→Bob, Patricia→Pat → Save`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
