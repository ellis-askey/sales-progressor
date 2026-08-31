// STAGING ONLY. Seeds a chain-invite demo so phases 1-6 (minus Command Centre)
// can be seen end to end:
//   - a demo agency + director you can log in as (Phase 4 file nudge)
//   - an originator file with a live chain
//   - one FRESH invite to click through   -> Phase 1 (sign-up) + 2 + 6 (welcome)
//   - one delivered-but-unopened invite    -> Phase 3 auto-nudge (reminder email)
//   - one neighbour added but NOT invited   -> Phase 4 "not invited yet" nudge
// Sends real emails to burner inboxes. Guarded against prod. Delete after.
//
// Run:
//   npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-chain-invite-demo.ts

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { createDirectorWithAgency } from "../lib/auth/create-director-with-agency";
import { createChainV2 } from "../lib/services/chains";
import { initializeMilestoneCompletions } from "../lib/services/milestones";
import { randomBytes } from "node:crypto";

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3001";
const DEMO_EMAIL = "ellisaskey+chaindemo@googlemail.com";
const DEMO_PASSWORD = "ChainDemo2026";
const BURNER_CLAIM = "ellisaskey+chainclaim@googlemail.com";
const BURNER_NUDGE = "ellisaskey+chainnudge@googlemail.com";
const BURNER_UNINVITED = "ellisaskey+chainuninvited@googlemail.com";

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to run on PRODUCTION");
  // Invite + nudge email links (and the links printed below) must point at staging.
  process.env.NEXTAUTH_URL = BASE_URL;

  // Fresh, isolated run every time: unique suffix so re-running never collides.
  const suffix = Math.floor(Date.now() / 1000).toString(36);
  const demoEmail = DEMO_EMAIL.replace("@", `+${suffix}@`);
  // The claimed invite must go to an address with NO existing account, so the
  // link lands on the fresh sign-up flow (not "log in to claim").
  const claimEmail = BURNER_CLAIM.replace("@", `+${suffix}@`);

  // 1) Demo agency + director you can log in as.
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const { userId, agencyId } = await createDirectorWithAgency({
    name: "Dana Rivers",
    email: demoEmail,
    password: passwordHash,
    role: "director",
    agencyName: "Riverside Demo Estates",
  });
  // Give the agency an authenticated sender so the invite from-name is agency-branded
  // ("Dana at Riverside Demo Estates"). Uses the verified SP address to actually send.
  await prisma.agency.update({ where: { id: agencyId }, data: { quoteSenderEmail: "updates@thesalesprogressor.co.uk" } });

  // 2) The originator's own file (self-managed).
  const originTxn = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "24 Mill Lane, Riverside, RV2 4PP",
      agencyId, agentUserId: userId, progressedBy: "agent",
      serviceType: "self_managed", status: "active",
      tenure: "freehold", purchaseType: "mortgage", isShareOfFreehold: false,
    },
    select: { id: true },
  });
  const round = await prisma.buyerRound.create({
    data: { transactionId: originTxn.id, roundNumber: 1, status: "active" },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({ where: { id: originTxn.id }, data: { activeBuyerRoundId: round.id } });
  await initializeMilestoneCompletions(originTxn.id, "freehold", "mortgage", userId, round.id);

  // 3) Build the chain: two sales above (one to invite fresh, one to nudge) and one
  //    below (added with an email but never invited).
  await createChainV2({
    transactionId: originTxn.id,
    agencyId,
    userId,
    stubs: [
      { direction: "above", stubPropertyAddress: "8 Bridge Court, Riverside, RV1 1AA", stubAgencyName: "Bridgeview Lettings", stubAgentEmail: claimEmail, stubAgentName: "Sam Bridge", stubAgentPhone: null, stubNotes: null },
      { direction: "above", stubPropertyAddress: "12 Canal Street, Riverside, RV1 2BB", stubAgencyName: "Canalside Homes", stubAgentEmail: BURNER_NUDGE, stubAgentName: "Priya Canal", stubAgentPhone: null, stubNotes: null },
      { direction: "below", stubPropertyAddress: "3 Weir Close, Riverside, RV3 9ZZ", stubAgencyName: "Weirbank Property", stubAgentEmail: BURNER_UNINVITED, stubAgentName: "Tom Weir", stubAgentPhone: null, stubNotes: null },
    ],
  });

  // Set the invite token directly on the stub to click — no email sent.
  const chainLink = await prisma.chainLink.findFirst({ where: { transactionId: originTxn.id }, select: { chainId: true } });
  const claimStub = await prisma.chainLink.findFirst({ where: { chainId: chainLink!.chainId, stubAgentEmail: claimEmail }, select: { id: true } });
  const claimToken = randomBytes(32).toString("hex");
  await prisma.chainLink.update({
    where: { id: claimStub!.id },
    data: {
      inviteToken: claimToken,
      inviteStatus: "SENT",
      inviteSentAt: new Date(),
      inviteTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      inviteResendCount: 1,
      lastInviteSentByUserId: userId,
    },
  });
  // The other two stubs stay NOT_SENT -> they show on the file as "not invited yet" (Phase 4).

  console.log("\n=== Chain-invite demo seeded (no emails) ===\n");
  console.log("SIGN-UP flow (Phase 1 / 2 / 6) — click to run through:");
  console.log(`  ${BASE_URL}/claim?token=${claimToken}\n`);
  console.log("PHASE 4 file — log in as the demo agent:");
  console.log(`  ${BASE_URL}/login`);
  console.log(`  email:    ${demoEmail}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  file:     ${BASE_URL}/agent/transactions/${originTxn.id}\n`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
