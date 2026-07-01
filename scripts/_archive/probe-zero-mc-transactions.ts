// PROD READ-ONLY PROBE — fingerprint of the historical promoteDraftAction bug.
//
// promoteDraftAction (pre-follow-up commit 8424c8a) flipped a draft to
// active without calling initializeMilestoneCompletions. Any file that
// took that path is alive on the platform with ZERO MilestoneCompletion
// rows — visibly broken (every milestone shows as "locked"), and silent
// from the chase engine (which has no rows to read).
//
// This script counts and (if any) names them. NO writes. The decision
// about what to do with affected files — initialise milestones on a
// live file wakes the reminder engine — is deferred to a deliberate
// follow-up, not made as a side effect.
//
// Run:
//   DATABASE_URL=... DIRECT_URL=... \
//     npx ts-node --transpile-only -O '{"module":"CommonJS","esModuleInterop":true,"moduleResolution":"node"}' \
//     scripts/probe-zero-mc-transactions.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Count first so the report leads with the headline.
  const candidates = await prisma.propertyTransaction.findMany({
    where: { milestoneCompletions: { none: {} } },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      tenure: true,
      purchaseType: true,
      activeBuyerRoundId: true,
      createdAt: true,
      updatedAt: true,
      agencyId: true,
      agentUserId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Split by status so the report is actionable: drafts with no MCs are
  // expected (init runs on tenure+purchaseType set, drafts may lack
  // either). Non-drafts are the promoteDraftAction-bug fingerprint.
  const drafts = candidates.filter((t) => t.status === "draft");
  const liveFiles = candidates.filter((t) => t.status !== "draft");

  console.log(`Total transactions with ZERO MilestoneCompletion rows: ${candidates.length}`);
  console.log(`  drafts (expected — init gated on tenure+purchaseType): ${drafts.length}`);
  console.log(`  live files (promoteDraftAction-bug fingerprint):       ${liveFiles.length}`);

  if (liveFiles.length > 0) {
    console.log(`\nAffected live files (status != draft):`);
    for (const t of liveFiles) {
      console.log(
        `  ${t.id}  status=${t.status}  tenure=${t.tenure ?? "?"}  purchaseType=${t.purchaseType ?? "?"}  ` +
        `activeBuyerRoundId=${t.activeBuyerRoundId ?? "null"}  ` +
        `created=${t.createdAt.toISOString()}  updated=${t.updatedAt.toISOString()}  ` +
        `address="${t.propertyAddress}"`,
      );
    }
  }

  if (drafts.length > 0) {
    console.log(`\nDrafts with no MCs (informational — these are expected):`);
    for (const t of drafts.slice(0, 10)) {
      console.log(
        `  ${t.id}  tenure=${t.tenure ?? "null"}  purchaseType=${t.purchaseType ?? "null"}  ` +
        `created=${t.createdAt.toISOString()}`,
      );
    }
    if (drafts.length > 10) console.log(`  ... and ${drafts.length - 10} more`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
