// One-shot: re-render solicitor-confirmation summaries on existing
// MilestoneCompletion rows to the approved sentence form ("{firm} confirmed
// they have ordered the searches"). Read-time surfaces (agent notifications,
// comms feed, client portal) already regenerate; this fixes the STORED
// summaryText shown on the hub + file activity timeline, so past confirms read
// identically to new ones.
//
// Run (staging via .env, prod via .env.production):
//   npx dotenv -e .env --override -- npx ts-node --transpile-only --project tsconfig.scripts.json scripts/backfill-solicitor-summaries.ts
//
// Delete after it has run on production (see docs/SCRIPTS_REGISTRY.md).

import { prisma } from "../lib/prisma";
import { solicitorConfirmationSentence } from "../lib/updates-copy";

async function main() {
  const rows = await prisma.milestoneCompletion.findMany({
    where: { confirmedBySolicitorFirmId: { not: null } },
    select: {
      id: true,
      summaryText: true,
      confirmedBySolicitorFirm: { select: { name: true } },
      milestoneDefinition: { select: { code: true, name: true } },
    },
  });

  let updated = 0;
  for (const r of rows) {
    const firm = r.confirmedBySolicitorFirm?.name ?? "The solicitor";
    const next = solicitorConfirmationSentence(firm, r.milestoneDefinition.code, r.milestoneDefinition.name);
    if (next !== r.summaryText) {
      await prisma.milestoneCompletion.update({ where: { id: r.id }, data: { summaryText: next } });
      updated++;
    }
  }

  console.log(`Backfilled ${updated} of ${rows.length} solicitor-confirmed summaries.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
