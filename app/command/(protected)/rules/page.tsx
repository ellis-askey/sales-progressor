import { commandDb } from "@/lib/command/prisma";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
import { RulesTabs, type MilestoneDefRow, type ReminderRuleRow } from "@/components/command/rules/RulesTabs";

// Command Centre → Rules. Read-only reference for how the milestone + reminder
// engine is configured. Moved out of Settings into its own tabbed page.

export default async function RulesPage() {
  const [milestoneDefs, reminderRules] = await Promise.all([
    commandDb.milestoneDefinition.findMany({
      where: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } },
      orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    }),
    commandDb.reminderRule.findMany({
      where: { isActive: true },
      include: { anchorMilestone: { select: { name: true, code: true, side: true, orderIndex: true } } },
    }),
  ]);

  const defRows: MilestoneDefRow[] = milestoneDefs.map((d) => ({
    id: d.id,
    name: d.name,
    orderIndex: d.orderIndex,
    blocksExchange: d.blocksExchange,
    code: d.code,
    canBeMarkedNr: d.canBeMarkedNr,
    side: d.side as "vendor" | "purchaser",
  }));

  // Sort reminder rules to mirror milestone progression order — same logic the
  // Settings page used, so the display matches what the founder already knows.
  const sortedRules = [...reminderRules].sort((a, b) => {
    const aNull = !a.anchorMilestone;
    const bNull = !b.anchorMilestone;
    if (aNull && bNull) return a.name.localeCompare(b.name);
    if (aNull) return -1;
    if (bNull) return 1;
    const sideOrder: Record<string, number> = { vendor: 0, purchaser: 1 };
    const aSide = sideOrder[a.anchorMilestone!.side] ?? 0;
    const bSide = sideOrder[b.anchorMilestone!.side] ?? 0;
    if (aSide !== bSide) return aSide - bSide;
    return a.anchorMilestone!.orderIndex - b.anchorMilestone!.orderIndex;
  });

  const ruleRows: ReminderRuleRow[] = sortedRules.map((r) => ({
    id: r.id,
    name: r.name,
    anchor: r.anchorMilestone
      ? { code: r.anchorMilestone.code, name: r.anchorMilestone.name, side: r.anchorMilestone.side }
      : null,
    targetMilestoneCode: r.targetMilestoneCode,
    graceDays: r.graceDays,
    repeatEveryDays: r.repeatEveryDays,
    escalateAfterChases: r.escalateAfterChases,
    group: !r.anchorMilestone ? "file" : r.anchorMilestone.side === "vendor" ? "vendor" : "purchaser",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Rules</h1>
        <p className="text-sm text-neutral-400 mt-1">How the milestone and reminder engine is set up. Read-only.</p>
      </div>
      <RulesTabs milestoneDefs={defRows} reminderRules={ruleRows} />
    </div>
  );
}
