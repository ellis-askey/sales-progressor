// Section 2 backfill: stamp Contact.buyerRoundId on historical purchaser
// rows whose Phase 0 stamping never ran (or who pre-date Phase 0 entirely).
//
// Policy (Ellis-locked, decision B3 of the per-sale scoping plan):
//   - roleType=purchaser AND buyerRoundId IS NULL only
//   - Match by Contact.createdAt falling within a BuyerRound's
//     [createdAt, archivedAt ?? now] window (BuyerRound has no startedAt;
//     createdAt is the canonical "round started" timestamp)
//   - Exactly one matching round → stamp (recorded in "stamped" report)
//   - Zero or multiple matches → unmatched (listed for manual decision)
//   - Vendor / solicitor / broker / other contacts are file-level by
//     design and NEVER touched
//
// Constraints (non-negotiable):
//   - Default is dry-run. Pass --apply to actually write.
//   - Report prints to stdout AND is written to
//     scripts/output/backfill-contact-buyer-round-id-<timestamp>.txt
//   - Unmatched rows are LISTED, NEVER GUESSED, NEVER SILENTLY SKIPPED
//
// Run order (per the plan, Section 5):
//   1. Staging dry-run.            tsx scripts/backfill-contact-buyer-round-id.ts
//   2. Ellis approves the report.
//   3. Staging --apply.            tsx scripts/backfill-contact-buyer-round-id.ts --apply
//   4. Re-run dry-run, confirm zero remaining unmatched purchasers.
//   5. Browser verification on Emily relist fixture (live + Sale 1 + Sale 2 drawer gates).
//   6. Prod conversation. Not before.
//
// TransactionNote: file-level by design, no scoping change in this PR
// (Phase-2-or-later if per-sale notes are needed).

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
  contactId: string;
  name: string;
  email: string | null;
  transactionId: string;
  matchedRoundId: string;
  matchedRoundNumber: number;
  matchedRoundStatus: string;
  contactCreatedAt: Date;
  roundWindowStart: Date;
  roundWindowEnd: Date | null;
};

type UnmatchedRow = {
  contactId: string;
  name: string;
  email: string | null;
  transactionId: string;
  contactCreatedAt: Date;
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

  // Pull every NULL-buyerRoundId purchaser contact, grouped by transaction
  // so we can fetch each transaction's rounds in one shot.
  const candidates = await prisma.contact.findMany({
    where: { roleType: "purchaser", buyerRoundId: null },
    select: {
      id: true,
      name: true,
      email: true,
      propertyTransactionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) {
    console.log("No purchaser contacts with NULL buyerRoundId. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  // Group by transaction, then resolve each candidate against its tx's rounds.
  const byTx = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const list = byTx.get(c.propertyTransactionId) ?? [];
    list.push(c);
    byTx.set(c.propertyTransactionId, list);
  }

  for (const [transactionId, contactsForTx] of byTx) {
    const rounds = await prisma.buyerRound.findMany({
      where: { transactionId },
      select: { id: true, roundNumber: true, status: true, createdAt: true, archivedAt: true },
      orderBy: { roundNumber: "asc" },
    });

    if (rounds.length === 0) {
      for (const c of contactsForTx) {
        unmatched.push({
          contactId: c.id,
          name: c.name,
          email: c.email,
          transactionId,
          contactCreatedAt: c.createdAt,
          reason: "no-rounds",
          candidateRounds: [],
        });
      }
      continue;
    }

    for (const c of contactsForTx) {
      const matches = rounds.filter((r) => windowContains(r, c.createdAt));

      if (matches.length === 1) {
        const m = matches[0];
        stamped.push({
          contactId: c.id,
          name: c.name,
          email: c.email,
          transactionId,
          matchedRoundId: m.id,
          matchedRoundNumber: m.roundNumber,
          matchedRoundStatus: m.status,
          contactCreatedAt: c.createdAt,
          roundWindowStart: m.createdAt,
          roundWindowEnd: m.archivedAt,
        });
      } else if (matches.length === 0) {
        unmatched.push({
          contactId: c.id,
          name: c.name,
          email: c.email,
          transactionId,
          contactCreatedAt: c.createdAt,
          reason: "no-match",
          candidateRounds: rounds,
        });
      } else {
        unmatched.push({
          contactId: c.id,
          name: c.name,
          email: c.email,
          transactionId,
          contactCreatedAt: c.createdAt,
          reason: "multi-match",
          candidateRounds: matches,
        });
      }
    }
  }

  // ── Apply stamping (only when --apply) ───────────────────────────────
  let appliedCount = 0;
  if (APPLY && stamped.length > 0) {
    // One updateMany per round id (small N — typically <= number of rounds
    // across all relisted files). Keeps each update audit-traceable in PG
    // logs without flooding it with per-row statements.
    const byRound = new Map<string, string[]>();
    for (const s of stamped) {
      const list = byRound.get(s.matchedRoundId) ?? [];
      list.push(s.contactId);
      byRound.set(s.matchedRoundId, list);
    }
    for (const [matchedRoundId, ids] of byRound) {
      const res = await prisma.contact.updateMany({
        where: { id: { in: ids }, buyerRoundId: null, roleType: "purchaser" },
        data: { buyerRoundId: matchedRoundId },
      });
      appliedCount += res.count;
    }
  }

  // ── Build the report ────────────────────────────────────────────────
  const finishedAt = new Date();
  const lines: string[] = [];
  lines.push("=".repeat(78));
  lines.push("Section 2 backfill — Contact.buyerRoundId (purchaser-role only)");
  lines.push("=".repeat(78));
  lines.push(`Mode:          ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:       ${startedAt.toISOString()}`);
  lines.push(`Finished:      ${finishedAt.toISOString()}`);
  lines.push(`Candidates:    ${candidates.length} (purchaser-role + buyerRoundId IS NULL)`);
  lines.push(`Transactions:  ${byTx.size}`);
  lines.push(`Stamped:       ${stamped.length}`);
  lines.push(`Unmatched:     ${unmatched.length}`);
  if (APPLY) lines.push(`Rows written:  ${appliedCount}`);
  lines.push("");
  lines.push("TransactionNote: file-level by design, no scoping change in this PR");
  lines.push("(Phase-2-or-later if per-sale notes are needed).");
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`STAMPED ROWS (${stamped.length})`);
  lines.push("-".repeat(78));
  if (stamped.length === 0) {
    lines.push("(none)");
  } else {
    for (const s of stamped) {
      lines.push(
        `  ${s.contactId}  ${s.name.padEnd(28)} ${(s.email ?? "—").padEnd(36)} ` +
          `tx=${s.transactionId}  →  R${s.matchedRoundNumber} (${s.matchedRoundStatus}, ${s.matchedRoundId})`,
      );
      lines.push(
        `       contactCreatedAt=${s.contactCreatedAt.toISOString()}  ` +
          `roundWindow=[${s.roundWindowStart.toISOString()}, ${s.roundWindowEnd?.toISOString() ?? "open"}]`,
      );
    }
  }
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`UNMATCHED ROWS (${unmatched.length}) — for manual decision`);
  lines.push("-".repeat(78));
  if (unmatched.length === 0) {
    lines.push("(none)");
  } else {
    for (const u of unmatched) {
      lines.push(
        `  ${u.contactId}  ${u.name.padEnd(28)} ${(u.email ?? "—").padEnd(36)} ` +
          `tx=${u.transactionId}  reason=${u.reason}`,
      );
      lines.push(`       contactCreatedAt=${u.contactCreatedAt.toISOString()}`);
      if (u.candidateRounds.length === 0) {
        lines.push(`       (transaction has no BuyerRound rows at all)`);
      } else {
        lines.push(`       candidate rounds:`);
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
  const outPath = resolve(`scripts/output/backfill-contact-buyer-round-id-${stamp}.txt`);
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
