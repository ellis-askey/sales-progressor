// One-shot: populate the Chains workspace for the Boardwalk prod demo.
//   - 2 chains (Chandos, Cotham), each with a neighbour link ABOVE and BELOW
//     (unclaimed stubs = other Bristol agents) -> "In chains" + "Check-ins"
//   - Chandos is ready to exchange + in a chain -> "Push to exchange" (1)
//   - Fernbank marked not-buying-onward (ClientMoveInfo) -> "No chain"
//   - Bedminster + Ashton left untouched -> "Needs chain setup"
//
// SILENT: every stub agent email is a +boardwalk variation of ellisaskey@ (Ellis's
// own inbox) and every stub link is inviteStatus NOT_SENT, which the invite nudge /
// reminder crons never touch (they only act on SENT). Nothing sends.
//
// PROD-only guard; DIRECT_URL; idempotent (skips a file already in a chain).
//   npx dotenv -e .env.production --override -- npx tsx scripts/enrich-boardwalk-chains.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const EMAIL = (tag: string) => `ellisaskey+${tag}@googlemail.com`;

type Stub = { addr: string; agency: string; agent: string; tag: string; phone: string; notes: string };
type ChainDef = { name: string; match: string; claimedDaysAgo: number; expectedTimescale: string; chainNotes: string; above: Stub; below: Stub };

const CHAINS: ChainDef[] = [
  {
    name: "Chandos Road chain", match: "Chandos", claimedDaysAgo: 55,
    expectedTimescale: "Exchange within 2 weeks", chainNotes: "Three in the chain, all solicitors instructed. Ready to coordinate a simultaneous exchange once the top confirms.",
    above: { addr: "Grove Road, Henleaze, Bristol, BS9 4PN", agency: "Milburys Estate Agents", agent: "Mark Hollis", tag: "bwchA0", phone: "0117 900 0401", notes: "Sarah's onward purchase. Vendor above is chain-free and keen to exchange together." },
    below: { addr: "Nevil Road, Bishopston, Bristol, BS7 9EG", agency: "CJ Hole", agent: "Rachel Adeyemi", tag: "bwchA2", phone: "0117 900 0402", notes: "Daniel's sale. First-time buyer below is mortgage-approved and ready." },
  },
  {
    name: "Cotham Brow chain", match: "Cotham Brow", claimedDaysAgo: 20,
    expectedTimescale: "6 to 8 weeks", chainNotes: "Mid-chain. Probate at the top is the one to watch; bottom is chain-free and quick.",
    above: { addr: "Devonshire Road, Westbury Park, Bristol, BS6 7NL", agency: "Ocean Estate Agents", agent: "Tom Beresford", tag: "bwchB0", phone: "0117 900 0403", notes: "Helen's onward. Probate sale above may slow the top of the chain." },
    below: { addr: "Raleigh Road, Southville, Bristol, BS3 1QW", agency: "Hunters", agent: "Priya Mehta", tag: "bwchB2", phone: "0117 900 0404", notes: "Buyer's sale. Chain-free cash buyer sits at the bottom." },
  },
];
const NO_CHAIN_MATCH = "Fernbank";

function stubData(chainId: string, position: number, s: Stub, userId: string) {
  return {
    chainId, position, createdByUserId: userId, createdAt: now,
    inviteStatus: "NOT_SENT" as const,
    stubPropertyAddress: s.addr, stubAgencyName: s.agency, stubAgentName: s.agent,
    stubAgentEmail: EMAIL(s.tag), stubAgentPhone: s.phone, stubNotes: s.notes,
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) { console.error("REFUSING: not the PROD project."); process.exit(1); }
  if (dbUrl.includes("etidawkbqctarmsdjoxp")) { console.error("REFUSING: staging."); process.exit(1); }
  console.log("== Enrich Boardwalk chains (LIVE PROD) ==\n");

  const agency = await prisma.agency.findFirst({ where: { name: "Boardwalk Property Co" }, select: { id: true } });
  const user = await prisma.user.findUnique({ where: { email: "millie@boardwalkpropertyco.com" }, select: { id: true } });
  if (!agency || !user) { console.error("agency/user missing"); process.exit(1); }

  for (const c of CHAINS) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { agencyId: agency.id, propertyAddress: { contains: c.match } },
      select: { id: true, propertyAddress: true, chainLinkId: true },
    });
    if (!tx) { console.log(`  ! no file "${c.match}"`); continue; }
    if (tx.chainLinkId) { console.log(`• ${tx.propertyAddress} — already in a chain, skipping`); continue; }

    const chain = await prisma.propertyChain.create({
      data: { agencyId: agency.id, name: c.name, createdByUserId: user.id, status: "ACTIVE" },
      select: { id: true },
    });
    // pos 0 = top (onward, most to do), pos 1 = our sale, pos 2 = bottom (buyer, furthest along)
    await prisma.chainLink.create({ data: stubData(chain.id, 0, c.above, user.id) });
    const ourLink = await prisma.chainLink.create({
      data: {
        chainId: chain.id, position: 1, createdByUserId: user.id, createdAt: now,
        transactionId: tx.id, claimedByUserId: user.id, claimedAt: daysAgo(c.claimedDaysAgo),
        inviteStatus: "CLAIMED",
        expectedTimescale: c.expectedTimescale, chainNotes: c.chainNotes, lastChainCheckAt: daysAgo(4),
      },
      select: { id: true },
    });
    await prisma.chainLink.create({ data: stubData(chain.id, 2, c.below, user.id) });
    await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { chainLinkId: ourLink.id } });
    console.log(`• ${tx.propertyAddress} — chain "${c.name}": stub above + our sale + stub below`);
  }

  // No-chain: Fernbank seller isn't buying onward.
  const fern = await prisma.propertyTransaction.findFirst({
    where: { agencyId: agency.id, propertyAddress: { contains: NO_CHAIN_MATCH } },
    select: { id: true, propertyAddress: true },
  });
  if (fern) {
    const existing = await prisma.clientMoveInfo.findFirst({ where: { transactionId: fern.id }, select: { id: true } });
    if (existing) await prisma.clientMoveInfo.update({ where: { id: existing.id }, data: { buyingOnward: false } });
    else await prisma.clientMoveInfo.create({ data: { transactionId: fern.id, side: "vendor", buyingOnward: false } });
    // No chain needs BOTH ends chain-free: seller not buying onward (above) AND a
    // chain-free buyer (below). Make the buyer a first-time buyer.
    // clientFirstTimeBuyer => buyer chain-free; noChainNeededAt => confirmed, so it
    // lands in the "No chain" tab rather than sitting as a suggestion in setup.
    await prisma.propertyTransaction.update({ where: { id: fern.id }, data: { clientFirstTimeBuyer: true, noChainNeededAt: now } });
    console.log(`• ${fern.propertyAddress} — not buying onward + first-time buyer, confirmed No chain`);
  }

  console.log("\nDone. (Bedminster + Ashton left in Needs chain setup.)");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
