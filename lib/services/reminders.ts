// lib/services/reminders.ts — Sprint 3 v2
// Updated engine: graceDays, repeatEveryDays, escalateAfterChases, priority, chaseCount

import { prisma } from "@/lib/prisma";
import type { Prisma, ReminderLogStatus, ChaseTaskStatus, TaskPriority } from "@prisma/client";
import { createCommunicationRecord } from "@/lib/services/comms";
import type { AgentVisibility } from "@/lib/services/agent";
import { scopeOwnershipWhere, scopeChaseTaskWhere, scopeReminderLogWhere, type AccessScope } from "@/lib/security/access-scope";
import { toUKDateStr } from "@/lib/utils";
import { pushChaseEscalation } from "@/lib/agent/push-events";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";

// ─── UK chase-time helper ───────────────────────────────────────────────────
//
// Normalises a Date to 06:00 in Europe/London on the same calendar day.
// All chase tasks fire BEFORE the working day starts so the morning view
// of the work-queue / hub is the complete picture for today — agents
// shouldn't see "10 more appeared" at 14:00 because of time-of-day drift
// inherited from arbitrary anchor timestamps. The morning sweep cron at
// /api/reminders/run (04:00 UTC) populates ReminderLog rows; by 06:00 UK
// every eligible row is past `lte: now` and visible.
//
// Implementation: get the UK calendar date string, construct a candidate
// at 06:00 UTC on that date, then check what UK time the candidate
// represents (BST = UTC+1 in summer, GMT = UTC+0 in winter) and adjust.
// Idempotent — re-applying to an already-normalised date is a no-op.
//
// Was 09:30 UK pre-2026-05-30; moved earlier so reminders surface before
// any reasonable working day starts.
export function setUkChaseTime(d: Date): Date {
  const ukDateStr = toUKDateStr(d);            // "YYYY-MM-DD" in Europe/London
  const [y, m, dd] = ukDateStr.split("-").map(Number);

  // Candidate at 06:00 UTC on the target UK calendar day.
  const candidate = new Date(Date.UTC(y, (m as number) - 1, dd, 6, 0, 0, 0));

  // Format candidate in Europe/London; if hour > 6 we're in BST and need
  // to subtract the offset to land on 06:00 UK.
  const ukHourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).format(candidate);
  const ukHour = parseInt(ukHourStr, 10);
  const offsetHours = ukHour - 6;
  if (offsetHours !== 0) {
    candidate.setUTCHours(candidate.getUTCHours() - offsetHours);
  }
  return candidate;
}

// ─── Public read helpers (server-only) ───────────────────────────────────────

// Returns a map of milestone code → graceDays (smallest across active rules
// targeting that code). Used by the staleness badge (Change 5 of the
// visibility-pass) to render "Awaiting N days" on any available milestone
// that has been sitting longer than its chase rule's grace window.
//
// "Smallest" is intentional: when multiple rules target the same code, the
// shortest graceDays is the first chase that fires — i.e. the earliest
// moment the milestone is officially overdue. Picking the smallest matches
// the user-facing meaning of "this has been waiting too long".
//
// Codes with no active rule are absent from the map. Caller treats absence
// as "no badge" (computeStaleness returns null for null/undefined graceDays).
export async function getGraceDaysByMilestoneCode(): Promise<Map<string, number>> {
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { not: null } },
    select: { targetMilestoneCode: true, graceDays: true },
  });
  const m = new Map<string, number>();
  for (const r of rules) {
    if (!r.targetMilestoneCode) continue;
    const existing = m.get(r.targetMilestoneCode);
    if (existing == null || r.graceDays < existing) {
      m.set(r.targetMilestoneCode, r.graceDays);
    }
  }
  return m;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderLogWithRule = {
  id: string;
  transactionId: string;
  reminderRuleId: string;
  status: ReminderLogStatus;
  nextDueDate: Date;
  snoozedUntil: Date | null;
  sourceDateUsed: Date | null;
  statusReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  reminderRule: {
    id: string;
    name: string;
    description?: string | null;
    targetMilestoneCode: string | null;
    graceDays: number;
    repeatEveryDays: number;
    escalateAfterChases: number;
    anchorMilestone: { name: string } | null;
  };
  chaseTasks: {
    id: string;
    status: ChaseTaskStatus;
    priority: TaskPriority;
    chaseCount: number;
    dueDate: Date;
    fallbackKind: string | null;
    communications: { createdAt: Date; method: string | null }[];
  }[];
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getReminderLogsForTransaction(
  transactionId: string,
  agencyId: string | null
): Promise<ReminderLogWithRule[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!tx) throw new Error("Transaction not found");

  // Round-scoped: orphan-cleanup must match the chase engine's view of
  // "this milestone is satisfied" exactly — the engine reads active
  // round PMs + vendor file-level via forRound (line ~322), and so
  // must this filter or we'd surface logs whose target is satisfied
  // in an archived round (false-positive orphan).
  const scope = forRound(tx.activeBuyerRoundId, transactionId);

  const [logs, completedCodes] = await Promise.all([
    prisma.reminderLog.findMany({
      // Phase-2 PR 5 (ReminderLog read-path scoping): belt-and-braces
      // beyond PR 1's cancellation. PR 1 marks old-round PM logs as
      // status="cancelled" at fall-through and relist; the work-queue
      // surfaces filter on status="active" so don't see them. THIS
      // surface (file-detail reminders tab) doesn't filter on status —
      // it shows the full reminder ledger for the file — so an old-
      // round log that PR 1 missed (e.g. a regression in the
      // cancellation logic, or a row created out of the normal flow)
      // would otherwise still render here. The OR filter scopes
      // visible rows to file-level (vendor rules, NULL by design) +
      // active-round purchaser rules.
      where: {
        transactionId,
        OR: [
          { buyerRoundId: null },
          ...(tx.activeBuyerRoundId ? [{ buyerRoundId: tx.activeBuyerRoundId }] : []),
        ],
      },
      orderBy: { nextDueDate: "asc" },
      include: {
        reminderRule: {
          select: { id: true, name: true, description: true, targetMilestoneCode: true, graceDays: true, repeatEveryDays: true, escalateAfterChases: true, anchorMilestone: { select: { name: true } } },
        },
        chaseTasks: {
          select: {
            id: true, status: true, priority: true, chaseCount: true, dueDate: true, fallbackKind: true,
            communications: {
              where: { type: "outbound" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, method: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }) as Promise<ReminderLogWithRule[]>,
    prisma.milestoneCompletion.findMany({
      // Both complete AND not_required count as "this milestone is satisfied".
      // The engine treats them equivalently at evaluateTransactionReminders
      // line ~304, and so must the read-time filter.
      where: {
        transactionId,
        state: { in: ["complete", "not_required"] },
        ...milestoneScopeWhere(scope),
      },
      select: { state: true, milestoneDefinition: { select: { code: true } } },
    }).then((rows) => new Map(rows.map((r) => [r.milestoneDefinition.code, r.state]))),
  ]);

  // Orphan cleanup: any active log whose target milestone is already
  // complete/not_required is stuck data (migration race, missed engine
  // pass, or any "edit while on hold" flow). Filter them out of the
  // response AND fire-and-forget mark them completed in the DB so the
  // next read doesn't have to re-filter. Mirrors the existing self-heal
  // pattern below for "active log with no pending ChaseTask".
  const orphans = logs.filter((l) =>
    l.status === "active"
    && l.reminderRule.targetMilestoneCode
    && completedCodes.has(l.reminderRule.targetMilestoneCode),
  );
  if (orphans.length > 0) {
    // Bucket by reason so the audit-log statusReason matches what
    // actually closed the milestone (Complete vs Not required).
    const byReason = new Map<string, Set<string>>();
    for (const o of orphans) {
      const code = o.reminderRule.targetMilestoneCode!;
      const state = completedCodes.get(code);
      const reason = state === "not_required" ? "Milestone marked not required" : "Milestone completed";
      const codes = byReason.get(reason) ?? new Set<string>();
      codes.add(code);
      byReason.set(reason, codes);
    }
    Promise.all(
      Array.from(byReason.entries()).flatMap(([reason, codes]) =>
        Array.from(codes).map((code) =>
          autoCompleteRemindersForMilestone(transactionId, code, reason),
        ),
      ),
    ).catch((err) => console.error("[getReminderLogsForTransaction] orphan cleanup failed:", err));
  }
  const orphanIds = new Set(orphans.map((o) => o.id));
  const visible = logs.filter((l) => !orphanIds.has(l.id));

  const todayUKStr = toUKDateStr(new Date());
  const dueWithNoTask = visible.filter((l) => {
    return l.status === "active" && !l.chaseTasks.some((t) => t.status === "pending") && toUKDateStr(l.nextDueDate) <= todayUKStr;
  });
  if (dueWithNoTask.length > 0) {
    await Promise.all(
      dueWithNoTask.map((l) =>
        prisma.chaseTask.create({
          data: { transactionId, reminderLogId: l.id, dueDate: l.nextDueDate, status: "pending", priority: "normal", chaseCount: 0 },
        })
      )
    );
    return getReminderLogsForTransaction(transactionId, agencyId);
  }

  return visible;
}

export async function getAgentReminderLogs(vis: AgentVisibility) {
  // Internal staff paths: no agencyId filter; serviceType filter reversed (their files are outsourced).
  // Agent paths: existing agencyId + serviceType (self_managed only) logic unchanged.
  //
  // On-hold files are excluded — the work queue is a "what should I act on
  // right now" surface and on-hold means paused everywhere. The cron + engine
  // also skip on-hold files so nothing fires automatically while they're frozen.
  let txWhere: Record<string, unknown>;
  if (vis.internalMode === "admin_all") {
    txWhere = { status: "active" as const };
  } else if (vis.internalMode === "assigned") {
    txWhere = { assignedUserId: vis.userId, status: "active" as const, serviceType: "outsourced" as const };
  } else {
    const baseTxWhere = { agencyId: vis.agencyId, status: "active" as const, serviceType: { not: "outsourced" as const } };
    txWhere = vis.seeAll
      ? vis.firmName
        ? { ...baseTxWhere, agentUser: { firmName: vis.firmName } }
        : baseTxWhere
      : { ...baseTxWhere, agentUserId: vis.userId };
  }

  // PHASE 1 (b)-CLASS — drives chase decisions, restructured as
  // two-step. The orphan filter below removes stale logs whose target
  // milestone is already satisfied; under-scoping the satisfied check
  // (archived rounds' completions) would falsely mark a current
  // round's reminder as orphan and hide it from the agent, so the
  // satisfied-codes-per-tx must be round-scoped. Prisma's nested
  // where can't reference the parent tx's activeBuyerRoundId, so we
  // fetch the logs (without the MC include), then per-tx fetch the
  // round-scoped satisfied codes in a single batch query.
  const logs = await prisma.reminderLog.findMany({
    where: { status: "active", transaction: txWhere },
    include: {
      reminderRule: {
        select: { name: true, description: true, targetMilestoneCode: true, repeatEveryDays: true, escalateAfterChases: true, graceDays: true, anchorMilestone: { select: { name: true } } },
      },
      chaseTasks: {
        where: { status: "pending" },
        select: {
          id: true, status: true, priority: true, chaseCount: true, dueDate: true, fallbackKind: true,
          communications: {
            where: { type: "outbound" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, method: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          activeBuyerRoundId: true,
          contacts: { select: { id: true, name: true, roleType: true, email: true, phone: true } },
        },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });

  // Step 2: build a per-tx round-scoped map of satisfied codes via raw
  // SQL DISTINCT so the per-tx OR clause can reference the parent.
  // Pre-relist (one round) this returns the same set as the prior
  // nested include; post-relist it correctly excludes archived rounds'
  // satisfied codes from the orphan check.
  const txInfo = new Map(
    logs.map((l) => [l.transaction.id, l.transaction.activeBuyerRoundId]),
  );
  const txIds = Array.from(txInfo.keys());
  const satisfiedByTx = new Map<string, Set<string>>(txIds.map((id) => [id, new Set<string>()]));
  if (txIds.length > 0) {
    const rows = await prisma.$queryRaw<{ transactionId: string; code: string }[]>`
      SELECT mc."transactionId", md.code
      FROM "MilestoneCompletion" mc
      JOIN "MilestoneDefinition" md ON mc."milestoneDefinitionId" = md.id
      JOIN "PropertyTransaction" pt ON mc."transactionId" = pt.id
      WHERE mc."transactionId" = ANY(${txIds})
        AND mc.state IN ('complete', 'not_required')
        AND (
          mc."buyerRoundId" IS NULL
          OR mc."buyerRoundId" = pt."activeBuyerRoundId"
        )
    `;
    for (const r of rows) {
      satisfiedByTx.get(r.transactionId)?.add(r.code);
    }
  }

  // Filter orphan logs: rule has targetMilestoneCode that's already
  // satisfied (complete/NR) on this transaction's active round (or
  // vendor file-level). Don't write here — the work queue is hot. The
  // DB heals when the per-file getReminderLogsForTransaction next loads.
  const visibleLogs = logs.filter((l) => {
    const target = l.reminderRule.targetMilestoneCode;
    if (!target) return true;
    const codes = satisfiedByTx.get(l.transaction.id);
    return !codes?.has(target);
  });

  const todayUKStr = toUKDateStr(new Date());
  const dueWithNoTask = visibleLogs.filter((l) => {
    return l.chaseTasks.length === 0 && toUKDateStr(l.nextDueDate) <= todayUKStr;
  });
  if (dueWithNoTask.length > 0) {
    await Promise.all(
      dueWithNoTask.map((l) =>
        prisma.chaseTask.create({
          data: { transactionId: l.transaction.id, reminderLogId: l.id, dueDate: l.nextDueDate, status: "pending", priority: "normal", chaseCount: 0 },
        })
      )
    );
    return getAgentReminderLogs(vis);
  }

  return visibleLogs;
}

export async function getChaseTasksForTransaction(transactionId: string, scope: AccessScope) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!tx) throw new Error("Transaction not found");

  // Phase-2 PR 6 (ChaseTask read-path scoping): belt-and-braces after PR 1
  // cancellation + PR 5 ReminderLog scoping. PR 1 marks old-round buyer-
  // side ChaseTasks as status="cancelled" at withdraw/relist; PR 5 hides
  // old-round ReminderLog rows so the parent include is naturally
  // scoped. THIS surface (per-tx ChaseTask fetch, used by the chase-
  // management views) returns the full ledger for the file regardless
  // of status — without the OR filter, an old-round chase that PR 1
  // missed (regression, out-of-flow row) would still render.
  return prisma.chaseTask.findMany({
    where: {
      transactionId,
      OR: [
        { buyerRoundId: null },
        ...(tx.activeBuyerRoundId ? [{ buyerRoundId: tx.activeBuyerRoundId }] : []),
      ],
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    include: {
      reminderLog: {
        include: { reminderRule: { select: { name: true, targetMilestoneCode: true } } },
      },
      assignedTo: { select: { id: true, name: true } },
    },
  });
}

// ─── Core engine ──────────────────────────────────────────────────────────────

export async function evaluateTransactionReminders(transactionId: string) {
  // CRITICAL ROUND-SCOPING: this is the chase engine. Reading archived
  // rounds' PMs here would cause every rule to misfire post-relist:
  // a target marked complete on the OLD round would deactivate the
  // rule on the CURRENT round; an anchor from the OLD round would
  // mis-date the next-due-date. The completionBy* maps below MUST
  // contain only vendor file-level + active round PMs.
  //
  // Two-step fetch: parent row first (gives us activeBuyerRoundId),
  // then a round-scoped MilestoneCompletion fetch using forRound. The
  // include syntax can't reference the parent's column in its nested
  // where, so the split is unavoidable for round-correctness.
  const transaction = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      status: true,
      assignedUserId: true,
      activeBuyerRoundId: true,
      createdAt: true,
    },
  });

  if (!transaction) return;
  if (transaction.status !== "active") return;

  const scopedCompletions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      ...milestoneScopeWhere(forRound(transaction.activeBuyerRoundId, transactionId)),
    },
    include: { milestoneDefinition: true },
  });
  // Repackaged into the shape the rest of this function consumed
  // before the refactor. Keeps the downstream code unchanged.
  const assignedUserId = transaction.assignedUserId ?? "";

  // Build completion map: milestoneDefinitionId -> completion
  const completionByDefId = new Map(
    scopedCompletions.map((c) => [c.milestoneDefinitionId, c])
  );

  // Build completion map by code: code -> completion
  const completionByCode = new Map(
    scopedCompletions.map((c) => [c.milestoneDefinition.code, c])
  );

  // Exchange readiness: all blocksExchange milestones complete or not-required
  const allBlockers = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true },
  });
  const exchangeReady = allBlockers.every((def) => {
    const c = completionByDefId.get(def.id);
    return c && (c.state === "complete" || c.state === "not_required");
  });

  // Load all active reminder rules
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true },
    include: { anchorMilestone: true },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayUKStr = toUKDateStr(today);

  for (const rule of rules) {
    // Exchange-gated: skip if not ready
    if (rule.requiresExchangeReady && !exchangeReady) {
      await deactivateLog(transactionId, rule.id, "Exchange not yet ready", assignedUserId);
      continue;
    }

    // Bilateral-gate pre-check for the contracts-exchanged rules.
    // VM19 (seller side) and PM26 (buyer side) are confirmed together in
    // one bilateral write — you cannot exchange contracts until BOTH
    // solicitors have signalled readiness (VM18 vendor, PM25 purchaser).
    // The two contracts-exchanged chase rules anchor on their own side's
    // gate (VM19→VM18, PM26→PM25), so without this check whichever side
    // confirmed first kicks off a reminder the agent can't action — the
    // exchange physically can't happen until the other gate also lands.
    // Suppress until both gates are complete or not-required; the existing
    // grace clock then fires off the older anchor, which lands the chase
    // the next morning after both gates are in.
    if (rule.targetMilestoneCode === "VM19" || rule.targetMilestoneCode === "PM26") {
      const vm18 = completionByCode.get("VM18");
      const pm25 = completionByCode.get("PM25");
      const vm18Ready = vm18 && (vm18.state === "complete" || vm18.state === "not_required");
      const pm25Ready = pm25 && (pm25.state === "complete" || pm25.state === "not_required");
      if (!vm18Ready || !pm25Ready) {
        await deactivateLog(transactionId, rule.id, "Awaiting both exchange-ready gates (VM18 + PM25)", assignedUserId);
        continue;
      }
    }

    // Check if target milestone is already confirmed — if so, deactivate
    if (rule.targetMilestoneCode) {
      const targetCompletion = completionByCode.get(rule.targetMilestoneCode);
      if (targetCompletion && (targetCompletion.state === "complete" || targetCompletion.state === "not_required")) {
        await deactivateLog(transactionId, rule.id, "Target milestone confirmed", assignedUserId);
        continue;
      }

      // Prerequisite gate: don't surface a chase for a milestone whose
      // direct prereqs aren't yet complete or not-required. Without this
      // the engine generated a reminder the agent couldn't action — the
      // milestone-level confirm path blocks on the same prereqs, so the
      // Done click would silently fail and the row immediately
      // regenerated. See the 46 Ramilles Close incident (PM7 reminder
      // looped while PM4 was still available). The target milestone-confirmation
      // path is the authoritative prereq check; we mirror it here so the
      // chase never appears in the first place.
      const prereqCodes = DIRECT_PREREQUISITES[rule.targetMilestoneCode] ?? [];
      if (prereqCodes.length > 0) {
        const unmet = prereqCodes.filter((code) => {
          const c = completionByCode.get(code);
          return !c || (c.state !== "complete" && c.state !== "not_required");
        });
        if (unmet.length > 0) {
          await deactivateLog(
            transactionId,
            rule.id,
            `Awaiting prerequisite milestone${unmet.length === 1 ? "" : "s"}: ${unmet.join(", ")}`,
            assignedUserId,
          );
          continue;
        }
      }
    }

    // Determine anchor date
    let anchorDate: Date | null = null;

    if (rule.anchorMilestoneId) {
      const anchorCompletion = completionByDefId.get(rule.anchorMilestoneId);
      // Treat both "complete" and "not_required" as valid anchors. NR anchors
      // are how the engine handles cases like PM25's chase rule (anchored on
      // PM24) when PM24 is auto-NR'd for cash_from_proceeds files — without
      // this, the dependent chase silently deactivates. Fall-through to the
      // anchorDate resolution below; the NR row's completedAt (or
      // transaction.createdAt) supplies a usable schedule origin.
      if (!anchorCompletion || (anchorCompletion.state !== "complete" && anchorCompletion.state !== "not_required")) {
        await deactivateLog(transactionId, rule.id, "Anchor milestone not yet confirmed", assignedUserId);
        continue;
      }
      if (anchorCompletion.reconciledAtClaim) {
        // Reconciled at claim: completedAt is the claim day, not the real-world event.
        // Always use eventDate. If eventDate is null (agent didn't supply a date) we
        // have no usable anchor and must deactivate — otherwise the reminder would
        // fire graceDays from the claim, which is misleading for backdated work.
        if (!anchorCompletion.eventDate) {
          await deactivateLog(
            transactionId,
            rule.id,
            "Anchor milestone was reconciled at claim without an eventDate — no anchor available for scheduling",
            assignedUserId,
          );
          continue;
        }
        anchorDate = anchorCompletion.eventDate;
      } else {
        anchorDate = (rule.useEventDate && anchorCompletion.eventDate)
          ? anchorCompletion.eventDate
          : (anchorCompletion.completedAt ?? transaction.createdAt);
      }
    } else {
      anchorDate = transaction.createdAt;
    }

    // Calculate first due date: anchor + graceDays, normalised to 06:00 UK
    // on the resulting calendar day (so chases fire before the working day
    // starts, not at the random hour the anchor milestone was confirmed).
    const firstDueDate = setUkChaseTime(addDays(anchorDate, rule.graceDays));

    // Find existing active log
    const existingLog = await prisma.reminderLog.findFirst({
      where: { transactionId, reminderRuleId: rule.id, status: "active" },
    });

    // Wake snoozed-but-elapsed logs in-line. Previously a snoozed log only
    // woke when the wake cron ran (or via wakeUpReminderLog called
    // explicitly) — which left "wakes 26 May" reminders still snoozed on
    // pages loaded on 26 May, until the next cron pass. Clearing here means
    // every page render that touches evaluateTransactionReminders also
    // wakes anything past its snooze.
    if (existingLog && existingLog.snoozedUntil && existingLog.snoozedUntil.getTime() <= Date.now()) {
      await prisma.reminderLog.update({
        where: { id: existingLog.id },
        data: { snoozedUntil: null },
      });
      existingLog.snoozedUntil = null;
    }

    if (existingLog) {
      // Pre-2026-06-01: this branch always recomputed nextDueDate from
      // anchor+graceDays and overwrote when diff > 1 hour. That clobbered
      // chase-advanced dates back to the anchor-derived first-due date
      // every time the engine ran (via revalidatePath after any action).
      // Net result: rows that had been chased many times kept snapping
      // back to dates months in the past, looking permanently stuck in
      // Overdue. applyChaseToTask's date advance was overridden minutes
      // after every chase.
      //
      // Fix: once ANY chase has been recorded against this log, the
      // cadence belongs to applyChaseToTask (lastChasedAt + repeatEveryDays).
      // The engine no longer touches nextDueDate. It still owns the
      // INITIAL value (created from anchor+grace) on chaseCount=0 logs
      // — that's the only place this branch fires now.
      const hasChases = await prisma.chaseTask.findFirst({
        where: { reminderLogId: existingLog.id, chaseCount: { gt: 0 } },
        select: { id: true },
      });
      if (!hasChases) {
        // Update if due date shifted significantly (e.g. event_date changed)
        const diff = Math.abs(existingLog.nextDueDate.getTime() - firstDueDate.getTime());
        if (diff > 60 * 60 * 1000) {
          await prisma.reminderLog.update({
            where: { id: existingLog.id },
            data: { nextDueDate: firstDueDate, sourceDateUsed: anchorDate },
          });
          await writeEngineAudit(
            transactionId,
            `"${rule.name}" chase moved to ${formatEngineDate(firstDueDate)}.`,
            assignedUserId
          );
        }
      }
    } else {
      // Commit 4c-followup (2026-06-04) — stamp buyerRoundId per the same
      // rule createInitialRemindersInline uses: PM-targeted rules get the
      // active round's id; VM-targeted (and untargeted) rules stay file-
      // level. Without this stamp, the relist action's round-keyed
      // cancellation sweep can't find engine-created PM ReminderLogs on
      // a subsequent relist — they'd survive to fire about a dead buyer.
      const isPurchaserTarget = rule.targetMilestoneCode?.startsWith("PM") ?? false;
      await prisma.reminderLog.create({
        data: {
          transactionId,
          reminderRuleId: rule.id,
          status: "active",
          nextDueDate: firstDueDate,
          sourceDateUsed: anchorDate,
          buyerRoundId: isPurchaserTarget ? (transaction.activeBuyerRoundId ?? null) : null,
        },
      });
      await writeEngineAudit(
        transactionId,
        `Automated chase scheduled for "${rule.name}" — first reminder ${formatEngineDate(firstDueDate)}.`,
        assignedUserId
      );
    }

    // Get the current active log
    const log = await prisma.reminderLog.findFirst({
      where: { transactionId, reminderRuleId: rule.id, status: "active" },
    });

    if (!log) continue;

    // Find existing open chase task for this log
    const openTask = await prisma.chaseTask.findFirst({
      where: { reminderLogId: log.id, status: "pending" },
    });

    if (openTask) {
      // Escalation gate (2026-06 timing rule):
      // chaseCount is NEVER incremented on calendar arithmetic alone.
      // Escalation flips when the agent has chased the threshold number
      // of times AND graceDays have elapsed since the last actual chase
      // (lastChasedAt + graceDays ago).
      //
      // Worked example with escalateAfterChases=3, graceDays=3:
      //   Day 0 — agent chases for the 3rd time. chaseCount hits cap,
      //           nextDueDate advances by repeatEveryDays, row returns
      //           to Coming Up.
      //   Day 1–2 — quiet. graceDays haven't elapsed yet → still Coming
      //           Up / Overdue (depending on repeatEveryDays).
      //   Day 3 — graceDays have now elapsed since lastChasedAt and
      //           chaseCount >= threshold → row escalates.
      //
      // Replaces the pre-2026-06 rule that used repeatEveryDays as the
      // post-cap timer. graceDays is the right knob — it's the "grace
      // period before urgent" concept already used at chase setup time;
      // here it's the "grace period after final chase before urgent".
      const threshold = rule.escalateAfterChases;
      const chasedEnough = openTask.chaseCount >= threshold;
      const graceMs = rule.graceDays * 86400000;
      const graceElapsedSinceLastChase = openTask.lastChasedAt
        ? (today.getTime() - openTask.lastChasedAt.getTime()) >= graceMs
        : false;
      const shouldEscalate =
        openTask.priority !== "escalated" &&
        chasedEnough &&
        graceElapsedSinceLastChase;
      if (shouldEscalate) {
        await prisma.chaseTask.update({
          where: { id: openTask.id },
          data: { priority: "escalated" },
        });
        const milestoneLabel = rule.name.replace(/^Chase:\s*/i, "");
        pushChaseEscalation(transactionId, milestoneLabel).catch(() => {});
      }
    } else {
      if (toUKDateStr(log.nextDueDate) <= todayUKStr) {
        // Commit 4c-followup — inherit the buyerRoundId from the parent
        // ReminderLog (now correctly stamped above). Same rule as the
        // ChaseTask.createMany in createInitialRemindersInline.
        await prisma.chaseTask.create({
          data: {
            transactionId,
            reminderLogId: log.id,
            assignedToId: transaction.assignedUserId,
            dueDate: log.nextDueDate,
            status: "pending",
            priority: "normal",
            chaseCount: 0,
            buyerRoundId: log.buyerRoundId,
          },
        });
        // No audit entry — duplicates the "Automated chase scheduled…"
        // line written when the reminder log was created. Agents don't
        // need to see both events.
      }
    }
  }
}

// Fast batched inline creation for new transactions — 3 queries total, no N+1
// Only handles non-anchor, non-exchange-gated rules (the ones active from day 0)
export async function createInitialRemindersInline(
  transactionId: string,
  createdAt: Date,
  assignedUserId: string | null,
  completedMilestoneCodes: string[] = [],
  // Phase 1 commit 3: when supplied, purchaser-targeted rules
  // (targetMilestoneCode starts with 'PM') get their ReminderLog and
  // any inline-created ChaseTask stamped with this round id. Vendor-
  // targeted rules stay file-level. Same attribution rule as Phase 0
  // backfill.
  buyerRoundId?: string | null
): Promise<void> {
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true, anchorMilestoneId: null, requiresExchangeReady: false },
    select: { id: true, graceDays: true, targetMilestoneCode: true },
  });

  const eligibleRules = completedMilestoneCodes.length > 0
    ? rules.filter((r) => !r.targetMilestoneCode || !completedMilestoneCodes.includes(r.targetMilestoneCode))
    : rules;

  if (eligibleRules.length === 0) return;

  await prisma.reminderLog.createMany({
    data: eligibleRules.map((rule) => {
      const dueDate = new Date(createdAt);
      dueDate.setDate(dueDate.getDate() + rule.graceDays);
      // Normalise to 06:00 UK on the resulting day so the chase is live
      // before the working day starts (rather than inheriting createdAt's hour).
      const normalised = setUkChaseTime(dueDate);
      const isPurchaserTarget = rule.targetMilestoneCode?.startsWith("PM") ?? false;
      return {
        transactionId,
        reminderRuleId: rule.id,
        status: "active" as const,
        nextDueDate: normalised,
        sourceDateUsed: createdAt,
        buyerRoundId: isPurchaserTarget ? (buyerRoundId ?? null) : null,
      };
    }),
  });

  const logs = await prisma.reminderLog.findMany({
    where: { transactionId, reminderRuleId: { in: eligibleRules.map((r) => r.id) }, status: "active" },
    select: { id: true, nextDueDate: true, buyerRoundId: true },
  });

  const nowUKStr = toUKDateStr(new Date());
  const dueLogs = logs.filter((l) => toUKDateStr(l.nextDueDate) <= nowUKStr);
  if (dueLogs.length === 0) return;

  await prisma.chaseTask.createMany({
    data: dueLogs.map((log) => ({
      transactionId,
      reminderLogId: log.id,
      assignedToId: assignedUserId,
      dueDate: log.nextDueDate,
      status: "pending" as const,
      priority: "normal" as const,
      chaseCount: 0,
      // Inherit attribution from the parent ReminderLog (same rule as
      // Phase 0's ChaseTask backfill).
      buyerRoundId: log.buyerRoundId,
    })),
  });
}

export async function runReminderEngine(agencyId?: string, assignedUserId?: string) {
  const where = assignedUserId
    ? { status: "active" as const, assignedUserId }
    : agencyId
    ? { status: "active" as const, agencyId }
    : { status: "active" as const };

  const transactions = await prisma.propertyTransaction.findMany({
    where,
    select: { id: true },
  });

  let processed = 0;
  let errors = 0;

  // Process in parallel batches of 8 — reduces total time ~8× vs sequential
  const BATCH = 8;
  for (let i = 0; i < transactions.length; i += BATCH) {
    const batch = transactions.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((tx) => evaluateTransactionReminders(tx.id))
    );
    for (const r of results) {
      if (r.status === "fulfilled") processed++;
      else {
        errors++;
        console.error("Reminder engine error:", r.reason);
      }
    }
  }

  return { processed, errors, total: transactions.length };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function formatEngineDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function writeEngineAudit(transactionId: string, content: string, createdById: string) {
  if (!createdById) return;
  await prisma.outboundMessage.create({
    data: { transactionId, type: "internal_note", contactIds: [], content, createdById },
  });
}

async function deactivateLog(
  transactionId: string,
  reminderRuleId: string,
  reason: string,
  assignedUserId: string
) {
  const existing = await prisma.reminderLog.findFirst({
    where: { transactionId, reminderRuleId, status: "active" },
    include: { reminderRule: { select: { name: true } } },
  });
  if (!existing) return;

  await prisma.reminderLog.update({
    where: { id: existing.id },
    data: { status: "inactive", statusReason: reason },
  });

  await prisma.chaseTask.updateMany({
    where: { reminderLogId: existing.id, status: "pending" },
    data: { status: "inactive" },
  });

  await writeEngineAudit(
    transactionId,
    `"${existing.reminderRule.name}" chase closed — ${reason}.`,
    assignedUserId
  );
}

// ─── Task actions ─────────────────────────────────────────────────────────────

// Pure write helper: records a chase against a ChaseTask. Bumps chaseCount,
// stamps lastChasedAt, resets priority to "normal", AND advances the
// associated ReminderLog.nextDueDate forward by repeatEveryDays from
// max(currentDue, now). Single source of truth for the "what happens when
// the agent chases" data writes — called from both code paths that
// represent a chase action:
//
//   1. advanceChaseTask  — agent clicks the ↻ Chased button (mark-only,
//                          no email sent)
//   2. createCommunicationRecord — agent sends an outbound chase comm
//                          via the big Chase button (drawer / email send)
//
// Before 2026-06: only path 1 advanced nextDueDate. Path 2 bumped
// chaseCount but left nextDueDate stuck in the past, so rows chased via
// the drawer never moved out of Overdue. Now both paths share this helper.
//
// No scope check here — callers are responsible for verifying the task
// belongs to the actor's scope BEFORE calling this.
export async function applyChaseToTask(chaseTaskId: string): Promise<void> {
  const task = await prisma.chaseTask.findUnique({
    where: { id: chaseTaskId },
    select: {
      id: true,
      chaseCount: true,
      reminderLog: {
        select: {
          id: true,
          nextDueDate: true,
          reminderRule: { select: { repeatEveryDays: true } },
        },
      },
    },
  });
  if (!task) return;

  const newChaseCount = task.chaseCount + 1;
  const repeatDays = task.reminderLog.reminderRule.repeatEveryDays;
  const nowTs = Date.now();
  // Base the new due date on max(today, currentDue) so chasing an overdue
  // row always lands the next chase in the future — early/proactive chases
  // still preserve the rule's cadence.
  const base = task.reminderLog.nextDueDate.getTime() > nowTs
    ? task.reminderLog.nextDueDate
    : new Date(nowTs);
  const raw = new Date(base);
  raw.setDate(raw.getDate() + repeatDays);
  // Normalise to 06:00 UK on the resulting calendar day so the next chase
  // is live before the working day starts.
  const nextDue = setUkChaseTime(raw);

  await prisma.$transaction([
    prisma.chaseTask.update({
      where: { id: chaseTaskId },
      data: {
        chaseCount: newChaseCount,
        priority: "normal",
        lastChasedAt: new Date(nowTs),
      },
    }),
    prisma.reminderLog.update({
      where: { id: task.reminderLog.id },
      data: { nextDueDate: nextDue },
    }),
  ]);
}

export async function advanceChaseTask(taskId: string, scope: AccessScope) {
  // Scope guard — ensure the task belongs to a tx in the caller's scope.
  const task = await prisma.chaseTask.findFirst({
    where: scopeChaseTaskWhere(scope, taskId),
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");
  await applyChaseToTask(taskId);
}

export async function completeChaseTask(
  taskId: string,
  scope: AccessScope,
): Promise<{ transactionId: string; reminderLogId: string; targetMilestoneCode: string | null }> {
  const task = await prisma.chaseTask.findFirst({
    where: scopeChaseTaskWhere(scope, taskId),
    select: {
      id: true,
      reminderLogId: true,
      transactionId: true,
      reminderLog: {
        select: { reminderRule: { select: { targetMilestoneCode: true } } },
      },
    },
  });
  if (!task) throw new Error("Task not found");

  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { status: "done" },
  });

  const targetMilestoneCode = task.reminderLog.reminderRule.targetMilestoneCode;

  // If there's no target milestone, close the reminder log now.
  // If there is one, the caller will call completeMilestone which auto-closes it.
  if (!targetMilestoneCode) {
    await prisma.reminderLog.update({
      where: { id: task.reminderLogId },
      data: { status: "completed", statusReason: "Chase task marked done" },
    });
  }

  return { transactionId: task.transactionId, reminderLogId: task.reminderLogId, targetMilestoneCode };
}

export async function cancelChaseTask(taskId: string, agencyId: string) {
  const task = await prisma.chaseTask.findFirst({
    where: { id: taskId, transaction: { agencyId } },
    select: { id: true },
  });
  if (!task) throw new Error("Task not found");

  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { status: "cancelled" },
  });
}

export async function snoozeReminderLog(taskId: string, snoozeHours: number, scope: AccessScope) {
  const task = await prisma.chaseTask.findFirst({
    where: scopeChaseTaskWhere(scope, taskId),
    select: { id: true, reminderLogId: true },
  });
  if (!task) throw new Error("Task not found");

  // Snooze: add the requested hours from now, then normalise the resulting
  // date+time to 06:00 UK on the wake-up calendar day. Without this,
  // snoozing at e.g. 21:00 with snoozeHours=24 would set the wake at 21:00
  // the next day — chase fires late evening instead of being live before
  // the working day starts.
  const snoozedUntil = setUkChaseTime(new Date(Date.now() + snoozeHours * 60 * 60 * 1000));

  await prisma.chaseTask.update({
    where: { id: taskId },
    data: { status: "cancelled" },
  });

  await prisma.reminderLog.update({
    where: { id: task.reminderLogId },
    data: { snoozedUntil, nextDueDate: snoozedUntil },
  });
}

export async function wakeUpReminderLog(logId: string, scope: AccessScope) {
  const log = await prisma.reminderLog.findFirst({
    where: scopeReminderLogWhere(scope, logId),
    select: { id: true },
  });
  if (!log) throw new Error("Reminder log not found");

  await prisma.reminderLog.update({
    where: { id: logId },
    data: { snoozedUntil: null, nextDueDate: setUkChaseTime(new Date()) },
  });
}

export async function autoCompleteRemindersForMilestone(
  transactionId: string,
  milestoneCode: string,
  // Audit-trail reason for the status flip. Defaults to the common case
  // (milestone marked Complete). Pass "Milestone marked not required"
  // when the trigger was an NR flip, so the log's statusReason matches
  // what actually closed the milestone.
  reason: string = "Milestone completed",
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  const logs = await db.reminderLog.findMany({
    where: {
      transactionId,
      status: "active",
      reminderRule: { targetMilestoneCode: milestoneCode },
    },
    select: { id: true },
  });
  if (logs.length === 0) return;

  const logIds = logs.map((l) => l.id);

  await db.chaseTask.updateMany({
    where: { reminderLogId: { in: logIds }, status: "pending" },
    data: { status: "cancelled" },
  });

  await db.reminderLog.updateMany({
    where: { id: { in: logIds } },
    data: { status: "completed", statusReason: reason },
  });
}

// ─── Fail-soft fallback helper (A4 + B3 of the client-chase arc) ────────────
//
// Creates an agent ChaseTask for a milestone when automated client chasing
// has failed — every failure mode that means "system can't / won't chase
// this client any further" routes here, so the agent gets the file back
// with a clear human-readable reason. The leverage is making the reason
// visible: the agent sees WHY this landed on them, not just THAT it did.
//
// Five fallback kinds today (B8 will add hard_bounce_on_last_send later
// alongside the SendGrid webhook):
//   - client_opted_out          (A2/A3 contact-unsubscribe path)
//   - max_chases_exhausted      (Sub-arc B escalation: chaseCount >= 2)
//   - days_cap_exhausted        (Sub-arc B escalation: 14d silence)
//   - no_email_on_contact       (data gap: chase would fail-deliver)
//   - no_portalToken_on_contact (data gap: chase has nowhere to link to)
//
// Writes three artefacts:
//   1. ChaseTask row — fallbackKind set so the UI renders the kind-specific
//      chip; assigned to the file's progressor (or agent if self-managed);
//      status pending, priority normal.
//   2. ReminderLog parent — statusReason set with the structured reason for
//      this kind. Queryable provenance field.
//   3. OutboundMessage internal-note — populates the activity feed with a
//      kind-specific human-readable explanation so a year later you can see
//      exactly when and why this turned manual.
//
// Idempotent re-call: if an active log + pending task already exist for
// this (transaction, rule), no second task is created.
//
// Sub-arc B's cron (B7) is the production caller. B3 leaves no callers
// added yet; the helper is testable via scripts/verify-b3.ts.
export type FallbackKind =
  | "client_opted_out"
  | "max_chases_exhausted"
  | "days_cap_exhausted"
  | "no_email_on_contact"
  | "no_portalToken_on_contact"
  | "client_emails_paused";

// Structured statusReason text written to ReminderLog.statusReason. Locked
// at user sign-off — do not edit without the corresponding chip-text + audit-
// note copy review.
const FALLBACK_REASON: Record<FallbackKind, string> = {
  client_opted_out:             "Client opted out of automated chases — handed to agent",
  max_chases_exhausted:         "Client chased twice, no response — handed to agent",
  days_cap_exhausted:           "Client silent for 14 days — handed to agent",
  no_email_on_contact:          "Client contact missing email address — handed to agent",
  no_portalToken_on_contact:    "Client contact missing portal access — handed to agent",
  client_emails_paused:         "Client emails paused on this file — handed to agent",
};

// Common input fields every kind requires.
type FallbackInputBase = {
  transactionId: string;
  milestoneCode: string;
  contactName: string;
};

// Discriminated input — kind determines what additional context is required.
// Forces callers to supply the right metadata at compile time.
export type FallbackInput =
  | (FallbackInputBase & { kind: "client_opted_out";          optedOutAt: Date })
  | (FallbackInputBase & { kind: "max_chases_exhausted";      chaseCount: number; lastChasedAt: Date })
  | (FallbackInputBase & { kind: "days_cap_exhausted";        firstChasedAt: Date })
  | (FallbackInputBase & { kind: "no_email_on_contact" })
  | (FallbackInputBase & { kind: "no_portalToken_on_contact" })
  | (FallbackInputBase & { kind: "client_emails_paused";      pausedScope: "agency" | "file" });

// Human-readable activity-feed note. Each kind gets a kind-specific
// rendering using its required context. Date formatting matches the rest of
// the activity timeline.
function fallbackActivityNote(input: FallbackInput): string {
  const dateFmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  switch (input.kind) {
    case "client_opted_out":
      return `Automated client chase suppressed — ${input.contactName} opted out on ${dateFmt(input.optedOutAt)}. Reminder handed back to agent.`;
    case "max_chases_exhausted":
      return `Automated client chase suppressed — ${input.contactName} chased ${input.chaseCount} time${input.chaseCount === 1 ? "" : "s"} (last on ${dateFmt(input.lastChasedAt)}) with no response. Reminder handed back to agent.`;
    case "days_cap_exhausted":
      return `Automated client chase suppressed — ${input.contactName} silent since first chase on ${dateFmt(input.firstChasedAt)} (14-day cap reached). Reminder handed back to agent.`;
    case "no_email_on_contact":
      return `Automated client chase couldn't fire — ${input.contactName} has no email address on file. Reminder handed back to agent.`;
    case "no_portalToken_on_contact":
      return `Automated client chase couldn't fire — ${input.contactName} has no portal access (no token issued). Reminder handed back to agent.`;
    case "client_emails_paused":
      return input.pausedScope === "agency"
        ? `Automated client chase paused — chase emails are switched off agency-wide. Reminder handed back to agent.`
        : `Automated client chase paused — chase emails are paused on this file. Reminder handed back to agent.`;
  }
}

export async function createAgentChaseTaskForMilestone(
  input: FallbackInput
): Promise<{ logId: string; taskId: string } | null> {
  const { transactionId, milestoneCode, kind } = input;

  // Resolve the file's agent / progressor — the task gets assigned to them.
  // Commit 4c-followup — also fetch activeBuyerRoundId for round stamping.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { agentUserId: true, assignedUserId: true, activeBuyerRoundId: true },
  });
  if (!tx) return null;
  const assignedToId = tx.assignedUserId ?? tx.agentUserId;
  if (!assignedToId) return null;
  // PM-targeted fallback rows stamp the active round; VM-targeted stay file-level.
  const stampRoundId = milestoneCode.startsWith("PM") ? (tx.activeBuyerRoundId ?? null) : null;

  // Find the active ReminderRule that targets this milestone. If multiple
  // rules target the same code (rare), use the first — matches the existing
  // engine's behaviour at `evaluateTransactionReminders`.
  const rule = await prisma.reminderRule.findFirst({
    where: { isActive: true, targetMilestoneCode: milestoneCode },
    select: { id: true },
  });
  if (!rule) return null;

  // Find-or-create the ReminderLog for this (transaction, rule). Mirrors the
  // engine's idempotency pattern.
  const existingLog = await prisma.reminderLog.findFirst({
    where: { transactionId, reminderRuleId: rule.id, status: "active" },
    select: { id: true },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const log = existingLog
    ? await prisma.reminderLog.update({
        where: { id: existingLog.id },
        data: {
          statusReason: FALLBACK_REASON[kind],
          nextDueDate: today,
        },
        select: { id: true },
      })
    : await prisma.reminderLog.create({
        data: {
          transactionId,
          reminderRuleId: rule.id,
          status: "active",
          nextDueDate: today,
          sourceDateUsed: today,
          statusReason: FALLBACK_REASON[kind],
          // Commit 4c-followup — same PM*-targeted → active round stamp.
          buyerRoundId: stampRoundId,
        },
        select: { id: true },
      });

  // Find-or-create the pending ChaseTask. If one is already pending for this
  // log, update it with the fallback marker; never create a second.
  const existingTask = await prisma.chaseTask.findFirst({
    where: { reminderLogId: log.id, status: "pending" },
    select: { id: true },
  });

  const task = existingTask
    ? await prisma.chaseTask.update({
        where: { id: existingTask.id },
        data: { fallbackKind: kind, assignedToId, dueDate: today, priority: "normal" },
        select: { id: true },
      })
    : await prisma.chaseTask.create({
        data: {
          transactionId,
          reminderLogId: log.id,
          assignedToId,
          dueDate: today,
          status: "pending",
          priority: "normal",
          chaseCount: 0,
          fallbackKind: kind,
          // Commit 4c-followup — inherit the parent ReminderLog's stamp.
          buyerRoundId: stampRoundId,
        },
        select: { id: true },
      });

  // Activity-feed note — surfaces the reason in the agent's comm timeline so
  // it isn't only visible on the work-queue row.
  await prisma.outboundMessage.create({
    data: {
      transactionId,
      type: "internal_note",
      content: fallbackActivityNote(input),
      createdById: assignedToId,
      chaseTaskId: task.id,
      isAutomated: true,
    },
  });

  return { logId: log.id, taskId: task.id };
}
