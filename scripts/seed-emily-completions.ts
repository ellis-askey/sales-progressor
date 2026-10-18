// One-off local seed: completions data for emily@hartwellpartners.co.uk so the
// reworked Completions page can be viewed on :3001 (staging DB). Idempotent —
// deletes its own prior rows (address marker) before re-creating. NOT committed.
//
// Run (idempotent — re-run any time; tsconfig.seed.json stubs out `server-only`):
//   TS_NODE_PROJECT=tsconfig.seed.json npx dotenv -e .env --override -- \
//     ts-node --transpile-only -r tsconfig-paths/register scripts/seed-emily-completions.ts

import { PrismaClient, type Tenure, type PurchaseType } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const MARKER = "· Hartwell Demo";

function at(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

type Fx = {
  address: string;
  price: number;        // pence
  fee: number;          // agent commission pence
  tenure: Tenure;
  purchaseType: PurchaseType;
  completionIn: number; // days from today (negative = past)
  exchangedAgo: number; // days ago the file exchanged
  status: "active" | "completed";
  onTime?: boolean;     // completed files: did it hit the 12-week target
  chainOf?: number;     // for the "part of a chain" line + week-ahead chain flag
  keysReleased?: boolean;
  vendor: string;
  purchaser: string;
};

const FIXTURES: Fx[] = [
  // ── Heading to completion (active, exchanged) ──────────────────────────────
  { address: `4 Bosanquet Road, Hoddesdon, EN11 8PX ${MARKER}`, price: 56_500000, fee: 452000, tenure: "freehold",  purchaseType: "mortgage",   completionIn: 0,  exchangedAgo: 9,  status: "active", chainOf: 3, keysReleased: false, vendor: "Margaret Whitfield", purchaser: "James & Priya Okafor" },
  { address: `12 Highfield Close, Ware, SG12 7AB ${MARKER}`,     price: 42_000000, fee: 378000, tenure: "freehold",  purchaseType: "mortgage",   completionIn: 3,  exchangedAgo: 6,  status: "active", vendor: "Daniel Reeves", purchaser: "Sophie Clarke" },
  { address: `2 Demask Court, Hertford, SG14 1QN ${MARKER}`,     price: 38_500000, fee: 346000, tenure: "leasehold", purchaseType: "mortgage",   completionIn: 4,  exchangedAgo: 8,  status: "active", chainOf: 2, vendor: "Alan & Jean Mercer", purchaser: "Tom Bexley" },
  { address: `88 Launcelot Road, Broxbourne, EN10 7BS ${MARKER}`,price: 61_000000, fee: 540000, tenure: "freehold",  purchaseType: "cash_buyer", completionIn: 9,  exchangedAgo: 5,  status: "active", vendor: "The Harrow Estate", purchaser: "Nadia Rahman" },
  { address: `31 Amwell Lane, Stanstead Abbotts, SG12 8BZ ${MARKER}`, price: 47_250000, fee: 402000, tenure: "freehold", purchaseType: "mortgage", completionIn: 11, exchangedAgo: 4, status: "active", vendor: "Peter Voss", purchaser: "Grace & Leo Adeyemi" },
  { address: `7 Rye Street, Bishop's Stortford, CM23 2HG ${MARKER}`, price: 33_950000, fee: 305000, tenure: "freehold", purchaseType: "mortgage", completionIn: -3, exchangedAgo: 12, status: "active", vendor: "Linda Castillo", purchaser: "Owen Pryce" },

  // ── Completed (status completed → momentum + history) ──────────────────────
  { address: `19 Castle Mead, Hertford, SG14 1HD ${MARKER}`,     price: 52_000000, fee: 468000, tenure: "freehold",  purchaseType: "mortgage",   completionIn: -2,  exchangedAgo: 7,  status: "completed", onTime: true,  vendor: "Robert Finch", purchaser: "Aisha & Sam Idowu" },
  { address: `5 Mill Bridge, Hertford, SG14 1PY ${MARKER}`,      price: 44_500000, fee: 400000, tenure: "freehold",  purchaseType: "mortgage",   completionIn: -5,  exchangedAgo: 10, status: "completed", onTime: true,  vendor: "Helen Marsh", purchaser: "David Oakley" },
  { address: `40 Fanshawe Street, Hertford, SG14 3BA ${MARKER}`, price: 39_000000, fee: 351000, tenure: "leasehold", purchaseType: "mortgage",   completionIn: -12, exchangedAgo: 19, status: "completed", onTime: false, vendor: "Carl Weston", purchaser: "Megan Hartley" },
  { address: `2 Cowbridge, Hertford, SG14 1PG ${MARKER}`,        price: 58_750000, fee: 528000, tenure: "freehold",  purchaseType: "cash_buyer", completionIn: -20, exchangedAgo: 28, status: "completed", onTime: true,  vendor: "The Delamere Trust", purchaser: "Victoria Lund" },
];

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "emily@hartwellpartners.co.uk" }, select: { id: true, agencyId: true } });
  if (!user?.agencyId) throw new Error("emily@hartwellpartners.co.uk not found or has no agency");
  const ownerUserId = user.id;
  const agencyId = user.agencyId;

  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const completionDefIds = defs.filter((d) => d.code === "VM20" || d.code === "PM27").map((d) => d.id);

  // ── Clean up any previous run (cascade children first) ──────────────────────
  const prior = await prisma.propertyTransaction.findMany({ where: { agencyId, propertyAddress: { contains: MARKER } }, select: { id: true } });
  const priorIds = prior.map((p) => p.id);
  if (priorIds.length) {
    await prisma.propertyTransaction.updateMany({ where: { id: { in: priorIds } }, data: { activeBuyerRoundId: null } });
    await prisma.reminderLog.deleteMany({ where: { transactionId: { in: priorIds } } }).catch(() => {});
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: { in: priorIds } } });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: { in: priorIds } } });
    await prisma.buyerRound.deleteMany({ where: { transactionId: { in: priorIds } } });
    await prisma.propertyTransaction.deleteMany({ where: { id: { in: priorIds } } });
    console.log(`cleaned ${priorIds.length} prior seeded file(s)`);
  }

  const { initializeMilestoneCompletions } = await import("../lib/services/milestones");

  let made = 0;
  for (const fx of FIXTURES) {
    const exchangeDate = at(-fx.exchangedAgo);
    const completionDate = at(fx.completionIn);
    // 12-week target: on-time completed files land on/before it; late ones after.
    const twelveWeekTarget = fx.status === "completed"
      ? at(fx.completionIn + (fx.onTime ? 7 : -9))
      : at(fx.completionIn + 3);

    const tx = await prisma.$transaction(async (ptx) => {
      const created = await ptx.propertyTransaction.create({
        data: {
          propertyAddress: fx.address,
          agencyId,
          assignedUserId: ownerUserId,
          agentUserId: ownerUserId,
          progressedBy: "agent",
          serviceType: "self_managed",
          status: fx.status,
          tenure: fx.tenure,
          purchaseType: fx.purchaseType,
          purchasePrice: fx.price,
          agentFeeAmount: fx.fee,
          agentFeeIsVatInclusive: false,
          freeOnExchange: false,
          exchangedAt: exchangeDate,
          completionDate,
          expectedExchangeDate: exchangeDate,
          twelveWeekTarget,
          keysReleasedAt: fx.keysReleased ? completionDate : null,
          createdAt: at(-(fx.exchangedAgo + 70)),
          lastActivityAt: exchangeDate,
        },
      });
      const round = await ptx.buyerRound.create({
        data: { transactionId: created.id, roundNumber: 1, status: "active", purchasePrice: created.purchasePrice },
      });
      return ptx.propertyTransaction.update({ where: { id: created.id }, data: { activeBuyerRoundId: round.id } });
    });

    await prisma.contact.create({ data: { propertyTransactionId: tx.id, name: fx.vendor, email: `v-${randomUUID().slice(0, 8)}@hartwell-demo.test`, phone: "07700 900100", roleType: "vendor", portalToken: randomUUID(), buyerRoundId: null } });
    await prisma.contact.create({ data: { propertyTransactionId: tx.id, name: fx.purchaser, email: `p-${randomUUID().slice(0, 8)}@hartwell-demo.test`, phone: "07700 900200", roleType: "purchaser", portalToken: randomUUID(), buyerRoundId: tx.activeBuyerRoundId } });

    await initializeMilestoneCompletions(tx.id, fx.tenure, fx.purchaseType, ownerUserId, tx.activeBuyerRoundId, prisma);

    // Everything up to and including exchange → complete (dated at exchange).
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: tx.id, NOT: { state: "not_required" }, milestoneDefinitionId: { notIn: completionDefIds } },
      data: { state: "complete", completedAt: exchangeDate },
    });
    // Completed files: completion steps (VM20/PM27) complete too, dated at completion.
    if (fx.status === "completed") {
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: tx.id, NOT: { state: "not_required" }, milestoneDefinitionId: { in: completionDefIds } },
        data: { state: "complete", completedAt: completionDate },
      });
    }
    made++;
    console.log(`  ✓ ${fx.status.padEnd(9)} ${fx.address.replace(" " + MARKER, "")}`);
  }

  console.log(`\nDone — ${made} files for Emily (Hartwell & Partners). View at /agent/completions on :3001.`);
}

main().finally(() => prisma.$disconnect());
