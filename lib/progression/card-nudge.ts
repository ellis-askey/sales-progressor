// Item 9 — the "no card yet" nudge for an external progression business.
//
// When an ordinary agent sends a sale to a progression business that hasn't added a
// card, we never block the agent (see createTransaction's fromAgentIntake). Instead
// the OWNER is nudged to add a card, escalating over a week:
//   day 0–2  prompt  — a calm dashboard card
//   day 3–6  warn    — amber, with a deadline
//   day 7+   blocked — new agent-sent sales are HELD (heldPendingCardAt) until a card
//                      is added; sales already running keep going, untouched.
// The clock starts from the earliest sale the business owes for but hasn't paid.
// Adding a card clears the held flags (releaseHeldSales) and starts those sales
// progressing; the accrued £5s collect on the next invoice.

import { prisma } from "@/lib/prisma";
import { progressionBillingCollectEnabled } from "./flags";
import { businessBillingActive } from "./business-stripe";

export type CardNudgeStage = "none" | "prompt" | "warn" | "blocked";

export type CardNudge = {
  needsCard: boolean;
  stage: CardNudgeStage;
  daysSince: number; // whole days since the oldest owed-but-unpaid sale
  owedCount: number; // sales taken on but not yet paid for
  waitingCount: number; // sales currently held pending a card
  deadline: Date | null; // when the day-7 block kicks in (oldest + 7 days)
};

const WARN_DAY = 3;
const BLOCK_DAY = 7;
const DAY_MS = 86_400_000;

const NONE: CardNudge = { needsCard: false, stage: "none", daysSince: 0, owedCount: 0, waitingCount: 0, deadline: null };

/** The current escalation state for a business. "none" when billing is dark, a card
 *  is on file, or there's nothing owed. */
export async function getBusinessCardNudge(businessId: string, now: Date = new Date()): Promise<CardNudge> {
  if (!progressionBillingCollectEnabled()) return NONE;
  if (await businessBillingActive(businessId)) return NONE;

  // Sales the business owes for but hasn't paid (per-sale charge stamped, not yet
  // invoiced). With no card on file these are all agent-sent — the owner's own
  // create-for-client / bring-in are gated, so they can't exist without a card.
  const [owed, waitingCount] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: {
        progressionBusinessId: businessId,
        isDemo: false,
        businessPerSaleChargedAt: { not: null },
        businessPerSaleInvoicedAt: null,
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.propertyTransaction.count({
      where: { progressionBusinessId: businessId, heldPendingCardAt: { not: null } },
    }),
  ]);

  if (owed.length === 0 && waitingCount === 0) return NONE;

  const earliest = owed[0]?.createdAt ?? now;
  const daysSince = Math.max(0, Math.floor((now.getTime() - earliest.getTime()) / DAY_MS));
  const stage: CardNudgeStage = daysSince >= BLOCK_DAY ? "blocked" : daysSince >= WARN_DAY ? "warn" : "prompt";
  return {
    needsCard: true,
    stage,
    daysSince,
    owedCount: owed.length,
    waitingCount,
    deadline: new Date(earliest.getTime() + BLOCK_DAY * DAY_MS),
  };
}

/** Whether a NEW agent-sent sale should be held (day-7 blocked stage) rather than
 *  started. Called by createTransaction on the agent-intake path. */
export async function shouldHoldAgentIntake(businessId: string, now: Date = new Date()): Promise<boolean> {
  return (await getBusinessCardNudge(businessId, now)).stage === "blocked";
}

/**
 * Release every held sale for a business once a card is on file: clear the held flag
 * and start each one progressing (reminders + the white-labelled intro email), as a
 * normal agent-sent sale would have on creation. Idempotent — clears the flags first,
 * so a second call finds nothing. Called from syncBusinessSubscriptionAction after a
 * card is captured. Returns how many were released.
 */
export async function releaseHeldSales(businessId: string): Promise<number> {
  const held = await prisma.propertyTransaction.findMany({
    where: { progressionBusinessId: businessId, heldPendingCardAt: { not: null } },
    select: { id: true, createdAt: true, assignedUserId: true, agentUserId: true, activeBuyerRoundId: true },
  });
  if (held.length === 0) return 0;

  await prisma.propertyTransaction.updateMany({
    where: { progressionBusinessId: businessId, heldPendingCardAt: { not: null } },
    data: { heldPendingCardAt: null },
  });

  const { createInitialRemindersInline, evaluateTransactionReminders } = await import("@/lib/services/reminders");
  const { sendOutsourceIntroForTransaction } = await import("@/lib/emails/send-outsource-intro");
  for (const tx of held) {
    // Start it progressing now, exactly as it would have on creation. Each is
    // fire-and-forget so one failure can't strand the rest.
    await createInitialRemindersInline(tx.id, tx.createdAt, tx.assignedUserId, [], tx.activeBuyerRoundId)
      .catch((e) => console.error(`[card-nudge] reminders on release failed for ${tx.id}`, e));
    void evaluateTransactionReminders(tx.id).catch(() => {});
    const introActor = tx.assignedUserId ?? tx.agentUserId;
    if (introActor) {
      void sendOutsourceIntroForTransaction(tx.id, introActor).catch((e) => console.error(`[card-nudge] intro on release failed for ${tx.id}`, e));
    }
  }
  return held.length;
}
