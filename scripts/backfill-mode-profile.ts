/**
 * Backfill Agency.modeProfile from PropertyTransaction.serviceType.
 *
 * Logic (last 90 days of transactions per agency):
 *   all outsourced                → progressor_managed
 *   all self_managed              → self_progressed
 *   mix of both                   → mixed
 *   no transactions in 90 days   → self_progressed (safe default)
 *
 * Run once after the add_agency_mode_profile migration, then the nightly
 * cron at /api/cron/backfill-mode-profile keeps profiles current.
 */

import { PrismaClient, AgencyModeProfile, ServiceType } from "@prisma/client";

const prisma = new PrismaClient();

async function computeProfile(agencyId: string): Promise<AgencyModeProfile> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const counts = await prisma.propertyTransaction.groupBy({
    by: ["serviceType"],
    where: {
      agencyId,
      createdAt: { gte: ninetyDaysAgo },
    },
    _count: { _all: true },
  });

  const hasOutsourced = counts.some(
    (c) => c.serviceType === ServiceType.outsourced && c._count._all > 0
  );
  const hasSelfManaged = counts.some(
    (c) => c.serviceType === ServiceType.self_managed && c._count._all > 0
  );

  if (hasOutsourced && hasSelfManaged) return AgencyModeProfile.mixed;
  if (hasOutsourced) return AgencyModeProfile.progressor_managed;
  return AgencyModeProfile.self_progressed;
}

export async function backfillModeProfiles(): Promise<{
  updated: number;
  unchanged: number;
}> {
  const agencies = await prisma.agency.findMany({
    select: { id: true, modeProfile: true },
  });

  let updated = 0;
  let unchanged = 0;

  for (const agency of agencies) {
    const profile = await computeProfile(agency.id);
    if (profile !== agency.modeProfile) {
      await prisma.agency.update({
        where: { id: agency.id },
        data: { modeProfile: profile, modeProfileComputedAt: new Date() },
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  return { updated, unchanged };
}

// Run directly
if (require.main === module) {
  backfillModeProfiles()
    .then(({ updated, unchanged }) => {
      console.log(`Mode profile backfill complete: ${updated} updated, ${unchanged} unchanged`);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
