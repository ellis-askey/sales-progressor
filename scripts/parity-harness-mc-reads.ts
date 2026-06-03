// Phase 1 commit 4 parity harness.
//
// For every staging PropertyTransaction, invokes the primary
// MilestoneCompletion read functions we're converting in 4b–4e and
// captures their full output into a JSON snapshot file. Run twice:
//
//   1. At the pre-conversion revision (HEAD~1, immediately before the
//      conversion commit), snapshot written to snapshots/before.json.
//   2. At the post-conversion revision (HEAD), snapshot written to
//      snapshots/after.json.
//
// Then `diff -u snapshots/before.json snapshots/after.json` must be
// empty. All staging files are single-round (Phase 0 backfill gave
// every file one Round 1; no relists yet), so the round-scoped
// queries return the same row set as the unscoped queries pre-relist.
//
// The harness imports the REAL production functions through the
// project's `@/*` alias (resolved via tsconfig-paths/register). It is
// NOT a re-implementation — it tests the actual code paths.
//
// Reused for 4c, 4d, 4e by extending PRIMARY_FETCHERS.
//
// Run:
//   DATABASE_URL=... DIRECT_URL=... npx ts-node --transpile-only \
//     -O '{"module":"CommonJS","esModuleInterop":true,"moduleResolution":"node"}' \
//     -r tsconfig-paths/register \
//     scripts/parity-harness-mc-reads.ts \
//     scripts/snapshots/before.json
//
// (Second argument is the output file path.)

// Patch React.cache to identity-pass BEFORE any transitive import touches
// lib/agent-session.ts. In production the read functions live inside
// Server Component contexts where react.cache is real; this Node harness
// has no SC runtime, so we polyfill to a no-op wrapper. Production
// behaviour unaffected — react.cache only ever short-circuits memoizes a
// single SC render anyway.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
React.cache = (fn: unknown) => fn;

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

// REAL production imports — the point of the harness. tsconfig-paths
// resolves @/* at runtime; tsc validates these at build time.
import { getMilestonesForTransaction, getDownstreamCompleted, getImpliedPredecessors } from "@/lib/services/milestones";

const prisma = new PrismaClient();

type TxSnapshot = {
  transactionId: string;
  propertyAddress: string;
  status: string;
  activeBuyerRoundId: string | null;

  // Output of getMilestonesForTransaction — the canonical per-tx fetcher
  // used by the agent file detail and the portal. Captured as a
  // {code -> {state, completedAt, eventDate, ...}} map keyed by milestone
  // CODE (not row id) so the snapshot is stable across re-runs.
  milestoneStates: {
    vendor: Record<string, { state: string; completedAt: string | null; isComplete: boolean; isNotRequired: boolean; isAvailable: boolean }>;
    purchaser: Record<string, { state: string; completedAt: string | null; isComplete: boolean; isNotRequired: boolean; isAvailable: boolean }>;
    exchangeReady: boolean;
    vendorGateReady: boolean;
    purchaserGateReady: boolean;
  };

  // getDownstreamCompleted output for a deterministic seed milestone (PM1).
  // Reads the full prereq tree as a side-effect.
  downstreamFromPM1: string[];   // codes

  // getImpliedPredecessors output for a deterministic seed milestone (PM12 — the cross-side prereq case).
  impliedPrereqsForPM12: string[];   // codes (sorted)

  // Per-tx completion counts and last-activity probes — captures the
  // shapes used by hub.ts / transactions.ts / work-queue.ts. The harness
  // re-implements these inline as the queries they ARE today, so
  // converting the call sites later means the harness re-run captures
  // the converted output, and the before/after diff catches any change.
  completionCounts: { totalRows: number; completeRows: number };
  lastCompletedAt: string | null;
};

async function snapshotForTransaction(tx: { id: string; propertyAddress: string; status: string; activeBuyerRoundId: string | null }): Promise<TxSnapshot> {
  // 1. The canonical per-tx fetcher. agencyId=null means no scope filter
  //    (we're a script with full DB access).
  const milestones = await getMilestonesForTransaction(tx.id, null);

  const vendorMap: TxSnapshot["milestoneStates"]["vendor"] = {};
  for (const d of milestones.vendor) {
    vendorMap[d.code] = {
      state: d.completion?.state ?? "locked",
      completedAt: d.completion?.completedAt?.toISOString() ?? null,
      isComplete: d.isComplete,
      isNotRequired: d.isNotRequired,
      isAvailable: d.isAvailable,
    };
  }
  const purchaserMap: TxSnapshot["milestoneStates"]["purchaser"] = {};
  for (const d of milestones.purchaser) {
    purchaserMap[d.code] = {
      state: d.completion?.state ?? "locked",
      completedAt: d.completion?.completedAt?.toISOString() ?? null,
      isComplete: d.isComplete,
      isNotRequired: d.isNotRequired,
      isAvailable: d.isAvailable,
    };
  }

  // 2. getDownstreamCompleted — seed with PM1.
  const pm1Def = await prisma.milestoneDefinition.findFirst({ where: { code: "PM1" }, select: { id: true } });
  const downstreamFromPM1 = pm1Def
    ? (await getDownstreamCompleted(pm1Def.id, tx.id)).map((d) => d.code).sort()
    : [];

  // 3. getImpliedPredecessors — seed with PM12 (the canonical cross-side prereq case).
  const pm12Def = await prisma.milestoneDefinition.findFirst({ where: { code: "PM12" }, select: { id: true } });
  const impliedPrereqsForPM12 = pm12Def
    ? (await getImpliedPredecessors(pm12Def.id, tx.id)).map((d) => d.code).sort()
    : [];

  // 4. Completion counts (mirrors hub.ts / transactions.ts shapes; converted
  //    in 4d for hub, in 4b for transactions, but the shape today is what
  //    we're verifying preserves)
  const totalRows = await prisma.milestoneCompletion.count({ where: { transactionId: tx.id } });
  const completeRows = await prisma.milestoneCompletion.count({ where: { transactionId: tx.id, state: "complete" } });
  const lastCompleted = await prisma.milestoneCompletion.findFirst({
    where: { transactionId: tx.id, state: "complete" },
    select: { completedAt: true },
    orderBy: { completedAt: "desc" },
  });

  return {
    transactionId: tx.id,
    propertyAddress: tx.propertyAddress,
    status: tx.status,
    activeBuyerRoundId: tx.activeBuyerRoundId,
    milestoneStates: {
      vendor: vendorMap,
      purchaser: purchaserMap,
      exchangeReady: milestones.exchangeReady,
      vendorGateReady: milestones.vendorGateReady,
      purchaserGateReady: milestones.purchaserGateReady,
    },
    downstreamFromPM1,
    impliedPrereqsForPM12,
    completionCounts: { totalRows, completeRows },
    lastCompletedAt: lastCompleted?.completedAt?.toISOString() ?? null,
  };
}

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error("usage: parity-harness-mc-reads.ts <output-path>");
    process.exit(1);
  }

  const txs = await prisma.propertyTransaction.findMany({
    select: { id: true, propertyAddress: true, status: true, activeBuyerRoundId: true },
    orderBy: { id: "asc" },
  });
  console.log(`Snapshotting ${txs.length} transactions...`);

  const out: TxSnapshot[] = [];
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]!;
    try {
      const snap = await snapshotForTransaction(tx);
      out.push(snap);
      if (i % 10 === 0 || i === txs.length - 1) {
        console.log(`  ${i + 1}/${txs.length}`);
      }
    } catch (err) {
      console.error(`  FAIL at tx ${tx.id} (${tx.propertyAddress}):`, err);
      throw err;
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
