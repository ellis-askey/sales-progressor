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
import { unlockDirectDependents, maybeUnlockExchangeGate, replayEnquirySyncForCodes } from "@/lib/services/milestones";
import { evaluateTransactionReminders, autoCompleteRemindersForMilestone } from "@/lib/services/reminders";
import { flipReferralEarnedForMilestone } from "@/lib/services/referrals";

// Mirror pairs: steps that are ONE real-world event seen from both desks.
// completeMilestone auto-completes the counterpart when either side is confirmed;
// the direct-write path here must do the same, or a migrated file can show one
// side of a pair done and the other outstanding (and chase the phantom step).
const MIRROR_PAIRS: Record<string, string> = {
  PM14: "VM10", VM10: "PM14", // enquiries raised <-> received
  VM7: "PM7", PM7: "VM7",     // contract pack issued <-> received
  PM20: "VM21", VM21: "PM20", // enquiries satisfied (both sides)
};

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

  const tickedIds = input.completions.map((c) => c.milestoneDefinitionId);
  const tickedDefs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: tickedIds } },
    select: { id: true, code: true, name: true, side: true, eventDateRequired: true },
  });
  const tickedCodes = new Set(tickedDefs.map((d) => d.code));

  // Mirror expansion: for each ticked step whose paired step is NOT also ticked,
  // auto-complete the pair with the SAME historical date (it is the same event).
  const counterpartCodes = new Set<string>();
  for (const code of tickedCodes) {
    const mate = MIRROR_PAIRS[code];
    if (mate && !tickedCodes.has(mate)) counterpartCodes.add(mate);
  }
  const counterpartDefs =
    counterpartCodes.size > 0
      ? await prisma.milestoneDefinition.findMany({
          where: { code: { in: [...counterpartCodes] } },
          select: { id: true, code: true, name: true, side: true, eventDateRequired: true },
        })
      : [];
  const defById = new Map([...tickedDefs, ...counterpartDefs].map((d) => [d.id, d]));
  const defIdByCode = new Map([...tickedDefs, ...counterpartDefs].map((d) => [d.code, d.id]));

  // The expanded work list = the ticked completions + the missing mirror sides.
  // De-duped by definition id. `applied` (returned) still counts only the
  // caller's REQUESTED ticks, so its all-or-nothing check is unaffected.
  const requestedIds = new Set(tickedIds);
  const completions = [...input.completions];
  const seenIds = new Set(tickedIds);
  for (const c of input.completions) {
    const def = defById.get(c.milestoneDefinitionId);
    if (!def) continue;
    const mate = MIRROR_PAIRS[def.code];
    if (!mate || tickedCodes.has(mate)) continue;
    const mateId = defIdByCode.get(mate);
    if (mateId && !seenIds.has(mateId)) {
      completions.push({ milestoneDefinitionId: mateId, eventDate: c.eventDate });
      seenIds.add(mateId);
    }
  }

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
  // Codes completed in this run — drives the enquiry-tracker / raise-chase replay
  // below, since writing completions directly bypasses completeMilestone's sync.
  const appliedCodes = new Set<string>();
  // Historical date applied per code — read below for the exchange stamp (VM19/
  // PM26) and the mortgage-offer expiry (PM11).
  const eventByCode = new Map<string, Date>();
  // When this import runs — the honest "recorded" time for event-date milestones
  // whose supplied date is a real-world EVENT date (see completedAtValue below).
  const importedAt = new Date();

  for (let i = 0; i < completions.length; i++) {
    const c = completions[i]!;
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

      // `applied` counts only the caller's requested ticks (not auto-added mirror
      // sides), so the caller's all-or-nothing check still works.
      if (requestedIds.has(c.milestoneDefinitionId)) applied++;
      appliedCodes.add(def.code);
      eventByCode.set(def.code, eventDateObj);
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

  // Writing completions directly bypassed completeMilestone's per-tick enquiry
  // sync, so replay it from the final completed set. Without this a migrated file
  // with enquiries raised-but-not-satisfied has no EnquiryTracker — invisible on
  // the Enquiries page and never enquiry-chased (Boardwalk go-live, 2026-11-10).
  await replayEnquirySyncForCodes(input.transactionId, appliedCodes).catch((err) =>
    console.error(`[applyMigratedMilestoneCompletions] enquiry sync replay failed:`, err),
  );

  // One reminder-engine pass against the new completion state — seeds the
  // reminders the file should have now, no duplicates for completed ones.
  await evaluateTransactionReminders(input.transactionId).catch((err) =>
    console.error(`[applyMigratedMilestoneCompletions] reminder evaluate failed:`, err),
  );

  // Exchange stamp (completeMilestone's maybeStampExchange, MINUS the billing):
  // exchangedAt + priceAtExchange so the ~200 forward readers (completion-day,
  // chase timeline, exchange prediction, hub, chain) see the file as exchanged.
  // Uses the real historical exchange date. Billing is deliberately NOT stamped:
  // a sale that exchanged BEFORE joining isn't charged for that exchange. Client
  // comms stay gated by the file's clientEmailsPaused, so no retrospective send.
  const exchangeDate = eventByCode.get("VM19") ?? eventByCode.get("PM26") ?? null;
  if (exchangeDate) {
    const txnForEx = await prisma.propertyTransaction.findUnique({
      where: { id: input.transactionId },
      select: { purchasePrice: true },
    });
    await prisma.propertyTransaction.updateMany({
      where: { id: input.transactionId, exchangedAt: null },
      data: { exchangedAt: exchangeDate },
    }).catch((err) => console.error(`[applyMigratedMilestoneCompletions] exchangedAt stamp failed:`, err));
    await prisma.propertyTransaction.updateMany({
      where: { id: input.transactionId, priceAtExchange: null },
      data: { priceAtExchange: txnForEx?.purchasePrice ?? null },
    }).catch((err) => console.error(`[applyMigratedMilestoneCompletions] priceAtExchange stamp failed:`, err));
  }

  // Mortgage-offer expiry (completeMilestone's PM11 hook): pencil a 6-month approx
  // expiry from the offer date if the buyer has none, so the hub/portal/reminder
  // prompts appear on a migrated file too. Never overwrites an existing expiry.
  const offerDate = eventByCode.get("PM11");
  if (offerDate) {
    try {
      const mi = await prisma.clientMoveInfo.findUnique({
        where: { transactionId_side: { transactionId: input.transactionId, side: "purchaser" } },
        select: { mortgageOfferExpiry: true },
      });
      if (!mi?.mortgageOfferExpiry) {
        const expiry = new Date(offerDate);
        expiry.setMonth(expiry.getMonth() + 6);
        await prisma.clientMoveInfo.upsert({
          where: { transactionId_side: { transactionId: input.transactionId, side: "purchaser" } },
          create: { transactionId: input.transactionId, side: "purchaser", mortgageOfferExpiry: expiry, mortgageOfferExpiryApprox: true },
          update: { mortgageOfferExpiry: expiry, mortgageOfferExpiryApprox: true },
        });
      }
    } catch (err) {
      console.error(`[applyMigratedMilestoneCompletions] PM11 mortgage-offer-expiry failed:`, err);
    }
  }

  // Referral ledger (completeMilestone's flipReferralEarnedForMilestone): flip the
  // buyer-broker (PM5) / solicitor (completion) referrals to "earned" when their
  // trigger step is in the migrated set. No-op for every other code.
  for (const code of appliedCodes) {
    await flipReferralEarnedForMilestone(prisma, input.transactionId, code, migrateRoundId).catch((err) =>
      console.error(`[applyMigratedMilestoneCompletions] referral flip failed for ${code}:`, err),
    );
  }

  return { applied, latestEventTime };
}
