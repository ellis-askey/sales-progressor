import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logPortalMilestoneConfirm } from "@/lib/services/portal";

const DIRECT_PREREQUISITES: Record<string, string[]> = {
  VM2: ["VM1"], VM3: ["VM1"], VM14: ["VM1"], VM15: ["VM1"],
  VM4: ["VM15"], VM5: ["VM4"], VM6: ["VM5"], VM7: ["VM6"],
  VM16: ["VM5"], VM17: ["VM16"], VM8: ["VM17"],
  VM18: ["VM8"], VM19: ["VM18"], VM9: ["VM19"],
  VM10: ["VM5"], VM11: ["VM10"], VM20: ["VM11"],
  VM13: ["VM12"],
  PM2: ["PM1"], PM14a: ["PM1"], PM15a: ["PM14a"],
  PM4: ["PM1"], PM5: ["PM4"], PM6: ["PM5"],
  PM7: ["PM1"],
  PM9: ["PM3"], PM20: ["PM7"], PM8: ["PM3"],
  PM10: ["PM9"], PM11: ["PM10"], PM21: ["PM11"],
  PM22: ["PM21"], PM12: ["PM22"], PM23: ["PM12"],
  PM24: ["PM23"], PM25: ["PM24"], PM26: ["PM25"],
  PM13: ["PM26"], PM14b: ["PM13"], PM15b: ["PM14b"],
  PM27: ["PM15b"], PM17: ["PM16"],
};

export async function POST(req: NextRequest) {
  const { token, milestoneDefinitionId, eventDate } = await req.json();
  if (!token || !milestoneDefinitionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, name: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact) return NextResponse.json({ error: "Invalid token" }, { status: 403 });

  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";

  const def = await prisma.milestoneDefinition.findFirst({
    where: { id: milestoneDefinitionId, side },
  });
  if (!def) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  // Require date for time-sensitive milestones
  if (def.timeSensitive && !eventDate) {
    return NextResponse.json({ error: "Date required for this milestone" }, { status: 400 });
  }

  // Check direct prerequisites are complete
  const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
  if (prereqCodes.length > 0) {
    const prereqDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: prereqCodes }, side },
      select: { id: true, code: true },
    });
    for (const prereq of prereqDefs) {
      const done = await prisma.milestoneCompletion.findFirst({
        where: {
          transactionId: contact.propertyTransactionId,
          milestoneDefinitionId: prereq.id,
          isActive: true,
          isNotRequired: false,
        },
      });
      if (!done) {
        return NextResponse.json(
          { error: `Complete "${prereq.code}" first` },
          { status: 400 }
        );
      }
    }
  }

  // Deactivate existing completion
  await prisma.milestoneCompletion.updateMany({
    where: {
      transactionId: contact.propertyTransactionId,
      milestoneDefinitionId,
      isActive: true,
    },
    data: { isActive: false },
  });

  // Create new completion
  const completion = await prisma.milestoneCompletion.create({
    data: {
      transactionId: contact.propertyTransactionId,
      milestoneDefinitionId,
      isActive: true,
      isNotRequired: false,
      completedAt: new Date(),
      eventDate: eventDate ? new Date(eventDate) : null,
      statusReason: "Confirmed by client via portal",
    },
  });

  // Notify the assigned progressor (fire-and-forget)
  logPortalMilestoneConfirm(
    contact.propertyTransactionId,
    contact.id,
    contact.name,
    def.name
  ).catch(() => {});

  return NextResponse.json(completion, { status: 201 });
}
