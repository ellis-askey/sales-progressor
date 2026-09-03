// Analytics for the Automated-emails tabs: chase performance + email health.
//
// Scoped through resolveEmailScope like every other module on this surface, so
// no aggregate can leak across a viewer's scope. Honesty rules apply (same as
// the overview service): every figure is derived from real state, and a rate is
// null — shown as "n/a" — rather than invented when there's nothing to divide.

import { prisma } from "@/lib/prisma";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";

const DAY = 86_400_000;

// ── Chase performance ────────────────────────────────────────────────────────
//
// "Are our client chases working?" Derived from ClientChaseState, which carries
// the real outcome: whether the client engaged after a chase (lastEngagedAt),
// and why a chase ended (statusReason). Solicitor chases have no engagement
// signal, so this view is deliberately client-chase only and labelled as such.

// statusReason vocabulary (see the schema comment on ClientChaseState.status).
const RESOLVED_REASONS = new Set(["milestone_completed", "portal_confirmed"]);
const ESCALATED_REASONS = new Set(["chase_count", "silence_14d"]);

export type ChasePerformance = {
  periodDays: number;
  totalChased: number;       // client-chase states that have sent at least one chase
  engaged: number;           // client engaged after a chase (lastEngagedAt set)
  stillChasing: number;      // still active
  resolved: number;          // ended because the milestone got done
  escalated: number;         // needed a person (chase cap / 14-day silence)
  closedOther: number;       // ended for another reason (reversed / relisted / on hold)
  responseRatePct: number | null;   // engaged / totalChased
  resolutionRatePct: number | null; // resolved / totalChased
  avgChasesToResolve: number | null;
  chasesSentPeriod: number;  // client chase emails actually sent in the period
};

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getChasePerformance(input: EmailScopeInput & { periodDays: number }): Promise<ChasePerformance> {
  const { txIds, queueScope } = await resolveEmailScope(input);
  const empty: ChasePerformance = {
    periodDays: input.periodDays,
    totalChased: 0, engaged: 0, stillChasing: 0, resolved: 0, escalated: 0, closedOther: 0,
    responseRatePct: null, resolutionRatePct: null, avgChasesToResolve: null, chasesSentPeriod: 0,
  };
  if (txIds.length === 0) return empty;

  const periodStart = new Date(Date.now() - input.periodDays * DAY);

  const [states, chasesSentPeriod] = await Promise.all([
    prisma.clientChaseState.findMany({
      where: { transactionId: { in: txIds }, chaseCount: { gt: 0 } },
      select: { status: true, statusReason: true, chaseCount: true, lastEngagedAt: true },
    }),
    prisma.outboundEmailQueue.count({ where: { ...queueScope, emailType: "CLIENT_CHASE", sentAt: { gte: periodStart } } }),
  ]);

  let engaged = 0, stillChasing = 0, resolved = 0, escalated = 0, closedOther = 0;
  let resolvedChaseSum = 0;
  for (const s of states) {
    if (s.lastEngagedAt) engaged++;
    if (s.status === "active") {
      stillChasing++;
    } else if (s.statusReason && RESOLVED_REASONS.has(s.statusReason)) {
      resolved++;
      resolvedChaseSum += s.chaseCount;
    } else if (s.statusReason && ESCALATED_REASONS.has(s.statusReason)) {
      escalated++;
    } else {
      closedOther++;
    }
  }
  const totalChased = states.length;

  return {
    periodDays: input.periodDays,
    totalChased,
    engaged,
    stillChasing,
    resolved,
    escalated,
    closedOther,
    responseRatePct: pct(engaged, totalChased),
    resolutionRatePct: pct(resolved, totalChased),
    avgChasesToResolve: resolved > 0 ? Math.round((resolvedChaseSum / resolved) * 10) / 10 : null,
    chasesSentPeriod,
  };
}
