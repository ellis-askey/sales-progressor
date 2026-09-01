import { prisma } from "@/lib/prisma";

export type WeeklyReport = {
  generatedAt: Date;
  periodStart: Date;
  milestonesCompleted: {
    transactionId: string;
    propertyAddress: string;
    milestoneName: string;
    completedAt: Date | null;
    completedByName: string | null;
  }[];
  filesExchanged: {
    id: string;
    propertyAddress: string;
    completionDate: Date | null;
  }[];
  filesAdded: {
    id: string;
    propertyAddress: string;
    createdAt: Date;
  }[];
  overdueTaskCount: number;
  totalActiveFiles: number;
  totalPipelineValue: number;
};

export async function getWeeklyReport(agencyId: string): Promise<WeeklyReport> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 7);

  const [exchangeDefs, milestones, filesAdded, overdueTaskCount, activeFiles] = await Promise.all([
    prisma.milestoneDefinition.findMany({
      where: { code: { in: ["VM19", "PM26"] } },
      select: { id: true },
    }),
    // PHASE 1 4d (a)-CLASS — agent weekly report. Cross-tx MC findMany;
    // weekly digest of "milestones confirmed this week" sent to agents.
    // Display only; does not drive comms or chase or billing. The
    // exchangedAt-canonical precondition prevents the relisted-file
    // case from producing surprising entries. Phase 2 ticket: when
    // relisted files exist, may want to filter to active-round only
    // so the weekly report doesn't surface an archived buyer's late
    // PM completion as "this week's progress" on a relisted file.
    prisma.milestoneCompletion.findMany({
      where: {
        // Weekly report excludes migrated files so "milestones completed
        // this week" reflects work actually progressed in-system.
        transaction: { agencyId, isMigrated: false, isDemo: false },
        state: "complete",
        completedAt: { gte: periodStart },
      },
      include: {
        transaction: { select: { id: true, propertyAddress: true } },
        milestoneDefinition: { select: { name: true } },
        completedBy: { select: { name: true } },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.propertyTransaction.findMany({
      where: { agencyId, status: { not: "draft" }, isMigrated: false, isDemo: false, createdAt: { gte: periodStart } },
      select: { id: true, propertyAddress: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.chaseTask.count({
      where: {
        // isDemo:false — demo files carry seeded chase tasks that must not
        // inflate the weekly "overdue chases" figure.
        transaction: { agencyId, isDemo: false },
        status: "pending",
        dueDate: { lt: now },
      },
    }),
    prisma.propertyTransaction.findMany({
      where: { agencyId, status: "active", isDemo: false },
      select: { purchasePrice: true },
    }),
  ]);

  const exchangeDefIds = new Set(exchangeDefs.map((d) => d.id));
  const exchangeMilestones = milestones.filter((m) => exchangeDefIds.has(m.milestoneDefinitionId));
  const exchangedIds = [...new Set(exchangeMilestones.map((m) => m.transactionId))];

  const filesExchanged = exchangedIds.length > 0
    ? await prisma.propertyTransaction.findMany({
        where: { agencyId, id: { in: exchangedIds } },
        select: { id: true, propertyAddress: true, completionDate: true },
      })
    : [];

  return {
    generatedAt: now,
    periodStart,
    milestonesCompleted: milestones
      .filter((m) => !exchangeDefIds.has(m.milestoneDefinitionId))
      .map((m) => ({
        transactionId: m.transaction.id,
        propertyAddress: m.transaction.propertyAddress,
        milestoneName: m.milestoneDefinition.name,
        completedAt: m.completedAt,
        completedByName: m.completedBy?.name ?? null,
      })),
    filesExchanged,
    filesAdded: filesAdded.map((f) => ({ id: f.id, propertyAddress: f.propertyAddress, createdAt: f.createdAt })),
    overdueTaskCount,
    totalActiveFiles: activeFiles.length,
    totalPipelineValue: activeFiles.reduce((sum, f) => sum + (f.purchasePrice ?? 0), 0),
  };
}
