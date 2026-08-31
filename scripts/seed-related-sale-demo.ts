// STAGING ONLY. Throwaway spotcheck seed for the buyer "related sale" feature
// (the mirror of the seller onward tracker). Builds two files so both states of
// the new "Related sale" card / "Your sale" portal panel can be seen:
//
//   File A — related sale SET UP: leasehold, buyer selling to fund the purchase,
//            a chain link below (the property they're selling), and VM1-VM5
//            reported. Shows the populated agent card + the buyer portal panel.
//   File B — related sale SIGNAL ONLY: buyer is selling (cash from proceeds) but
//            nothing set up yet. Shows the agent "Set up sale tracking" prompt +
//            the buyer portal setup panel + the "Are you also selling?" question.
//
// No emails are sent. Guarded against production. Delete after viewing.
//
// Run:
//   npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-related-sale-demo.ts

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createDirectorWithAgency } from "../lib/auth/create-director-with-agency";
import { createChainV2 } from "../lib/services/chains";
import { initializeMilestoneCompletions } from "../lib/services/milestones";
import { setOnwardTypeFacts } from "../lib/services/onward";
import type { Tenure, PurchaseType } from "@prisma/client";

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3001";
const PASSWORD = "RelatedSale2026";

async function makeFile(
  agencyId: string,
  userId: string,
  address: string,
  tenure: Tenure,
  purchaseType: PurchaseType,
): Promise<{ txId: string; roundId: string }> {
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: address,
      agencyId,
      agentUserId: userId,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure,
      purchaseType,
      isShareOfFreehold: false,
    },
    select: { id: true },
  });
  const round = await prisma.buyerRound.create({
    data: { transactionId: tx.id, roundNumber: 1, status: "active" },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: { activeBuyerRoundId: round.id },
  });
  await initializeMilestoneCompletions(tx.id, tenure, purchaseType, userId, round.id);
  return { txId: tx.id, roundId: round.id };
}

// A purchaser (buyer) contact with a portal token, so we get a working /portal link.
async function makeBuyerContact(txId: string, roundId: string, name: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await prisma.contact.create({
    data: {
      propertyTransactionId: txId,
      buyerRoundId: roundId,
      name,
      roleType: "purchaser",
      email: null,
      portalToken: token,
    },
  });
  return token;
}

// Report the given VM codes on the related-sale tracker (agent-sourced, bypassing
// the per-step gate — this is a visual demo).
async function reportRelatedSaleSteps(txId: string, userId: string, codes: string[]) {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId: txId, kind: "related_sale" } },
    select: { id: true },
  });
  if (!tracker) throw new Error("related_sale tracker not found");
  for (const code of codes) {
    await prisma.onwardStepConfirmation.create({
      data: { trackerId: tracker.id, milestoneCode: code, source: "agent", confirmedByUserId: userId },
    });
  }
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
    throw new Error("Refusing to run on PRODUCTION");
  }
  process.env.NEXTAUTH_URL = BASE_URL;

  const suffix = Math.floor(Date.now() / 1000).toString(36);
  const loginEmail = `ellisaskey+relatedsale+${suffix}@googlemail.com`;
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  const you = await createDirectorWithAgency({
    name: "Dana Rivers",
    email: loginEmail,
    password: passwordHash,
    role: "director",
    agencyName: "Marlowe Prime",
  });
  await prisma.user.update({ where: { id: you.userId }, data: { firmName: "Marlowe Prime" } });

  // ── File A: related sale SET UP, VM1-VM5 reported, chain link below ──────────
  const a = await makeFile(you.agencyId, you.userId, "9 Priory Gardens, Marlowe, ML3 6RD", "leasehold", "cash_from_proceeds");
  const aToken = await makeBuyerContact(a.txId, a.roundId, "Priya Sharma");
  // A chain link below = the property they're selling (gives the related address).
  await createChainV2({
    transactionId: a.txId,
    agencyId: you.agencyId,
    userId: you.userId,
    stubs: [
      { direction: "below", stubPropertyAddress: "5 Anchor Mews, Marlowe, ML2 1WB", stubAgencyName: "Hillcrest Estates", stubAgentEmail: "anchor@example.com", stubAgentName: "Morgan Hale", stubAgentPhone: null, stubNotes: null },
    ],
  });
  // Related sale = leasehold (so VM8/VM9 appear), report the first five steps.
  await setOnwardTypeFacts(a.txId, { tenure: "leasehold", isShareOfFreehold: false }, "related_sale");
  await reportRelatedSaleSteps(a.txId, you.userId, ["VM1", "VM2", "VM3", "VM4", "VM5"]);
  // Record the "yes, also selling" answer so the portal Information tab reflects it.
  await prisma.clientMoveInfo.upsert({
    where: { transactionId_side: { transactionId: a.txId, side: "purchaser" } },
    create: { transactionId: a.txId, side: "purchaser", sellingRelated: true },
    update: { sellingRelated: true },
  });

  // ── File B: signal only (cash from proceeds), nothing set up ─────────────────
  const b = await makeFile(you.agencyId, you.userId, "12 Kingfisher Lane, Marlowe, ML8 4NR", "freehold", "cash_from_proceeds");
  const bToken = await makeBuyerContact(b.txId, b.roundId, "Tom Weir");

  console.log("\n=== Related-sale spotcheck seeded (staging) ===\n");
  console.log("Log in as the agency (to see the file-side 'Related sale' card):");
  console.log(`  ${BASE_URL}/login`);
  console.log(`  email:    ${loginEmail}`);
  console.log(`  password: ${PASSWORD}`);
  console.log("");
  console.log("FILE A — related sale SET UP (VM1-VM5 reported, chain link below):");
  console.log(`  Agent file:   ${BASE_URL}/agent/transactions/${a.txId}`);
  console.log(`  Buyer portal: ${BASE_URL}/portal/${aToken}   (Progress tab -> swipe to 'Your sale'; Information tab -> 'Are you also selling?')`);
  console.log("");
  console.log("FILE B — signal only, nothing set up (shows the 'Set up sale tracking' prompt):");
  console.log(`  Agent file:   ${BASE_URL}/agent/transactions/${b.txId}`);
  console.log(`  Buyer portal: ${BASE_URL}/portal/${bToken}`);
  console.log("");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
