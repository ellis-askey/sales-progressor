// One-off: seed the 39a Darnley Road transaction (cmpf7o8u40005136353v6b2l2)
// to show every possible state of the new contact-card UI in one screen.
//
// Wires up three contacts (adds one new "never contacted" contact) with
// distinct states:
//
//   Mildred (Purchaser)  → "FRESH + OVER-CHASED"
//     - phone + email + portalToken + lastVisitedPortalAt recent
//     - 1 manual phone log "now"           → "Contacted today" GREEN pill
//     - 5 automated chase emails (last 5d) → "5 chases this week" RED pill
//     - Portal viewed 2 days ago           → "Viewed 2d ago" hint
//
//   Adele (Vendor)       → "STALE / AMBER"
//     - phone + email + portalToken + lastVisitedPortalAt older
//     - 1 manual email 25 days ago         → "Last contacted 3w ago" AMBER
//     - No recent chases                   → no chase pill
//
//   Connor Riley (NEW)   → "NEVER CONTACTED"
//     - phone + email + portalToken
//     - No comms anywhere                  → "Not contacted yet" DASHED pill
//
// Idempotent: deletes prior seed-script OutboundMessage rows tagged with
// content prefix "[card-demo]" before reinserting, so re-running yields
// the same visible state.

import { PrismaClient } from "@prisma/client";

const TX_ID = "cmpf7o8u40005136353v6b2l2";
const MILDRED_ID = "cmpf7o93z000713633e9nxye2";
const ADELE_ID = "cmpf7o93z00061363fpsh9sib";
const SEED_TAG = "[card-demo]";

async function main() {
  const prisma = new PrismaClient();
  try {
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: TX_ID },
      select: { id: true, agencyId: true, agentUserId: true },
    });
    if (!tx) throw new Error(`Transaction ${TX_ID} not found`);
    const { agencyId, agentUserId } = tx;

    const now = new Date();
    const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    // ── Step 1: ensure phone + email on both existing contacts ──────────────
    await prisma.contact.update({
      where: { id: MILDRED_ID },
      data: {
        phone: "07700 900111",
        email: "seed-mildred@spot-check.test",
        lastVisitedPortalAt: daysAgo(2),
      },
    });
    await prisma.contact.update({
      where: { id: ADELE_ID },
      data: {
        phone: "07700 900222",
        lastVisitedPortalAt: daysAgo(21),
      },
    });

    // ── Step 2: upsert third "never contacted" contact (Connor) ─────────────
    const connor = await prisma.contact.findFirst({
      where: { propertyTransactionId: TX_ID, name: "Mr Connor Riley" },
      select: { id: true },
    });
    let connorId: string;
    if (connor) {
      connorId = connor.id;
      await prisma.contact.update({
        where: { id: connor.id },
        data: {
          phone: "07700 900333",
          email: "seed-connor@spot-check.test",
          portalToken: connor.id ? undefined : crypto.randomUUID(),
          lastVisitedPortalAt: null,
        },
      });
    } else {
      const created = await prisma.contact.create({
        data: {
          propertyTransactionId: TX_ID,
          name: "Mr Connor Riley",
          roleType: "vendor",
          phone: "07700 900333",
          email: "seed-connor@spot-check.test",
          portalToken: crypto.randomUUID(),
        },
        select: { id: true },
      });
      connorId = created.id;
    }

    // ── Step 3: wipe prior demo OutboundMessage rows so re-runs are clean ───
    const deleted = await prisma.outboundMessage.deleteMany({
      where: { transactionId: TX_ID, content: { startsWith: SEED_TAG } },
    });

    // ── Step 4: insert fresh comms events ───────────────────────────────────
    // Mildred — 1 manual phone "now" (green pill driver). channel must be
    // one of {email, sms, linkedin, twitter, in_app, other}; method
    // captures the actual modality (phone here).
    await prisma.outboundMessage.create({
      data: {
        agencyId,
        transactionId: TX_ID,
        channel: "other",
        purpose: "chase",
        status: "sent",
        type: "outbound",
        method: "phone",
        contactIds: [MILDRED_ID],
        content: `${SEED_TAG} Logged a quick check-in call.`,
        isAutomated: false,
        createdById: agentUserId,
        sentAt: minutesAgo(5),
      },
    });

    // Mildred — 5 automated chase emails spread across the last 5 days
    // (drives the red "5 chases this week" pill — RED at >=5).
    for (let i = 0; i < 5; i += 1) {
      await prisma.outboundMessage.create({
        data: {
          agencyId,
          transactionId: TX_ID,
          channel: "email",
          purpose: "chase",
          status: "delivered",
          type: "outbound",
          method: "email",
          contactIds: [MILDRED_ID],
          content: `${SEED_TAG} Automated client chase email #${i + 1}`,
          subject: "Update on 39a Darnley Road",
          isAutomated: true,
          createdById: agentUserId,
          sentAt: daysAgo(i + 1),
        },
      });
    }

    // Adele — 1 manual email 25 days ago (amber pill driver)
    await prisma.outboundMessage.create({
      data: {
        agencyId,
        transactionId: TX_ID,
        channel: "email",
        purpose: "chase",
        status: "delivered",
        type: "outbound",
        method: "email",
        contactIds: [ADELE_ID],
        content: `${SEED_TAG} Initial nudge to seller about the welcome pack.`,
        subject: "Welcome pack for 39a Darnley Road",
        isAutomated: false,
        createdById: agentUserId,
        sentAt: daysAgo(25),
      },
    });

    console.log("");
    console.log("=========================================================");
    console.log(`  Card-demo seed applied to ${TX_ID}`);
    console.log("=========================================================");
    console.log(`  Wiped ${deleted.count} prior seed rows`);
    console.log("");
    console.log("  Mildred (Purchaser)  → green 'Contacted today' + red '5 chases this week' + 'Viewed 2d ago'");
    console.log("  Adele   (Vendor)     → amber 'Last contacted 3w ago' + 'Viewed 3w ago'");
    console.log(`  Connor  (Vendor, ${connorId.slice(-6)}) → dashed 'Not contacted yet'`);
    console.log("");
    console.log("  Open: http://localhost:3001/agent/transactions/cmpf7o8u40005136353v6b2l2");
    console.log("=========================================================");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
