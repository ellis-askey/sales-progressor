// One-off staging seed for the referral-ledger demo (docs/active/referral-ledger).
// Creates an ON-HOLD self-managed file with buyer "Emily Chen" and a £450 broker
// referral that is EARNED (mortgage submitted / PM5 complete). Lets the founder
// see, in practice:
//   - the "Add new buyer" flow's reassurance note ("A £450 broker referral was
//     already earned on Emily Chen's sale ..."), and
//   - after relisting, the preserved referral in Emily's archived-sale drawer.
//
// Staging-only (refuses PROD). Run with the same invocation as demo:seed, e.g.
//   dotenv -e .env --override -- ts-node --transpile-only \
//     --compiler-options "{\"module\":\"CommonJS\",\"moduleResolution\":\"node\",\"esModuleInterop\":true,\"baseUrl\":\".\",\"paths\":{\"@/*\":[\"./*\"]}}" \
//     -r tsconfig-paths/register scripts/seed-emily-chen-referral.ts

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { initializeMilestoneCompletions } from "@/lib/services/milestones";

const ADDRESS = "12 Prospect Terrace, Bristol, BS6 5QR";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("gmkfustgwipgihpmpjpr")) throw new Error("ABORT: DATABASE_URL is PROD. Staging only.");
  console.log("Target:", url.replace(/:\/\/[^@]*@/, "://<redacted>@").slice(0, 70));

  const existing = await prisma.propertyTransaction.findFirst({ where: { propertyAddress: ADDRESS }, select: { id: true } });
  if (existing) {
    console.log(`Already seeded (${existing.id}). Delete it first to re-seed. Nothing to do.`);
    return;
  }

  // Pick the non-internal agency with the most files that has an agent user, so
  // the file lands somewhere the founder actually browses.
  const agencies = await prisma.agency.findMany({
    where: { isInternal: false },
    select: {
      id: true, name: true,
      _count: { select: { transactions: true } },
      users: { where: { role: { in: ["director", "negotiator"] } }, select: { id: true, name: true, email: true } },
    },
  });
  const candidate = agencies.filter((a) => a.users.length > 0).sort((a, b) => b._count.transactions - a._count.transactions)[0];
  if (!candidate) throw new Error("No non-internal agency with a director/negotiator user found on staging.");
  const agent = candidate.users[0];
  console.log(`Agency: ${candidate.name} (${candidate.id}) — agent ${agent.name} <${agent.email}>`);

  // Partner broker firm + contact (so the referral has a real firm behind it).
  const brokerFirm = await prisma.brokerFirm.create({ data: { name: "Southgate Mortgage Partners" } });
  const brokerContact = await prisma.brokerContact.create({
    data: { firmId: brokerFirm.id, name: "Daniel Price", phone: "0117 496 3300", email: "daniel@southgatemortgages.co.uk" },
  });
  await prisma.agencyPreferredBroker.upsert({
    where: { agencyId: candidate.id },
    create: { agencyId: candidate.id, brokerFirmId: brokerFirm.id, defaultReferralFeePence: 45000 },
    update: {}, // never clobber an agency's existing preferred broker
  });

  // Create the file through the real service (dual-writes a pending ledger row).
  const tx = await createTransaction({
    agencyId: candidate.id,
    agentUserId: agent.id,
    progressedBy: "agent",
    propertyAddress: ADDRESS,
    purchasePrice: 42_500_000, // £425,000
    tenure: "freehold",
    purchaseType: "mortgage",
    brokerFirmId: brokerFirm.id,
    brokerContactId: brokerContact.id,
    brokerReferralFee: 45_000, // £450
    purchaserBrokerReferral: true,
  });
  const roundId = tx.activeBuyerRoundId!;
  console.log(`Created file ${tx.id}, round ${roundId}`);

  await initializeMilestoneCompletions(tx.id, "freehold", "mortgage", agent.id, roundId);

  await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id, buyerRoundId: roundId, roleType: "purchaser",
      name: "Emily Chen", email: "emily.chen.demo@example.com", phone: "07700 900321",
      isPrincipal: true, portalToken: randomUUID(),
    },
  });
  await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id, roleType: "vendor",
      name: "Margaret Ellison", email: "margaret.ellison.demo@example.com", phone: "07700 900654",
      isPrincipal: true, portalToken: randomUUID(),
    },
  });

  // Mark PM5 (mortgage submitted) complete so the broker referral is genuinely
  // earned, and flip the ledger row to match (direct — no email side-effects).
  const pm5 = await prisma.milestoneCompletion.findFirst({
    where: { transactionId: tx.id, buyerRoundId: roundId, milestoneDefinition: { code: "PM5" } },
    select: { id: true },
  });
  if (pm5) {
    await prisma.milestoneCompletion.update({
      where: { id: pm5.id },
      data: { state: "complete", completedAt: new Date(), completedById: agent.id, eventDate: new Date() },
    });
  }
  await prisma.referral.updateMany({
    where: { transactionId: tx.id, kind: "buyer_broker", buyerRoundId: roundId },
    data: { status: "earned", earnedAt: new Date() },
  });

  // On hold → the "Add new buyer" banner (which opens the relist modal + note) shows.
  await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { status: "on_hold" } });

  console.log("\nDone. 'Emily Chen' file seeded ON HOLD with a £450 EARNED broker referral.");
  console.log(`  Agent file:    /agent/transactions/${tx.id}`);
  console.log(`  Internal file: /transactions/${tx.id}`);
  console.log(`  Log in as:     ${agent.email}`);
  console.log("  See the note:  open the file → on-hold banner → 'Add new buyer' → pick a reason → Next.");
  console.log("  See archived:  finish the new buyer, then open the previous-sale drawer for Emily.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
