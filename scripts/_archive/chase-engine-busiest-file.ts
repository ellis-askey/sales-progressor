// Identify the busiest staging file by combined ReminderLog + active
// ChaseTask count, then snapshot what the chase engine would compute
// for it. Run twice (pre-conversion + post-conversion) and diff.
//
// The chase engine (lib/services/reminders.ts:318 evaluateTransactionReminders)
// is a pure function of (transaction, milestoneCompletions, rules,
// today). We don't invoke it (it has side effects) — instead we
// snapshot its INPUTS exactly. Equality-of-input ⇒ equality-of-output.
//
// Run:
//   DATABASE_URL=... DIRECT_URL=... npx ts-node --transpile-only \
//     -O '{"module":"CommonJS","esModuleInterop":true,"moduleResolution":"node"}' \
//     -r tsconfig-paths/register \
//     scripts/chase-engine-busiest-file.ts \
//     scripts/snapshots/chase-engine-before.json

// React.cache polyfill for the Node harness.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
React.cache = (fn: unknown) => fn;

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error("usage: chase-engine-busiest-file.ts <output-path>");
    process.exit(1);
  }

  // Pick the busiest file: most ReminderLog rows + most MilestoneCompletion rows
  // on an active (non-draft, non-on-hold) transaction. Busy files exercise the
  // most engine code paths.
  const candidates = await prisma.$queryRawUnsafe<
    { id: string; addr: string; status: string; logs: bigint; mcs: bigint; score: bigint }[]
  >(`
    SELECT
      t.id, t."propertyAddress" AS addr, t.status::text AS status,
      (SELECT COUNT(*) FROM "ReminderLog" WHERE "transactionId" = t.id)::bigint AS logs,
      (SELECT COUNT(*) FROM "MilestoneCompletion" WHERE "transactionId" = t.id)::bigint AS mcs,
      ((SELECT COUNT(*) FROM "ReminderLog" WHERE "transactionId" = t.id) +
       (SELECT COUNT(*) FROM "MilestoneCompletion" WHERE "transactionId" = t.id))::bigint AS score
    FROM "PropertyTransaction" t
    WHERE t.status = 'active'
    ORDER BY score DESC
    LIMIT 5
  `);
  console.log("Top 5 busiest active staging files:");
  for (const c of candidates) {
    console.log(`  logs=${String(c.logs).padStart(3)} mcs=${String(c.mcs).padStart(3)} score=${String(c.score).padStart(3)}  ${c.id}  ${c.addr}`);
  }
  const tx = candidates[0];
  if (!tx) throw new Error("no active transactions on staging");
  console.log(`\nPicked: ${tx.id} (${tx.addr})`);

  // Snapshot the chase engine's full INPUT for this file. Mirrors the
  // exact reads at lib/services/reminders.ts:318-356 (the engine).
  //
  //   transaction (id + status, including activeBuyerRoundId so the
  //     diff catches if scoping changes the round id under us)
  //   milestoneCompletions with milestoneDefinition (the engine's
  //     central data structure — completionByCode + completionByDefId
  //     are built off this)
  //   active reminder rules with anchor milestone (deterministic;
  //     doesn't depend on tx but included so the snapshot is
  //     self-contained for re-derivation later)
  //   exchange-blocking definitions
  const transaction = await prisma.propertyTransaction.findUnique({
    where: { id: tx.id },
    select: { id: true, status: true, activeBuyerRoundId: true },
  });

  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id },
    include: { milestoneDefinition: { select: { id: true, code: true, side: true } } },
    orderBy: { milestoneDefinitionId: "asc" },
  });

  const blockingDefs = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true },
    select: { id: true, code: true },
    orderBy: { id: "asc" },
  });

  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true },
    include: { anchorMilestone: { select: { id: true, code: true } } },
    orderBy: { id: "asc" },
  });

  // Pre-compute the engine's first-pass derived state per rule. The
  // engine's runtime decisions for each rule are: "deactivate (reason
  // X)" / "skip (exchange-gated, not ready)" / "active with anchor Y
  // and next-due-date Z". Snapshotting the derivation INPUTS plus the
  // first-pass classification is sufficient: equality-of-input means
  // the deactivate/skip/activate classification is identical, and the
  // anchor-date math is downstream-deterministic.
  const completionByCode = new Map(completions.map((c) => [c.milestoneDefinition.code, c]));
  const completionByDefId = new Map(completions.map((c) => [c.milestoneDefinitionId, c]));

  const exchangeReady = blockingDefs.every((def) => {
    const c = completionByDefId.get(def.id);
    return c && (c.state === "complete" || c.state === "not_required");
  });

  // For each rule, derive what action the engine would take this pass
  // based purely on the snapshot data (no DB writes).
  type Classification =
    | { kind: "skip:tx-not-active" }
    | { kind: "deactivate:exchange-not-ready" }
    | { kind: "deactivate:bilateral-gates-incomplete" }
    | { kind: "deactivate:target-already-confirmed"; targetCode: string }
    | { kind: "active"; anchorCode: string | null; targetCode: string | null };
  const ruleClassifications: Array<{ ruleId: string; ruleName: string; classification: Classification }> = [];

  if (transaction?.status !== "active") {
    for (const rule of rules) {
      ruleClassifications.push({
        ruleId: rule.id,
        ruleName: rule.name,
        classification: { kind: "skip:tx-not-active" },
      });
    }
  } else {
    for (const rule of rules) {
      if (rule.requiresExchangeReady && !exchangeReady) {
        ruleClassifications.push({
          ruleId: rule.id,
          ruleName: rule.name,
          classification: { kind: "deactivate:exchange-not-ready" },
        });
        continue;
      }
      if (rule.targetMilestoneCode === "VM19" || rule.targetMilestoneCode === "PM26") {
        const vm18 = completionByCode.get("VM18");
        const pm25 = completionByCode.get("PM25");
        const vm18Ready = vm18 && (vm18.state === "complete" || vm18.state === "not_required");
        const pm25Ready = pm25 && (pm25.state === "complete" || pm25.state === "not_required");
        if (!vm18Ready || !pm25Ready) {
          ruleClassifications.push({
            ruleId: rule.id,
            ruleName: rule.name,
            classification: { kind: "deactivate:bilateral-gates-incomplete" },
          });
          continue;
        }
      }
      if (rule.targetMilestoneCode) {
        const targetCompletion = completionByCode.get(rule.targetMilestoneCode);
        if (targetCompletion && (targetCompletion.state === "complete" || targetCompletion.state === "not_required")) {
          ruleClassifications.push({
            ruleId: rule.id,
            ruleName: rule.name,
            classification: { kind: "deactivate:target-already-confirmed", targetCode: rule.targetMilestoneCode },
          });
          continue;
        }
      }
      ruleClassifications.push({
        ruleId: rule.id,
        ruleName: rule.name,
        classification: {
          kind: "active",
          anchorCode: rule.anchorMilestone?.code ?? null,
          targetCode: rule.targetMilestoneCode ?? null,
        },
      });
    }
  }

  ruleClassifications.sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  const snapshot = {
    transactionId: tx.id,
    propertyAddressHashOnly: tx.addr.length, // address length only — don't write the address
    txStatus: transaction?.status ?? null,
    txActiveBuyerRoundId: transaction?.activeBuyerRoundId ?? null,
    exchangeReady,
    completionsCount: completions.length,
    rulesCount: rules.length,
    completionsByCode: Object.fromEntries(
      completions.map((c) => [
        c.milestoneDefinition.code,
        {
          state: c.state,
          completedAt: c.completedAt?.toISOString() ?? null,
          eventDate: c.eventDate?.toISOString() ?? null,
        },
      ]),
    ),
    ruleClassifications,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
