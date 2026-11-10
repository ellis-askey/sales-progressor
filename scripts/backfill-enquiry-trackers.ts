// One-shot backfill: create the EnquiryTracker / EnquiryRaiseChase rows that the
// SILENT Migrate-Sale path never created. That path (lib/services/migrate-
// milestones.ts) writes MilestoneCompletion rows directly and bypasses
// completeMilestone, so syncEnquiryTracker / syncRaiseChase never fired. A
// migrated file with enquiries raised-but-not-satisfied therefore has NO open
// tracker: it is invisible on the Enquiries page and gets no enquiry chase.
// (Found during the Boardwalk go-live audit, 2026-11-10.)
//
// The forward fix is already in migrate-milestones.ts (replayEnquirySyncForCodes);
// this reconciles the files migrated BEFORE that fix shipped.
//
// Usage:
//   npx tsx scripts/backfill-enquiry-trackers.ts            # DRY RUN — report only
//   npx tsx scripts/backfill-enquiry-trackers.ts --apply    # write the trackers
//
// Idempotent: replayEnquirySyncForCodes guards on existing state, so re-running is
// safe. NOTE: creating open trackers ACTIVATES enquiry chasing on those files —
// run only when the go-live/unpause plan is ready for that.
// DELETE after the backfill is confirmed (see docs/SCRIPTS_REGISTRY.md).

import { prisma } from "@/lib/prisma";
import { replayEnquirySyncForCodes } from "@/lib/services/milestones";

const OPEN = ["PM14", "VM10"];
const CLOSE = ["PM20", "VM21"];

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY (writing trackers)" : "DRY RUN (report only)"}\n`);

  // Code lookup once (small table).
  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const codeById = new Map(defs.map((d) => [d.id, d.code]));

  const txns = await prisma.propertyTransaction.findMany({
    where: { isMigrated: true, isDemo: false, status: "active" },
    select: { id: true, propertyAddress: true },
    orderBy: { propertyAddress: "asc" },
  });
  console.log(`${txns.length} migrated active files to reconcile.\n`);

  let shouldOpen = 0;
  let openedBefore = 0;
  let openedAfter = 0;

  for (const tx of txns) {
    const completions = await prisma.milestoneCompletion.findMany({
      where: { transactionId: tx.id, state: "complete" },
      select: { milestoneDefinitionId: true },
    });
    const codes = new Set(
      completions.map((c) => codeById.get(c.milestoneDefinitionId)).filter((x): x is string => !!x),
    );
    const before = await prisma.enquiryTracker.count({ where: { transactionId: tx.id, closedAt: null } });
    openedBefore += before;

    const wantsOpenLoop = OPEN.some((c) => codes.has(c)) && !CLOSE.some((c) => codes.has(c));
    if (wantsOpenLoop && before === 0) {
      shouldOpen++;
      console.log(`  ${apply ? "FIX " : "WOULD FIX"}  ${tx.propertyAddress}  (${tx.id})`);
    }

    if (apply) {
      await replayEnquirySyncForCodes(tx.id, codes);
      openedAfter += await prisma.enquiryTracker.count({ where: { transactionId: tx.id, closedAt: null } });
    }
  }

  console.log(`\nFiles needing an open enquiry tracker: ${shouldOpen}`);
  if (apply) {
    console.log(`Open trackers across migrated files: ${openedBefore} -> ${openedAfter}`);
  } else {
    console.log(`(dry run — re-run with --apply to write)`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
