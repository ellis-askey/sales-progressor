// Shared core for backdated ("historical") milestone ticks during a Migrate
// Sale import. Extracted verbatim from the admin migrateCompleteMilestonesAction
// so the admin page and the Boardwalk self-service flow produce byte-identical
// results and can never drift (Law 4). This module does NO auth — each caller
// gates itself (admin role / Boardwalk agency allowlist) before calling in.
//
// It is DELIBERATELY SILENT. It writes MilestoneCompletion rows directly rather
// than going through completeMilestone / confirmMilestoneAction, so none of the
// milestone-completion fan-out (client/portal emails, web push, completion
// pack, chain notifications, celebration, OutboundMessage activity) runs for a
// historical tick. completedAt is the user-supplied HISTORICAL date; eventDate
// is populated only for eventDateRequired milestones; summaryText is left null
// so the timeline renders the milestone's normal name with no "[Migrated]"
// marker; lastActivityAt is back-stamped to the latest ticked event so the file
// reads "Active X ago", not "Just added".

import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { unlockDirectDependents, maybeUnlockExchangeGate } from "@/lib/services/milestones";
import { evaluateTransactionReminders, autoCompleteRemindersForMilestone } from "@/lib/services/reminders";

export type MigratedCompletionInput = {
  milestoneDefinitionId: string;
  // ISO date string (yyyy-mm-dd) or a Date — the real-world historical date.
  eventDate: string | Date;
};

export async function applyMigratedMilestoneCompletions(input: {
  transactionId: string;
  completions: MigratedCompletionInput[];
  // Attribution identity for the ticks. Null renders as "Auto-confirmed"
  // (like portal confirmations) rather than "Admin confirmed X".
  completerId: string | null;
}): Promise<{ applied: number; latestEventTime: number }> {
  if (input.completions.length === 0) return { applied: 0, latestEventTime: 0 };

  const defIds = input.completions.map((c) => c.milestoneDefinitionId);
  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: defIds } },
    select: { id: true, code: true, name: true, side: true, eventDateRequired: true },
  });
  const defById = new Map(defs.map((d) => [d.id, d]));

  const completerId = input.completerId;

  // Round scope for find-after-write + create-branch stamping.
  const txRowForMigrate = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const migrateRoundId = txRowForMigrate?.activeBuyerRoundId ?? null;
  const migrateScope = forRound(migrateRoundId, input.transactionId);

  let applied = 0;
  let latestEventTime = 0;
  // When this import runs — the honest "recorded" time for event-date milestones
  // whose supplied date is a real-world EVENT date (see completedAtValue below).
  const importedAt = new Date();

  for (let i = 0; i < input.completions.length; i++) {
    const c = input.completions[i]!;
    const def = defById.get(c.milestoneDefinitionId);
    if (!def) continue;

    const eventDateObj = c.eventDate instanceof Date ? c.eventDate : new Date(c.eventDate);
    if (Number.isNaN(eventDateObj.getTime())) continue;
    if (eventDateObj.getTime() > latestEventTime) latestEventTime = eventDateObj.getTime();

    // eventDate is a semantic real-world-event field — populate it only for
    // milestones whose definition carries eventDateRequired: true (survey,
    // valuation, mortgage offer, exchange, completion target). For other
    // milestones the user-supplied date is the historical completedAt only.
    const eventDateForCompletion = def.eventDateRequired ? eventDateObj : null;
    // For an eventDateRequired milestone the supplied date is the real-world
    // EVENT date (e.g. the survey/valuation visit), which can be in the future.
    // That belongs in eventDate, NOT completedAt — "Confirmed by your team" must
    // reflect when we recorded it (the import), never a future event date. For
    // every other milestone the supplied date IS the historical completion.
    const completedAtValue = def.eventDateRequired ? importedAt : eventDateObj;

    try {
      await prisma.$transaction(async (ptx) => {
        const existing = await ptx.milestoneCompletion.findFirst({
          where: {
            transactionId: input.transactionId,
            milestoneDefinitionId: c.milestoneDefinitionId,
            ...milestoneScopeWhere(migrateScope),
          },
          select: { id: true },
        });
        if (existing) {
          await ptx.milestoneCompletion.update({
            where: { id: existing.id },
            data: {
              state: "complete",
              completedAt: completedAtValue,
              eventDate: eventDateForCompletion,
              completedById: completerId,
              notRequiredReason: null,
              // If the row was previously NR'd, complete it cleanly without
              // dragging the NR attribution forward.
              notRequiredById: null,
              notRequiredAt: null,
              summaryText: null,
            },
          });
          return;
        }
        await ptx.milestoneCompletion.create({
          data: {
            transactionId: input.transactionId,
            milestoneDefinitionId: c.milestoneDefinitionId,
            state: "complete",
            completedAt: completedAtValue,
            eventDate: eventDateForCompletion,
            completedById: completerId,
            summaryText: null,
            buyerRoundId: def.side === "purchaser" ? migrateRoundId : null,
          },
        });
      });

      await unlockDirectDependents(input.transactionId, def.code).catch((err) =>
        console.error(`[applyMigratedMilestoneCompletions] unlock failed for ${def.code}:`, err),
      );

      // Flip any chase reminders targeting this milestone to status="completed"
      // (not merely "inactive") — we have proof this milestone happened. Mirrors
      // completeMilestoneAction's flow.
      await autoCompleteRemindersForMilestone(input.transactionId, def.code).catch((err) =>
        console.error(`[applyMigratedMilestoneCompletions] reminder auto-complete failed for ${def.code}:`, err),
      );

      applied++;
    } catch (err) {
      console.error(
        `[applyMigratedMilestoneCompletions] failed to apply ${def.code} on tx ${input.transactionId}:`,
        err,
      );
      // Best-effort per tick (matches the admin writer). The caller enforces
      // strictness by comparing the returned `applied` count to the number of
      // completions it submitted — a short count fails the import there.
    }
  }

  // Bump lastActivityAt to the most recent backdated event so the file reads
  // "Active X ago" rather than "Just added" on activity-driven UIs.
  if (latestEventTime > 0) {
    await prisma.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { lastActivityAt: new Date(latestEventTime) },
    }).catch((err) =>
      console.error(`[applyMigratedMilestoneCompletions] lastActivityAt bump failed:`, err),
    );
  }

  // Exchange-gate evaluation — unlockDirectDependents only handles predecessor
  // chains, but VM18 / PM25 depend on ALL side-blockers being complete. After
  // bulk-ticking, run the gate check for both sides.
  await maybeUnlockExchangeGate(input.transactionId, "vendor", completerId).catch((err) =>
    console.error(`[applyMigratedMilestoneCompletions] vendor gate unlock failed:`, err),
  );
  await maybeUnlockExchangeGate(input.transactionId, "purchaser", completerId).catch((err) =>
    console.error(`[applyMigratedMilestoneCompletions] purchaser gate unlock failed:`, err),
  );

  // One reminder-engine pass against the new completion state — seeds the
  // reminders the file should have now, no duplicates for completed ones.
  await evaluateTransactionReminders(input.transactionId).catch((err) =>
    console.error(`[applyMigratedMilestoneCompletions] reminder evaluate failed:`, err),
  );

  return { applied, latestEventTime };
}
