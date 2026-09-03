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

// ── Email health ─────────────────────────────────────────────────────────────
//
// Deliverability of the automated email queue over the period, from the
// SendGrid webhook columns. Covers the queue (client chases + notifications) —
// the rich-webhook pipeline. Solicitor sends carry only a coarse status and low
// volume, so they're left out to keep these rates precise rather than blended.
//
// "unknown" is honest: we handed the message to SendGrid but no delivery event
// has come back yet (webhook confirmation is partial). It is NOT counted as
// delivered — the delivery rate only claims what we've actually confirmed.

export type EmailHealth = {
  periodDays: number;
  totalSent: number;
  delivered: number;
  deferred: number;   // deferred by the recipient server, not yet delivered
  bounced: number;
  blocked: number;
  unknown: number;    // sent, no delivery event back yet
  deliveryRatePct: number | null;  // delivered / totalSent
  bounceRatePct: number | null;    // (bounced + blocked) / totalSent
};

export async function getEmailHealth(input: EmailScopeInput & { periodDays: number }): Promise<EmailHealth> {
  const { txIds, queueScope } = await resolveEmailScope(input);
  const empty: EmailHealth = {
    periodDays: input.periodDays, totalSent: 0, delivered: 0, deferred: 0, bounced: 0, blocked: 0, unknown: 0,
    deliveryRatePct: null, bounceRatePct: null,
  };
  if (txIds.length === 0) return empty;

  const periodStart = new Date(Date.now() - input.periodDays * DAY);
  const rows = await prisma.outboundEmailQueue.findMany({
    where: { ...queueScope, sentAt: { gte: periodStart } },
    select: { sentAt: true, emailType: true, recipientContactId: true, deliveredAt: true, deferredAt: true, bouncedAt: true, blockedAt: true },
    take: 20000,
  });

  // Collapse milestone digests (N rows delivered as one email share the same
  // recipient + sentAt) so a bundle counts once — matching the activity KPIs.
  const seenDigest = new Set<string>();
  let delivered = 0, deferred = 0, bounced = 0, blocked = 0, unknown = 0;
  for (const r of rows) {
    if (r.emailType === "MILESTONE_CONFIRMATION" && r.recipientContactId && r.sentAt) {
      const key = `${r.recipientContactId}|${r.sentAt.getTime()}`;
      if (seenDigest.has(key)) continue;
      seenDigest.add(key);
    }
    // Most-bad-wins, mirroring deriveQueueDeliveryStatus for sent rows.
    if (r.bouncedAt) bounced++;
    else if (r.blockedAt) blocked++;
    else if (r.deferredAt && !r.deliveredAt) deferred++;
    else if (r.deliveredAt) delivered++;
    else unknown++;
  }
  const totalSent = delivered + deferred + bounced + blocked + unknown;

  return {
    periodDays: input.periodDays,
    totalSent, delivered, deferred, bounced, blocked, unknown,
    deliveryRatePct: pct(delivered, totalSent),
    bounceRatePct: pct(bounced + blocked, totalSent),
  };
}
