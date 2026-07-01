/**
 * Trace: when did each Akeman user get created, and is there a negotiatorInvitation
 * record for Gemma and Ben? When was each accepted?
 * Read-only.
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.PROD_DATABASE_URL! } },
});

async function main() {
  console.log("─── Akeman users with createdAt ────────────────────────────");
  const users = await prisma.user.findMany({
    where: { agencyId: "cmou19l8j0000n4djh2enonr7" },
    select: {
      id: true, name: true, role: true,
      firmName: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));

  console.log("\n─── negotiatorInvitation rows for Akeman ──────────────────");
  const invites = await prisma.negotiatorInvitation.findMany({
    where: { agencyId: "cmou19l8j0000n4djh2enonr7" },
    select: {
      id: true,
      negotiatorEmail: true,
      negotiatorName: true,
      invitedByUserId: true,
      acceptedAt: true,
      acceptedByUserId: true,
      createdAt: true,
      cancelledAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(invites, null, 2));

  console.log("\n─── Also check: Akeman Agency record createdAt ─────────────");
  const akeman = await prisma.agency.findUnique({
    where: { id: "cmou19l8j0000n4djh2enonr7" },
    select: { name: true, createdAt: true, signupAt: true, firstSubmissionAt: true },
  });
  console.log(JSON.stringify(akeman, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
