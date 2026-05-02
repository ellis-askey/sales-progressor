import { prisma } from "@/lib/prisma";
import { AgencyModeProfile, ServiceType } from "@prisma/client";

const LONDON_TZ = "Europe/London";

/** Returns a YYYY-MM-DD string for the given Date in London time */
export function londonDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LONDON_TZ }).format(d);
}

/** UTC boundaries of midnight → midnight for a YYYY-MM-DD string in London time */
function londonDayBounds(dateStr: string): { start: Date; end: Date } {
  // Determine UTC offset by checking what hour noon UTC falls in London (handles BST/GMT)
  const refUtc = new Date(`${dateStr}T12:00:00.000Z`);
  const londonNoonHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: LONDON_TZ,
      hour: "numeric",
      hour12: false,
    }).format(refUtc),
    10
  );
  const offsetHours = londonNoonHour - 12; // BST = 1, GMT = 0

  const start = new Date(`${dateStr}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - offsetHours);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

/** Returns the UTC Monday of the week containing d */
export function toMondayUtc(d: Date): Date {
  const monday = new Date(d);
  const day = monday.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  monday.setUTCDate(monday.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

type Scope = {
  agencyId: string | null;
  serviceType: ServiceType | null;
  modeProfile: AgencyModeProfile | null;
};

type MetricValues = {
  transactionsCreated: number;
  transactionsExchanged: number;
  transactionsCompleted: number;
  milestonesConfirmed: number;
  chasesSent: number;
  aiDraftsGenerated: number;
  filesUploaded: number;
  signups: number;
  logins: number;
  uniqueActiveUsers: number;
  feedbackSubmitted: number;
  aiSpendCents: number;
};

async function computeMetricsForScope(dateStr: string, scope: Scope): Promise<MetricValues> {
  const { start, end } = londonDayBounds(dateStr);

  // Resolve agencyIds for modeProfile scope upfront (single query)
  let modeAgencyIds: string[] | undefined;
  if (scope.modeProfile !== null && scope.agencyId === null) {
    const rows = await prisma.agency.findMany({
      where: { modeProfile: scope.modeProfile },
      select: { id: true },
    });
    modeAgencyIds = rows.map((r) => r.id);
  }

  // serviceType-only rows don't include agency-level metrics (logins, signups, etc.)
  const isServiceTypeScope =
    scope.serviceType !== null && scope.agencyId === null && scope.modeProfile === null;

  // Agency filter for event / feedback / message queries
  const agencyFilter: Record<string, unknown> =
    scope.agencyId !== null
      ? { agencyId: scope.agencyId }
      : modeAgencyIds !== undefined
        ? { agencyId: { in: modeAgencyIds } }
        : {};

  // Transaction filter (agencyId + modeProfile + serviceType)
  const txFilter: Record<string, unknown> = {
    ...agencyFilter,
    ...(scope.serviceType !== null && { serviceType: scope.serviceType }),
  };

  // OutboundMessage filter (agencyId + optional serviceType via transaction join)
  const msgFilter: Record<string, unknown> = {
    ...agencyFilter,
    ...(scope.serviceType !== null && {
      transaction: { serviceType: scope.serviceType },
    }),
  };

  const [
    transactionsCreated,
    transactionsExchanged,
    transactionsCompleted,
    milestonesConfirmed,
    chasesSent,
    aiDraftsGenerated,
    filesUploaded,
    signups,
    logins,
    uniqueActiveUsers,
    feedbackSubmitted,
    aiSpendResult,
  ] = await Promise.all([
    prisma.propertyTransaction.count({
      where: { createdAt: { gte: start, lt: end }, ...txFilter },
    }),

    // Exchange milestone VM19 (vendor) or PM26 (purchaser) — each transaction fires one
    prisma.milestoneCompletion.count({
      where: {
        completedAt: { gte: start, lt: end },
        state: "complete",
        milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
        transaction: txFilter,
      },
    }),

    // Completion milestone VM20 (vendor) or PM27 (purchaser)
    prisma.milestoneCompletion.count({
      where: {
        completedAt: { gte: start, lt: end },
        state: "complete",
        milestoneDefinition: { code: { in: ["VM20", "PM27"] } },
        transaction: txFilter,
      },
    }),

    prisma.milestoneCompletion.count({
      where: {
        completedAt: { gte: start, lt: end },
        state: "complete",
        transaction: txFilter,
      },
    }),

    prisma.outboundMessage.count({
      where: {
        purpose: "chase",
        sentAt: { gte: start, lt: end },
        ...msgFilter,
      },
    }),

    prisma.outboundMessage.count({
      where: {
        wasAiGenerated: true,
        createdAt: { gte: start, lt: end },
        ...msgFilter,
      },
    }),

    prisma.transactionDocument.count({
      where: { createdAt: { gte: start, lt: end }, transaction: txFilter },
    }),

    // Agency-level metrics are not meaningful for serviceType-scoped rows
    isServiceTypeScope
      ? Promise.resolve(0)
      : prisma.agency.count({
          where: {
            createdAt: { gte: start, lt: end },
            ...(scope.agencyId !== null && { id: scope.agencyId }),
            ...(scope.modeProfile !== null && { modeProfile: scope.modeProfile }),
          },
        }),

    isServiceTypeScope
      ? Promise.resolve(0)
      : prisma.event.count({
          where: {
            type: "user_logged_in",
            occurredAt: { gte: start, lt: end },
            ...agencyFilter,
          },
        }),

    isServiceTypeScope
      ? Promise.resolve(0)
      : prisma.event
          .findMany({
            where: {
              occurredAt: { gte: start, lt: end },
              userId: { not: null },
              ...agencyFilter,
            },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((r) => r.length),

    isServiceTypeScope
      ? Promise.resolve(0)
      : prisma.feedbackSubmission.count({
          where: {
            createdAt: { gte: start, lt: end },
            ...agencyFilter,
          },
        }),

    prisma.outboundMessage.aggregate({
      where: {
        createdAt: { gte: start, lt: end },
        ...msgFilter,
      },
      _sum: { aiCostCents: true },
    }),
  ]);

  return {
    transactionsCreated,
    transactionsExchanged,
    transactionsCompleted,
    milestonesConfirmed,
    chasesSent,
    aiDraftsGenerated,
    filesUploaded,
    signups,
    logins,
    uniqueActiveUsers,
    feedbackSubmitted,
    aiSpendCents: aiSpendResult._sum.aiCostCents ?? 0,
  };
}

async function upsertDailyMetricRow(
  dateStr: string,
  scope: Scope,
  metrics: MetricValues
): Promise<void> {
  const date = new Date(dateStr);

  // findFirst + update/create avoids nullable-unique-key upsert issues in Postgres
  const existing = await prisma.dailyMetric.findFirst({
    where: {
      date,
      agencyId: scope.agencyId,
      serviceType: scope.serviceType,
      modeProfile: scope.modeProfile,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.dailyMetric.update({
      where: { id: existing.id },
      data: { ...metrics, computedAt: new Date() },
    });
  } else {
    await prisma.dailyMetric.create({
      data: {
        date,
        agencyId: scope.agencyId ?? undefined,
        serviceType: scope.serviceType ?? undefined,
        modeProfile: scope.modeProfile ?? undefined,
        ...metrics,
      },
    });
  }
}

/**
 * Compute and upsert DailyMetric rows for a given date (in London local time).
 * Produces one row per scope: global, 2 serviceType splits, 3 modeProfile splits,
 * plus one per agency.
 */
export async function computeDailyMetric(
  londonDate: Date
): Promise<{ rowsWritten: number }> {
  const dateStr = londonDateStr(londonDate);

  const staticScopes: Scope[] = [
    { agencyId: null, serviceType: null, modeProfile: null },
    { agencyId: null, serviceType: "self_managed", modeProfile: null },
    { agencyId: null, serviceType: "outsourced", modeProfile: null },
    { agencyId: null, serviceType: null, modeProfile: "self_progressed" },
    { agencyId: null, serviceType: null, modeProfile: "progressor_managed" },
    { agencyId: null, serviceType: null, modeProfile: "mixed" },
  ];

  const agencies = await prisma.agency.findMany({ select: { id: true } });
  const agencyScopes: Scope[] = agencies.map(({ id }) => ({
    agencyId: id,
    serviceType: null,
    modeProfile: null,
  }));

  let rowsWritten = 0;
  for (const scope of [...staticScopes, ...agencyScopes]) {
    const metrics = await computeMetricsForScope(dateStr, scope);
    await upsertDailyMetricRow(dateStr, scope, metrics);
    rowsWritten++;
  }

  return { rowsWritten };
}

/**
 * Compute and upsert WeeklyCohort rows for the week starting on weekStart.
 * Groups agencies by modeProfile; computes activeWeek1/2/4/8/12 via Event presence.
 * Skips future measurement windows (set to 0).
 */
export async function computeWeeklyCohort(
  weekStart: Date
): Promise<{ rowsWritten: number }> {
  const monday = toMondayUtc(weekStart);
  const weekEnd = new Date(monday);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const cohortAgencies = await prisma.agency.findMany({
    where: { createdAt: { gte: monday, lt: weekEnd } },
    select: { id: true, modeProfile: true },
  });

  if (cohortAgencies.length === 0) return { rowsWritten: 0 };

  const byMode = new Map<AgencyModeProfile, string[]>();
  for (const { id, modeProfile } of cohortAgencies) {
    const existing = byMode.get(modeProfile) ?? [];
    existing.push(id);
    byMode.set(modeProfile, existing);
  }

  const now = new Date();
  let rowsWritten = 0;

  for (const [modeProfile, agencyIds] of byMode) {
    const activeByWeek: Record<number, number> = {};

    for (const n of [1, 2, 4, 8, 12] as const) {
      const checkStart = new Date(monday);
      checkStart.setUTCDate(checkStart.getUTCDate() + n * 7);

      if (checkStart >= now) {
        activeByWeek[n] = 0;
        continue;
      }

      const checkEnd = new Date(checkStart);
      checkEnd.setUTCDate(checkEnd.getUTCDate() + 7);

      const activeGroups = await prisma.event.groupBy({
        by: ["agencyId"],
        where: {
          occurredAt: { gte: checkStart, lt: checkEnd },
          agencyId: { in: agencyIds },
        },
        _count: { agencyId: true },
      });

      activeByWeek[n] = activeGroups.length;
    }

    // Use DATE-only value for signupWeek
    const signupWeek = new Date(monday.toISOString().slice(0, 10) + "T00:00:00.000Z");

    const existing = await prisma.weeklyCohort.findFirst({
      where: { signupWeek, modeProfile },
      select: { id: true },
    });

    const data = {
      cohortSize: agencyIds.length,
      activeWeek1: activeByWeek[1] ?? 0,
      activeWeek2: activeByWeek[2] ?? 0,
      activeWeek4: activeByWeek[4] ?? 0,
      activeWeek8: activeByWeek[8] ?? 0,
      activeWeek12: activeByWeek[12] ?? 0,
      computedAt: new Date(),
    };

    if (existing) {
      await prisma.weeklyCohort.update({ where: { id: existing.id }, data });
    } else {
      await prisma.weeklyCohort.create({ data: { signupWeek, modeProfile, ...data } });
    }

    rowsWritten++;
  }

  return { rowsWritten };
}
