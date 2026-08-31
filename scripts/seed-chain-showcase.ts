// STAGING ONLY. Throwaway visual showcase for the chain drawer / LinkCard so the
// new chain-node intel (step 1), buyer-position badge + onward summary (step 2),
// and the whole-card expand can be seen fully populated with maximum variation.
//
// Builds ONE chain, top to bottom:
//   pos TOP   — full-intel INVITED stub (break-chain PREPARED + all fields)
//   ...       — other-agency CLAIMED link, mortgage (no badge, cross-agency privacy)
//   MIDDLE    — YOUR OWN claimed file: full intel + onward summary + ~55% progress
//   ...       — other-agency CLAIMED link, cash + first-time buyer (badge shown)
//   ...       — half-intel stub, email present but NOT invited
//   BOTTOM    — empty stub, no email ("Email needed"), no intel (empty/add state)
//
// No emails are sent (invite tokens set directly). Guarded against production.
// Delete this script after viewing; the seeded data can stay or be removed.
//
// Run:
//   npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-chain-showcase.ts

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createDirectorWithAgency } from "../lib/auth/create-director-with-agency";
import { createChainV2 } from "../lib/services/chains";
import { initializeMilestoneCompletions } from "../lib/services/milestones";
import { setOnwardTypeFacts } from "../lib/services/onward";
import type { Tenure, PurchaseType } from "@prisma/client";

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3001";
const PASSWORD = "ChainShowcase2026";

// Set a rough progress % on a file by marking the first `fraction` of its
// applicable milestone completions complete (weighted % is approximate — this is
// a visual demo, not real progression, so we bypass completeMilestone and its
// side effects entirely).
async function setProgress(transactionId: string, fraction: number) {
  const comps = await prisma.milestoneCompletion.findMany({
    where: { transactionId, state: { not: "not_required" } },
    select: { id: true, milestoneDefinition: { select: { orderIndex: true } } },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });
  const n = Math.floor(comps.length * fraction);
  const ids = comps.slice(0, n).map((c) => c.id);
  if (ids.length) {
    await prisma.milestoneCompletion.updateMany({
      where: { id: { in: ids } },
      data: { state: "complete", completedAt: new Date() },
    });
  }
}

async function makeFile(
  agencyId: string,
  userId: string,
  address: string,
  tenure: Tenure,
  purchaseType: PurchaseType,
  opts: { firstTimeBuyer?: boolean; priceGBP?: number },
): Promise<string> {
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
      clientFirstTimeBuyer: opts.firstTimeBuyer ?? null,
      purchasePrice: opts.priceGBP != null ? opts.priceGBP * 100 : null,
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
  return tx.id;
}

// Convert an unclaimed stub (found by its agency name) into a link claimed by
// another agency's file — the cross-agency case (badge shared, intel + price
// hidden from our viewer).
async function claimStubWithOtherFile(
  chainId: string,
  stubAgentEmail: string,
  txId: string,
  claimerUserId: string,
) {
  const stub = await prisma.chainLink.findFirst({
    where: { chainId, stubAgentEmail },
    select: { id: true },
  });
  if (!stub) throw new Error(`stub not found: ${stubAgentEmail}`);
  await prisma.chainLink.update({
    where: { id: stub.id },
    data: {
      transactionId: txId,
      claimedByUserId: claimerUserId,
      claimedAt: new Date(),
      inviteStatus: "CLAIMED",
    },
  });
  await prisma.propertyTransaction.update({ where: { id: txId }, data: { chainLinkId: stub.id } });
}

async function setIntel(
  chainId: string,
  stubAgentEmail: string,
  data: {
    breakChainStance?: "PREPARED" | "IF_REQUIRED" | "UNWILLING" | null;
    breakChainConditions?: string | null;
    expectedTimescale?: string | null;
    chainNotes?: string | null;
    lastChainCheckAt?: Date | null;
  },
) {
  const link = await prisma.chainLink.findFirst({
    where: { chainId, stubAgentEmail },
    select: { id: true },
  });
  if (!link) throw new Error(`link not found: ${stubAgentEmail}`);
  await prisma.chainLink.update({ where: { id: link.id }, data });
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
    throw new Error("Refusing to run on PRODUCTION");
  }
  process.env.NEXTAUTH_URL = BASE_URL;

  const suffix = Math.floor(Date.now() / 1000).toString(36);
  const loginEmail = `ellisaskey+chainshowcase+${suffix}@googlemail.com`;
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  // 1) Your login (agency A) + a second agency (B) for the cross-agency links.
  const you = await createDirectorWithAgency({
    name: "Dana Rivers",
    email: loginEmail,
    password: passwordHash,
    role: "director",
    agencyName: "Marlowe Prime",
  });
  await prisma.user.update({ where: { id: you.userId }, data: { firmName: "Marlowe Prime" } });

  const other = await createDirectorWithAgency({
    name: "Morgan Hale",
    email: `morgan+chainshowcase+${suffix}@example.com`,
    password: passwordHash,
    role: "director",
    agencyName: "Hillcrest Estates",
  });
  await prisma.user.update({ where: { id: other.userId }, data: { firmName: "Hillcrest Estates" } });

  // 2) Your own file (the star card): leasehold, buying onward from proceeds.
  const yourTx = await makeFile(you.agencyId, you.userId, "9 Priory Gardens, Marlowe, ML3 6RD", "leasehold", "cash_from_proceeds", { priceGBP: 425000 });

  // 3) Build the chain around it: 2 above, 3 below.
  await createChainV2({
    transactionId: yourTx,
    agencyId: you.agencyId,
    userId: you.userId,
    stubs: [
      { direction: "above", stubPropertyAddress: "14 Beacon Hill, Marlowe, ML5 7QA", stubAgencyName: "Beacon & Vale", stubAgentEmail: "aisha@example.com", stubAgentName: "Aisha Bello", stubAgentPhone: "01632 960014", stubNotes: "Chased 2 Sept, awaiting solicitor pack." },
      { direction: "above", stubPropertyAddress: "27 Foundry Road, Marlowe, ML4 2HT", stubAgencyName: "Hillcrest Estates", stubAgentEmail: "foundry@example.com", stubAgentName: "Morgan Hale", stubAgentPhone: null, stubNotes: null },
      { direction: "below", stubPropertyAddress: "5 Anchor Mews, Marlowe, ML2 1WB", stubAgencyName: "Hillcrest Estates", stubAgentEmail: "anchor@example.com", stubAgentName: "Morgan Hale", stubAgentPhone: null, stubNotes: null },
      { direction: "below", stubPropertyAddress: "41 Sydenham Terrace, Marlowe, ML6 8LP", stubAgencyName: "Sydenham Homes", stubAgentEmail: "tom@example.com", stubAgentName: "Tom Weir", stubAgentPhone: "01632 960041", stubNotes: null },
      { direction: "below", stubPropertyAddress: "2 Kiln Row, Marlowe, ML7 3JX", stubAgencyName: "Kiln Row Lettings", stubAgentEmail: null, stubAgentName: null, stubAgentPhone: null, stubNotes: null },
    ],
  });

  const link = await prisma.chainLink.findFirst({ where: { transactionId: yourTx }, select: { chainId: true } });
  const chainId = link!.chainId;

  // 4) Cross-agency claimed links (badge shown; intel + price hidden from you).
  //    Foundry Road = mortgage buyer (no badge), ~40%.
  const foundryTx = await makeFile(other.agencyId, other.userId, "27 Foundry Road, Marlowe, ML4 2HT", "freehold", "mortgage", { priceGBP: 560000 });
  await setProgress(foundryTx, 0.4);
  await claimStubWithOtherFile(chainId, "foundry@example.com", foundryTx, other.userId);

  //    Anchor Mews = cash + first-time buyer (badge "Cash buyer"), ~80%.
  const anchorTx = await makeFile(other.agencyId, other.userId, "5 Anchor Mews, Marlowe, ML2 1WB", "freehold", "cash_buyer", { firstTimeBuyer: true, priceGBP: 310000 });
  await setProgress(anchorTx, 0.8);
  await claimStubWithOtherFile(chainId, "anchor@example.com", anchorTx, other.userId);

  // 5) Your own file: ~55% progress + full intel + onward tracker.
  await setProgress(yourTx, 0.55);
  await prisma.chainLink.updateMany({
    where: { transactionId: yourTx },
    data: {
      breakChainStance: "IF_REQUIRED",
      breakChainConditions: "Would consider breaking if the onward falls through, but would rather keep it together.",
      expectedTimescale: "On track. Searches back, awaiting mortgage offer on the onward.",
      chainNotes: "Our client. Onward purchase progressing (see the onward panel). Chase weekly.",
      lastChainCheckAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });
  // Onward tracker: mortgage/freehold, three early steps reported.
  await setOnwardTypeFacts(yourTx, { tenure: "freehold", purchaseType: "mortgage", isShareOfFreehold: false });
  const tracker = await prisma.onwardTracker.findUnique({ where: { transactionId_kind: { transactionId: yourTx, kind: "onward_purchase" } }, select: { id: true } });
  const pdefs = await prisma.milestoneDefinition.findMany({ where: { side: "purchaser" }, orderBy: { orderIndex: "asc" }, select: { code: true }, take: 3 });
  for (const d of pdefs) {
    await prisma.onwardStepConfirmation.create({
      data: { trackerId: tracker!.id, milestoneCode: d.code, source: "agent", confirmedByUserId: you.userId },
    });
  }

  // 6) Full-intel INVITED stub (Beacon & Vale, top).
  await setIntel(chainId, "aisha@example.com", {
    breakChainStance: "PREPARED",
    breakChainConditions: "Happy to move into a short-term rental if it keeps the chain together.",
    expectedTimescale: "Aiming to exchange within 4 to 6 weeks. Possible probate delay flagged.",
    chainNotes: "Top of the chain, proceedable and keen. Solicitor is Hartley & Co, responsive.",
    lastChainCheckAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  });
  const beacon = await prisma.chainLink.findFirst({ where: { chainId, stubAgentEmail: "aisha@example.com" }, select: { id: true } });
  await prisma.chainLink.update({
    where: { id: beacon!.id },
    data: {
      inviteStatus: "SENT",
      inviteSentAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      inviteToken: randomBytes(32).toString("hex"),
      inviteTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      inviteResendCount: 1,
      lastInviteSentByUserId: you.userId,
    },
  });

  // 7) Half-intel stub, email present but NOT invited (Sydenham Homes).
  await setIntel(chainId, "tom@example.com", {
    breakChainStance: "UNWILLING",
    chainNotes: "Second-hand from the agent, needs verifying on the next call.",
  });

  // 8) Kiln Row Lettings stays an empty stub with no email — the "Email needed"
  //    empty state; expanding it shows "No chain details recorded yet" + Add.

  console.log("\n=== Chain showcase seeded ===\n");
  console.log("Log in:");
  console.log(`  ${BASE_URL}/login`);
  console.log(`  email:    ${loginEmail}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`\nOpen the file, then open the chain drawer:`);
  console.log(`  ${BASE_URL}/agent/transactions/${yourTx}\n`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
