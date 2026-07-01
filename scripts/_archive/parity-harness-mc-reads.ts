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
import { getActivityTimeline } from "@/lib/services/comms";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";

// READ-ONLY BY CONSTRUCTION
// =========================
// A parity tool must never mutate what it measures. The production
// fetcher getReminderLogsForTransaction has write side effects:
//   - fire-and-forget autoCompleteRemindersForMilestone for orphan logs
//   - prisma.chaseTask.create for "due with no task" self-heal
//   - recursive self-call after the create
// Calling it directly from the harness commits those writes between
// the BEFORE and AFTER captures, polluting the diff with side-effect
// drift that looks like a code change but isn't.
//
// Instead we pure-replicate the function's read shape + orphan-filter
// decision below (snapshotReminderLogsPure). No writes; the snapshot
// matches what getReminderLogsForTransaction WOULD return on a
// hypothetical idempotent run.

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

  // 4c additions ─────────────────────────────────────────────────────
  // Output of getReminderLogsForTransaction — the canonical agent-UI
  // reminder fetcher. Captured as a stable shape keyed by rule id
  // (sorted) plus per-log fields. Self-heals like "active log with no
  // pending task" can mutate state on read — the harness re-runs once
  // after the conversion, so any divergence shows in the diff.
  reminderLogs: Array<{
    ruleId: string;
    targetCode: string | null;
    status: string;
    statusReason: string | null;
    nextDueDate: string;
    chaseTasks: Array<{ status: string; priority: string; chaseCount: number; dueDate: string }>;
  }>;

  // The engine's INPUT shape per tx: milestoneCompletions with
  // milestoneDefinition included, exactly as evaluateTransactionReminders
  // reads at lib/services/reminders.ts:322. If this snapshot is
  // byte-identical pre/post conversion, the engine's pure decisions
  // (deactivate / activate / next-due-date) cannot diverge — even though
  // the engine itself has write side effects we don't want to invoke
  // twice. Equality-of-input → equality-of-output.
  engineInput: {
    txStatus: string;
    completions: Array<{
      milestoneDefinitionId: string;
      code: string;
      state: string;
      completedAt: string | null;
      eventDate: string | null;
    }>;
  };

  // 4d additions ─────────────────────────────────────────────────────
  // Output of getActivityTimeline (no agency scope, no roundScope —
  // defaults to active-round) projected to a stable shape. Used by
  // the agent file detail Activity tab. Read-only.
  activityTimelineKindCounts: { milestone: number; comm: number };
  activityTimelineMilestoneCodes: string[];

  // problem-detection.ts derived per-tx values: the round-scoped
  // _count and last-completedAt that detectFlags consumes. The
  // detectFlags decision is a pure function of these inputs (plus
  // chase tasks / contacts / comms which we already capture); equal
  // inputs ⇒ equal flag decisions.
  problemDetectionInput: {
    completedCount: number;
    lastCompletedAt: string | null;
  };
};

// Pure replication of getReminderLogsForTransaction. Reads the same
// shapes the production fetcher reads, applies the orphan filter in
// pure code, returns the same diff-friendly per-log shape the harness
// previously emitted. No writes. See banner at top of file.
type PureReminderLog = {
  ruleId: string;
  targetCode: string | null;
  status: string;
  statusReason: string | null;
  nextDueDate: string;
  chaseTasks: Array<{ status: string; priority: string; chaseCount: number; dueDate: string }>;
};
async function snapshotReminderLogsPure(
  transactionId: string,
  activeBuyerRoundId: string | null,
): Promise<PureReminderLog[]> {
  // Same shape as lib/services/reminders.ts:128-148.
  const logs = await prisma.reminderLog.findMany({
    where: { transactionId },
    orderBy: { nextDueDate: "asc" },
    include: {
      reminderRule: {
        select: { id: true, name: true, description: true, targetMilestoneCode: true, graceDays: true, repeatEveryDays: true, escalateAfterChases: true, anchorMilestone: { select: { name: true } } },
      },
      chaseTasks: {
        select: { status: true, priority: true, chaseCount: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Same scoped completedCodes read as lib/services/reminders.ts:149-156
  // (in 4c) — vendor file-level + active round's PMs only.
  const scope = forRound(activeBuyerRoundId, transactionId);
  const completedRows = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      state: { in: ["complete", "not_required"] },
      ...milestoneScopeWhere(scope),
    },
    select: { milestoneDefinition: { select: { code: true } } },
  });
  const completedCodes = new Set(completedRows.map((r) => r.milestoneDefinition.code));

  // Orphan filter — pure decision, no writes (production function would
  // also fire autoCompleteRemindersForMilestone here; we skip).
  const orphanIds = new Set(
    logs
      .filter((l) =>
        l.status === "active" &&
        l.reminderRule.targetMilestoneCode &&
        completedCodes.has(l.reminderRule.targetMilestoneCode),
      )
      .map((l) => l.id),
  );
  const visible = logs.filter((l) => !orphanIds.has(l.id));

  return visible
    .map((l) => ({
      ruleId: l.reminderRuleId,
      targetCode: l.reminderRule.targetMilestoneCode,
      status: l.status as string,
      statusReason: l.statusReason,
      nextDueDate: l.nextDueDate.toISOString(),
      chaseTasks: l.chaseTasks
        .map((c) => ({
          status: c.status as string,
          priority: c.priority as string,
          chaseCount: c.chaseCount,
          dueDate: c.dueDate.toISOString(),
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

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

  // 4c — pure replication of getReminderLogsForTransaction's READ shape
  // and orphan-filter decision. NO writes (see READ-ONLY BY CONSTRUCTION
  // banner above for why). Mirrors lib/services/reminders.ts:117-205 but
  // skips:
  //   - autoCompleteRemindersForMilestone (orphan self-heal, write)
  //   - prisma.chaseTask.create for due-with-no-task (write + recursive call)
  // The output IS what the function would have returned to its caller
  // on an idempotent run; pre-relist single-round files produce the
  // same set the side-effecting fetcher does.
  const reminderLogs = await snapshotReminderLogsPure(tx.id, tx.activeBuyerRoundId);

  // 4c — the engine's input. Match the engine's read shape exactly
  // (lib/services/reminders.ts:322): all milestoneCompletions on the tx
  // with milestoneDefinition.code. Captured BEFORE we re-scope the
  // engine's read; the conversion preserves this set on single-round
  // staging files.
  const engineCompletions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id },
    select: {
      milestoneDefinitionId: true,
      state: true,
      completedAt: true,
      eventDate: true,
      milestoneDefinition: { select: { code: true } },
    },
    orderBy: { milestoneDefinitionId: "asc" },
  });

  // 4d — getActivityTimeline is a READ-ONLY production fetcher (no
  // side effects), so we can invoke it directly. Projects to stable
  // counts + milestone-code list for diff stability.
  const activityEntries = await getActivityTimeline(tx.id, null);
  const activityTimelineKindCounts = activityEntries.reduce(
    (acc, e) => {
      if (e.kind === "milestone") acc.milestone++;
      else if (e.kind === "comm") acc.comm++;
      return acc;
    },
    { milestone: 0, comm: 0 },
  );
  const activityTimelineMilestoneCodes = activityEntries
    .filter((e): e is Extract<typeof e, { kind: "milestone" }> => e.kind === "milestone")
    .map((e) => e.milestoneCode)
    .sort();

  // 4d — problem-detection inputs (per-tx round-scoped count + last
  // completedAt). Same scope the production detectAndStoreFlags now
  // computes after the (b)-class restructure.
  const pdScope = forRound(tx.activeBuyerRoundId, tx.id);
  const [pdCount, pdLast] = await Promise.all([
    prisma.milestoneCompletion.count({
      where: { transactionId: tx.id, state: "complete", ...milestoneScopeWhere(pdScope) },
    }),
    prisma.milestoneCompletion.findFirst({
      where: { transactionId: tx.id, state: "complete", ...milestoneScopeWhere(pdScope) },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ]);

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
    reminderLogs,
    engineInput: {
      txStatus: tx.status,
      completions: engineCompletions.map((c) => ({
        milestoneDefinitionId: c.milestoneDefinitionId,
        code: c.milestoneDefinition.code,
        state: c.state as string,
        completedAt: c.completedAt?.toISOString() ?? null,
        eventDate: c.eventDate?.toISOString() ?? null,
      })),
    },
    activityTimelineKindCounts,
    activityTimelineMilestoneCodes,
    problemDetectionInput: {
      completedCount: pdCount,
      lastCompletedAt: pdLast?.completedAt?.toISOString() ?? null,
    },
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
