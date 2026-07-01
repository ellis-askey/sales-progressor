/**
 * Read-only audit: find every negotiator/director user where:
 *   - they belong to an agency (agencyId is set)
 *   - their own firmName is null
 *   - their inviter (the user who invited them) has firmName set
 *
 * For each, also count how many transactions are linked to them as agentUserId,
 * so we can see the blast radius (files currently hidden from directors with
 * firmName filter).
 *
 * Read-only. Delete this script after use.
 */

import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.PROD_DATABASE_URL! } },
});

async function main() {
  console.log("─── Audit 1: ALL agency users with firmName null ───────────");
  const nullFirms = await prisma.user.findMany({
    where: {
      agencyId: { not: null },
      firmName: null,
      role: { in: ["director", "negotiator", "viewer"] },
    },
    select: {
      id: true, name: true, email: true, role: true, agencyId: true,
      createdAt: true,
      agency: { select: { name: true } },
      _count: { select: { agentFiles: true } },
    },
    orderBy: [{ agencyId: "asc" }, { name: "asc" }],
  });
  console.log(`Found ${nullFirms.length} agency users with firmName null:`);
  for (const u of nullFirms) {
    console.log(
      `  ${u.role.padEnd(11)} · ${u.name.padEnd(20)} · ${u.agency?.name ?? "(no agency)"} · agentFiles=${u._count.agentFiles} · ${u.email}`
    );
  }

  console.log("\n─── Audit 2: who invited each, and their firmName ──────────");
  // For each null-firmName user, find the negotiatorInvitation (if any) and report inviter firmName.
  for (const u of nullFirms) {
    const invite = await prisma.negotiatorInvitation.findFirst({
      where: { acceptedByUserId: u.id },
      select: {
        invitedByUserId: true, acceptedAt: true,
        invitedBy: { select: { name: true, firmName: true } },
      },
    });
    if (!invite) {
      console.log(`  ${u.name.padEnd(20)} → no invitation record (signed up directly?)`);
    } else {
      console.log(
        `  ${u.name.padEnd(20)} → invited by ${invite.invitedBy?.name ?? "?"} (firmName=${invite.invitedBy?.firmName ?? "null"})`
      );
    }
  }

  console.log("\n─── Audit 3: directors whose firmName filter would HIDE these files ─");
  // For each affected user, check if there's a director at the same agency
  // whose firmName is set — those are the directors who currently can't see this user's files.
  const grouped: Record<string, typeof nullFirms> = {};
  for (const u of nullFirms) {
    const key = u.agencyId ?? "(none)";
    (grouped[key] ??= []).push(u);
  }
  for (const [agencyId, users] of Object.entries(grouped)) {
    const directorsWithFirm = await prisma.user.findMany({
      where: { agencyId, role: "director", firmName: { not: null } },
      select: { name: true, firmName: true },
    });
    const agencyName = users[0].agency?.name ?? "(no agency)";
    console.log(`  ${agencyName}:`);
    console.log(`    affected users (firmName null): ${users.map(u => u.name).join(", ")}`);
    if (directorsWithFirm.length === 0) {
      console.log(`    directors with firmName set: (none — no current visibility loss)`);
    } else {
      for (const d of directorsWithFirm) {
        console.log(`    director "${d.name}" (firmName="${d.firmName}") — currently can't see these files in hub`);
      }
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
