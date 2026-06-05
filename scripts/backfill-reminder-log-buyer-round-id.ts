// Phase-2 PR 5 backfill: stamp ReminderLog.buyerRoundId on historical
// PM-targeted rows whose Phase 0 stamping never ran.
//
// Classification rule (Ellis-locked):
//   - Only PM-targeted logs are candidates. VM-targeted logs are
//     file-level by design (vendor rules apply across all sales);
//     they stay NULL.
//   - PM-targeted logs are matched by createdAt within a BuyerRound's
//     [createdAt, archivedAt ?? now] window — same window pattern as
//     Section 2's Contact backfill. Exactly one match → stamp; zero
//     or multiple → unmatched (listed for manual review).
//
// Order this matters: run AFTER Section 2 Contact backfill + PR 1 (so
// any RL rows created during the relist arc have already been
// cancelled). Most prod RL rows post-Phase-0 are already stamped at
// create; this script catches the pre-Phase-0 historical tail.
//
// Run order (per the Phase-2 per-PR template):
//   1. Staging dry-run.   tsx scripts/backfill-reminder-log-buyer-round-id.ts
//   2. Ellis approves the report.
//   3. Staging --apply.   tsx scripts/backfill-reminder-log-buyer-round-id.ts --apply
//   4. Re-run dry-run, confirm zero remaining unmatched PM-targeted rows.
//   5. Browser verification on Emily relist fixture.
//   6. Prod conversation.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type CandidateRound = {
  id: string;
  roundNumber: number;
  status: string;
  createdAt: Date;
  archivedAt: Date | null;
};

type StampedRow = {
  logId: string;
  ruleName: string;
  targetCode: string;
  transactionId: string;
  matchedRoundId: string;
  matchedRoundNumber: number;
  logCreatedAt: Date;
};

type UnmatchedRow = {
  logId: string;
  ruleName: string;
  targetCode: string;
  transactionId: string;
  logCreatedAt: Date;
  reason: "no-match" | "multi-match" | "no-rounds";
  candidateRounds: CandidateRound[];
};

function windowContains(round: CandidateRound, ts: Date): boolean {
  if (ts < round.createdAt) return false;
  if (round.archivedAt && ts > round.archivedAt) return false;
  return true;
}

async function main() {
  const startedAt = new Date();
  const stamped: StampedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  const candidates = await prisma.reminderLog.findMany({
    where: {
      buyerRoundId: null,
      reminderRule: { targetMilestoneCode: { startsWith: "PM" } },
    },
    select: {
      id: true,
      transactionId: true,
      createdAt: true,
      reminderRule: { select: { name: true, targetMilestoneCode: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    console.log("No PM-targeted ReminderLog rows with NULL buyerRoundId. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  const byTx = new Map<string, typeof candidates>();
  for (const l of candidates) {
    const list = byTx.get(l.transactionId) ?? [];
    list.push(l);
    byTx.set(l.transactionId, list);
  }

  for (const [transactionId, logs] of byTx) {
    const rounds = await prisma.buyerRound.findMany({
      where: { transactionId },
      select: { id: true, roundNumber: true, status: true, createdAt: true, archivedAt: true },
      orderBy: { roundNumber: "asc" },
    });

    if (rounds.length === 0) {
      for (const l of logs) {
        unmatched.push({
          logId: l.id,
          ruleName: l.reminderRule.name,
          targetCode: l.reminderRule.targetMilestoneCode ?? "",
          transactionId,
          logCreatedAt: l.createdAt,
          reason: "no-rounds",
          candidateRounds: [],
        });
      }
      continue;
    }

    for (const l of logs) {
      const matches = rounds.filter((r) => windowContains(r, l.createdAt));
      if (matches.length === 1) {
        const m = matches[0];
        stamped.push({
          logId: l.id,
          ruleName: l.reminderRule.name,
          targetCode: l.reminderRule.targetMilestoneCode ?? "",
          transactionId,
          matchedRoundId: m.id,
          matchedRoundNumber: m.roundNumber,
          logCreatedAt: l.createdAt,
        });
      } else if (matches.length === 0) {
        unmatched.push({
          logId: l.id,
          ruleName: l.reminderRule.name,
          targetCode: l.reminderRule.targetMilestoneCode ?? "",
          transactionId,
          logCreatedAt: l.createdAt,
          reason: "no-match",
          candidateRounds: rounds,
        });
      } else {
        unmatched.push({
          logId: l.id,
          ruleName: l.reminderRule.name,
          targetCode: l.reminderRule.targetMilestoneCode ?? "",
          transactionId,
          logCreatedAt: l.createdAt,
          reason: "multi-match",
          candidateRounds: matches,
        });
      }
    }
  }

  // ── Apply ──────────────────────────────────────────────────────────
  let appliedCount = 0;
  if (APPLY && stamped.length > 0) {
    const byRound = new Map<string, string[]>();
    for (const s of stamped) {
      const list = byRound.get(s.matchedRoundId) ?? [];
      list.push(s.logId);
      byRound.set(s.matchedRoundId, list);
    }
    for (const [roundId, ids] of byRound) {
      const res = await prisma.reminderLog.updateMany({
        where: { id: { in: ids }, buyerRoundId: null },
        data: { buyerRoundId: roundId },
      });
      appliedCount += res.count;
    }
  }

  // ── Report ────────────────────────────────────────────────────────
  const finishedAt = new Date();
  const lines: string[] = [];
  lines.push("=".repeat(78));
  lines.push("Phase-2 PR 5 backfill — ReminderLog.buyerRoundId (PM-targeted only)");
  lines.push("=".repeat(78));
  lines.push(`Mode:          ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:       ${startedAt.toISOString()}`);
  lines.push(`Finished:      ${finishedAt.toISOString()}`);
  lines.push(`Candidates:    ${candidates.length} (PM*-targeted + buyerRoundId IS NULL)`);
  lines.push(`Transactions:  ${byTx.size}`);
  lines.push(`Stamped:       ${stamped.length}`);
  lines.push(`Unmatched:     ${unmatched.length}`);
  if (APPLY) lines.push(`Rows written:  ${appliedCount}`);
  lines.push("");
  lines.push("Rule: match by ReminderLog.createdAt within BuyerRound");
  lines.push("      [createdAt, archivedAt ?? now] window. Exactly one match");
  lines.push("      → stamp; zero or multi → unmatched.");
  lines.push("");
  lines.push("VM-targeted logs are file-level by design and never in this set.");
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`STAMPED ROWS (${stamped.length})`);
  lines.push("-".repeat(78));
  if (stamped.length === 0) {
    lines.push("(none)");
  } else {
    for (const s of stamped) {
      lines.push(
        `  ${s.logId}  ${s.targetCode.padEnd(6)} ${s.ruleName.padEnd(30)} ` +
          `tx=${s.transactionId} → R${s.matchedRoundNumber} (${s.matchedRoundId})`,
      );
      lines.push(`       logCreatedAt=${s.logCreatedAt.toISOString()}`);
    }
  }
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`UNMATCHED ROWS (${unmatched.length}) — for manual review`);
  lines.push("-".repeat(78));
  if (unmatched.length === 0) {
    lines.push("(none)");
  } else {
    for (const u of unmatched) {
      lines.push(
        `  ${u.logId}  ${u.targetCode.padEnd(6)} ${u.ruleName.padEnd(30)} ` +
          `tx=${u.transactionId} reason=${u.reason}`,
      );
      lines.push(`       logCreatedAt=${u.logCreatedAt.toISOString()}`);
      if (u.candidateRounds.length === 0) {
        lines.push(`       (transaction has no BuyerRound rows)`);
      } else {
        lines.push(`       candidates:`);
        for (const r of u.candidateRounds) {
          lines.push(
            `         R${r.roundNumber} ${r.status} ${r.id}  ` +
              `[${r.createdAt.toISOString()}, ${r.archivedAt?.toISOString() ?? "open"}]`,
          );
        }
      }
    }
  }
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("END OF REPORT");
  lines.push("=".repeat(78));

  const report = lines.join("\n");
  console.log(report);

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(`scripts/output/backfill-reminder-log-buyer-round-id-${stamp}.txt`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report + "\n", "utf8");
  console.log(`\nReport written to: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
