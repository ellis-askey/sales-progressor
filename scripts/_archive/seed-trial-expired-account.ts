// One-off: seed a staging account in the exact state required to trigger
// the TrialExpiredModal on /agent/transactions/new-v2:
//
//   - Agency with firstSubmissionAt = 30 days ago, no stripeCustomerId
//   - One past transaction so firstSubmissionAt was actually set
//   - Director user belonging to that agency, known credentials
//
// Run:
//   DATABASE_URL=<staging> npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' --require tsconfig-paths/register scripts/seed-trial-expired-account.ts

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "trial-expired-director@spotcheck.test";
const PASSWORD = "TrialExpired2026!";
const AGENCY_NAME = "Trial Expired Spot Check Agency";

async function main() {
  const passwordHash = await hash(PASSWORD, 12);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Upsert agency
  let agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME } });
  if (agency) {
    agency = await prisma.agency.update({
      where: { id: agency.id },
      data: {
        firstSubmissionAt: thirtyDaysAgo,
        stripeCustomerId: null,
        paymentFailedAt: null,
        newFileCreationBlockedAt: null,
        chaseEmailsEnabled: true,
      },
    });
    console.log(`Reused agency ${agency.id}`);
  } else {
    agency = await prisma.agency.create({
      data: {
        name: AGENCY_NAME,
        firstSubmissionAt: thirtyDaysAgo,
        modeProfile: "self_progressed",
      },
    });
    console.log(`Created agency ${agency.id}`);
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      password: passwordHash,
      name: "Trial Expired Director",
      role: "director",
      agencyId: agency.id,
    },
    update: {
      password: passwordHash,
      agencyId: agency.id,
      role: "director",
      emailUnsubscribedAt: null,
    },
  });
  console.log(`User: ${user.id} (${user.email})`);

  // Ensure at least one prior transaction so firstSubmissionAt is meaningful.
  const existingTx = await prisma.propertyTransaction.findFirst({
    where: { agencyId: agency.id },
  });
  if (!existingTx) {
    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: "1 Trial Past Lane, London, SW1A 1AA",
        agencyId: agency.id,
        agentUserId: user.id,
        status: "active",
        tenure: "freehold",
        purchaseType: "cash_buyer",
        serviceType: "self_managed",
        progressedBy: "agent",
        freeOnExchange: true,
        purchasePrice: 35000000,
        createdAt: thirtyDaysAgo,
      },
    });
    console.log(`Seeded historical tx ${tx.id} on agency`);
  }

  console.log("\n=== Login details ===");
  console.log(`URL:      https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app/login`);
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log("");
  console.log("After login, click 'New sale' in the sidebar — the");
  console.log("TrialExpiredModal should appear in place of the form.");

  await prisma.$disconnect();
}

main().catch((err) => { console.error("FATAL", err); process.exit(1); });
