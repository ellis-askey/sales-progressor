// Temporary fixture script — chain withdrawal verification scenarios
// Safe to delete after walk-through. Creates 3 chains + confirms scenario 1.
// Does NOT send email, does NOT touch milestones or comms.

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

async function main() {
  // ── Find users with emails + agency ──────────────────────────────────────
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, agencyId: true },
    take: 20,
  });
  const users = allUsers.filter((u) => u.email && u.agencyId).slice(0, 4);

  if (users.length < 2) {
    throw new Error(`Need at least 2 users with email + agencyId. Found: ${users.length}`);
  }

  const agencyId = users[0].agencyId!;
  const u1 = users[0];
  const u2 = users[1];
  const u3 = users[2] ?? users[1];
  const u4 = users[3] ?? users[1];

  console.log(`\nUsing agency: ${agencyId}`);
  console.log(`Users: ${users.map((u) => `${u.name} <${u.email}>`).join(", ")}\n`);

  // ── Scenario 1 — confirm a chainLinkId=null transaction exists ────────────
  const s1 = await prisma.propertyTransaction.findFirst({
    where: { chainLinkId: null },
    select: { id: true, propertyAddress: true },
  });
  if (s1) {
    console.log(`✓ Scenario 1 (no chain): "${s1.propertyAddress}" [${s1.id}] — already exists`);
  } else {
    const created = await prisma.propertyTransaction.create({
      data: { propertyAddress: "1 Test Lane, Nowhere, NW1 1AA", agencyId, status: "active" },
    });
    console.log(`✓ Scenario 1 (no chain): created [${created.id}]`);
  }

  // ── Scenario 2 — solo: originator claimed, 2 unclaimed stubs ─────────────
  {
    const txn = await prisma.propertyTransaction.create({
      data: { propertyAddress: "2 Fixture Road, Solo Town, SO1 2BB", agencyId, status: "active" },
    });
    const chain = await prisma.propertyChain.create({
      data: { agencyId, createdByUserId: u1.id, status: "ACTIVE" },
    });
    await prisma.chainLink.create({
      data: { chainId: chain.id, position: 0, createdByUserId: u1.id, stubPropertyAddress: "0 Above Street, Solo Town", stubAgencyName: "Above Agency", inviteStatus: "NOT_SENT" },
    });
    const originLink = await prisma.chainLink.create({
      data: { chainId: chain.id, position: 1, createdByUserId: u1.id, transactionId: txn.id, claimedByUserId: u1.id, claimedAt: new Date(), inviteStatus: "CLAIMED" },
    });
    await prisma.propertyTransaction.update({ where: { id: txn.id }, data: { chainLinkId: originLink.id } });
    await prisma.chainLink.create({
      data: { chainId: chain.id, position: 2, createdByUserId: u1.id, stubPropertyAddress: "3 Below Avenue, Solo Town", stubAgencyName: "Below Agency", inviteStatus: "NOT_SENT" },
    });
    console.log(`✓ Scenario 2 (solo): chain [${chain.id}]  txn [${txn.id}]`);
    console.log(`   Withdraw this txn → 0 queue rows expected`);
  }

  // ── Scenario 3 — 2-link chain, both claimed ───────────────────────────────
  {
    const txn1 = await prisma.propertyTransaction.create({
      data: { propertyAddress: "10 Pair Close, Twoton, TW1 0AA", agencyId, status: "active" },
    });
    const txn2 = await prisma.propertyTransaction.create({
      data: { propertyAddress: "11 Pair Close, Twoton, TW1 0BB", agencyId, status: "active" },
    });
    const chain = await prisma.propertyChain.create({
      data: { agencyId, createdByUserId: u1.id, status: "ACTIVE" },
    });
    const link1 = await prisma.chainLink.create({
      data: { chainId: chain.id, position: 0, createdByUserId: u1.id, transactionId: txn1.id, claimedByUserId: u1.id, claimedAt: new Date(), inviteStatus: "CLAIMED" },
    });
    const link2 = await prisma.chainLink.create({
      data: { chainId: chain.id, position: 1, createdByUserId: u2.id, transactionId: txn2.id, claimedByUserId: u2.id, claimedAt: new Date(), inviteStatus: "CLAIMED" },
    });
    await prisma.propertyTransaction.update({ where: { id: txn1.id }, data: { chainLinkId: link1.id } });
    await prisma.propertyTransaction.update({ where: { id: txn2.id }, data: { chainLinkId: link2.id } });
    console.log(`✓ Scenario 3 (2-link): chain [${chain.id}]`);
    console.log(`   txn1 [${txn1.id}] — ${u1.name} (withdraw this)`);
    console.log(`   txn2 [${txn2.id}] — ${u2.name} (expect 1 queue row for ${u2.email})`);
  }

  // ── Scenario 4 — 4-link chain, all claimed ────────────────────────────────
  {
    const owners = [u1, u2, u3, u4];
    const addresses = [
      "1 Quad Gardens, Fourville, FV1 1AA",
      "2 Quad Gardens, Fourville, FV1 2BB",
      "3 Quad Gardens, Fourville, FV1 3CC",
      "4 Quad Gardens, Fourville, FV1 4DD",
    ];
    const txns = await Promise.all(
      addresses.map((addr) =>
        prisma.propertyTransaction.create({ data: { propertyAddress: addr, agencyId, status: "active" } }),
      ),
    );
    const chain = await prisma.propertyChain.create({
      data: { agencyId, createdByUserId: u1.id, status: "ACTIVE" },
    });
    const links = [];
    for (let i = 0; i < 4; i++) {
      const lnk = await prisma.chainLink.create({
        data: { chainId: chain.id, position: i, createdByUserId: owners[i].id, transactionId: txns[i].id, claimedByUserId: owners[i].id, claimedAt: new Date(), inviteStatus: "CLAIMED" },
      });
      links.push(lnk);
    }
    for (let i = 0; i < 4; i++) {
      await prisma.propertyTransaction.update({ where: { id: txns[i].id }, data: { chainLinkId: links[i].id } });
    }
    console.log(`✓ Scenario 4 (4-link): chain [${chain.id}]`);
    console.log(`   txn1 [${txns[0].id}] — ${u1.name} (withdraw this)`);
    console.log(`   Expect 3 queue rows for: ${[u2, u3, u4].map((u) => u.email).join(", ")}`);
  }

  console.log("\nAll fixtures ready. Run cleanup-chain-fixtures.ts when done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
