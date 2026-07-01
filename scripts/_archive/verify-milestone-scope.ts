// Self-test for lib/services/milestone-scope.ts.
//
// Builds a two-round sentinel transaction on staging:
//   - Round 1 (active, the live one)
//   - Round 0 (archived, the simulated previous buyer's round)
// Seeds VM completions (file-level, buyerRoundId NULL) plus PM completions
// for both rounds, then asserts each scope returns the expected partition.
//
// Avoids the @/* alias problem by re-implementing the helper inline. The
// production helper is at lib/services/milestone-scope.ts and is what tsc
// validated compiles cleanly; this script exercises the same query shapes
// against staging data.

import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

// ─── Helper re-implementation (kept in sync with lib/services/milestone-scope.ts) ──

type MilestoneScope =
  | { kind: "forRound"; roundId: string | null; transactionId: string }
  | { kind: "vendorOnly" }
  | { kind: "allRoundsForAudit" };

function forRound(roundId: string | null, transactionId: string): MilestoneScope {
  return { kind: "forRound", roundId, transactionId };
}
function vendorOnly(): MilestoneScope {
  return { kind: "vendorOnly" };
}
function allRoundsForAudit(): MilestoneScope {
  return { kind: "allRoundsForAudit" };
}
function milestoneScopeWhere(scope: MilestoneScope): Prisma.MilestoneCompletionWhereInput {
  switch (scope.kind) {
    case "forRound":
      if (scope.roundId === null) {
        console.warn(`[milestone-scope] forRound(null) triggered — gap file detected, degrading to vendor-only. transactionId=${scope.transactionId}`);
        return { buyerRoundId: null };
      }
      return { OR: [{ buyerRoundId: null }, { buyerRoundId: scope.roundId }] };
    case "vendorOnly":
      return { buyerRoundId: null };
    case "allRoundsForAudit":
      return {};
  }
}

// ─── Fixture + assertions ───────────────────────────────────────────────────

const SENTINEL = `[milestone-scope rehearsal] ${randomUUID()}`;

async function setupFixture() {
  const agency = await prisma.agency.findFirst({ select: { id: true } });
  if (!agency) throw new Error("no agency on staging");

  // Two milestone defs, one per side, for compactness. Pick VM9 + PM12
  // specifically so we can exercise the cross-side prereq case.
  const vm9 = await prisma.milestoneDefinition.findFirst({ where: { code: "VM9" }, select: { id: true } });
  const pm12 = await prisma.milestoneDefinition.findFirst({ where: { code: "PM12" }, select: { id: true } });
  if (!vm9 || !pm12) throw new Error("VM9 / PM12 definitions missing");

  // Sentinel transaction with Round 1 (active) + Round 0 (simulated archived).
  // Round 0 doesn't actually exist on the production data model today (rounds
  // start at 1), but Phase 1 will introduce archived rounds — we use a
  // synthetic Round 2 archived state here to prove the helper handles both.
  const tx = await prisma.$transaction(async (ptx) => {
    const created = await ptx.propertyTransaction.create({
      data: {
        propertyAddress: SENTINEL,
        agencyId: agency.id,
        twelveWeekTarget: new Date(Date.now() + 84 * 86400_000),
      },
    });
    const round1 = await ptx.buyerRound.create({
      data: { transactionId: created.id, roundNumber: 1, status: "active" },
    });
    const round2Archived = await ptx.buyerRound.create({
      data: {
        transactionId: created.id, roundNumber: 2,
        status: "withdrawn",
        archivedAt: new Date(),
        fallThroughReason: "test fixture",
      },
    });
    const updated = await ptx.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: round1.id },
    });
    return { tx: updated, round1Id: round1.id, round2Id: round2Archived.id };
  });

  // Seed completions: VM9 file-level, PM12 once per round.
  const vmRow = await prisma.milestoneCompletion.create({
    data: { transactionId: tx.tx.id, milestoneDefinitionId: vm9.id, state: "complete", buyerRoundId: null },
  });
  const pmRound1Row = await prisma.milestoneCompletion.create({
    data: { transactionId: tx.tx.id, milestoneDefinitionId: pm12.id, state: "available", buyerRoundId: tx.round1Id },
  });
  const pmRound2Row = await prisma.milestoneCompletion.create({
    data: { transactionId: tx.tx.id, milestoneDefinitionId: pm12.id, state: "complete", buyerRoundId: tx.round2Id },
  });
  return {
    txId: tx.tx.id,
    round1Id: tx.round1Id,
    round2Id: tx.round2Id,
    vmRowId: vmRow.id,
    pmRound1RowId: pmRound1Row.id,
    pmRound2RowId: pmRound2Row.id,
  };
}

function assertEq<T>(label: string, got: T, want: T) {
  const eq = Array.isArray(got) && Array.isArray(want)
    ? got.length === want.length && got.every((x, i) => x === want[i])
    : got === want;
  if (!eq) {
    console.error(`  FAIL: ${label}\n    got = ${JSON.stringify(got)}\n    want = ${JSON.stringify(want)}`);
    throw new Error(`assertion failed: ${label}`);
  }
  console.log(`  OK: ${label}`);
}

async function runReads(txId: string, scope: MilestoneScope) {
  const topLevel = await prisma.milestoneCompletion.findMany({
    where: { transactionId: txId, ...milestoneScopeWhere(scope) },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const nested = await prisma.propertyTransaction.findFirst({
    where: { id: txId },
    select: {
      milestoneCompletions: {
        where: milestoneScopeWhere(scope),
        select: { id: true },
        orderBy: { id: "asc" },
      },
    },
  });
  return {
    topLevelIds: topLevel.map((r) => r.id),
    nestedIds: nested?.milestoneCompletions.map((r) => r.id) ?? [],
  };
}

async function main() {
  console.log(`Sentinel: "${SENTINEL}"`);
  let fixture: Awaited<ReturnType<typeof setupFixture>> | null = null;
  try {
    fixture = await setupFixture();
    console.log(`Fixture: tx=${fixture.txId}`);
    console.log(`  round1Id=${fixture.round1Id}  round2Id=${fixture.round2Id}`);
    console.log(`  vmRowId=${fixture.vmRowId}`);
    console.log(`  pmRound1RowId=${fixture.pmRound1RowId}  pmRound2RowId=${fixture.pmRound2RowId}\n`);

    // ── Case 1: forRound(round1, tx) returns VM + Round 1 PM only ────────────
    console.log("Case 1: forRound(round1, tx) — vendor + Round 1 PMs");
    {
      const r = await runReads(fixture.txId, forRound(fixture.round1Id, fixture.txId));
      assertEq("top-level returns vm + pm-round1", r.topLevelIds.sort(), [fixture.vmRowId, fixture.pmRound1RowId].sort());
      assertEq("nested returns vm + pm-round1", r.nestedIds.sort(), [fixture.vmRowId, fixture.pmRound1RowId].sort());
      assertEq("nested == top-level (composition equivalence)", r.topLevelIds.sort().join(","), r.nestedIds.sort().join(","));
    }

    // ── Case 2: forRound(round2 archived, tx) returns VM + Round 2 PM only ──
    console.log("\nCase 2: forRound(round2 archived, tx) — vendor + Round 2 PMs (archived-round view)");
    {
      const r = await runReads(fixture.txId, forRound(fixture.round2Id, fixture.txId));
      assertEq("returns vm + pm-round2", r.topLevelIds.sort(), [fixture.vmRowId, fixture.pmRound2RowId].sort());
      assertEq("nested matches", r.nestedIds.sort(), [fixture.vmRowId, fixture.pmRound2RowId].sort());
    }

    // ── Case 3: forRound(null, tx) returns VMs only + warning logged ─────────
    console.log("\nCase 3: forRound(null, tx) — graceful degradation + warning");
    {
      const r = await runReads(fixture.txId, forRound(null, fixture.txId));
      assertEq("returns vm only", r.topLevelIds, [fixture.vmRowId]);
      assertEq("nested matches", r.nestedIds, [fixture.vmRowId]);
      // Warning visible above — printed by milestoneScopeWhere.
    }

    // ── Case 4: vendorOnly() returns VMs only, no warning ────────────────────
    console.log("\nCase 4: vendorOnly() — vendor only, silent");
    {
      const r = await runReads(fixture.txId, vendorOnly());
      assertEq("returns vm only", r.topLevelIds, [fixture.vmRowId]);
      assertEq("nested matches", r.nestedIds, [fixture.vmRowId]);
    }

    // ── Case 5: allRoundsForAudit() returns every row ─────────────────────────
    console.log("\nCase 5: allRoundsForAudit() — every row, no filter");
    {
      const r = await runReads(fixture.txId, allRoundsForAudit());
      assertEq(
        "returns vm + both pm rounds",
        r.topLevelIds.sort(),
        [fixture.vmRowId, fixture.pmRound1RowId, fixture.pmRound2RowId].sort(),
      );
      assertEq(
        "nested matches",
        r.nestedIds.sort(),
        [fixture.vmRowId, fixture.pmRound1RowId, fixture.pmRound2RowId].sort(),
      );
    }

    // ── Case 6: Cross-side prereq read — VM9 + PM12 returned together ────────
    console.log("\nCase 6: cross-side prereq (VM9 + PM12 via forRound)");
    {
      const scope = forRound(fixture.round1Id, fixture.txId);
      const rows = await prisma.milestoneCompletion.findMany({
        where: {
          transactionId: fixture.txId,
          ...milestoneScopeWhere(scope),
          milestoneDefinition: { code: { in: ["VM9", "PM12"] } },
        },
        select: { id: true, milestoneDefinition: { select: { code: true } } },
      });
      const codes = rows.map((r) => r.milestoneDefinition.code).sort();
      assertEq("VM9 and PM12 returned together in one query", codes, ["PM12", "VM9"]);
    }

    console.log("\nAll assertions hold.");
  } finally {
    if (fixture) {
      await prisma.propertyTransaction.delete({ where: { id: fixture.txId } });
      console.log(`\nCleaned up sentinel tx ${fixture.txId}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
