// Shared loader for the per-milestone grace/repeat cadence editor
// (AutomationSettingsForm). Overlays a scope's own overrides on the platform
// default (ReminderRule), filters to client-chaseable milestones, and sorts
// vendor-then-purchaser by the milestone engine's canonical order.
//
// Used by the agency director automation page and the business-owner Automation
// tab (/agent/settings/chases). Pass the scope's override rows; the platform
// defaults + milestone names are read here.

import { prisma } from "@/lib/prisma";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";

export type EditableChaseRule = {
  milestoneCode: string;
  milestoneName: string;
  side: "vendor" | "purchaser";
  orderIndex: number;
  graceDays: number;
  repeatEveryDays: number;
  // The platform default (before this scope's override) — the baseline the timing
  // presets scale from, and what "Reset to defaults" restores.
  defaultGraceDays: number;
  defaultRepeatEveryDays: number;
};

export async function getEditableChaseRules(
  overrides: { milestoneCode: string; graceDays: number; repeatEveryDays: number }[],
): Promise<EditableChaseRule[]> {
  const [rules, defs] = await Promise.all([
    prisma.reminderRule.findMany({
      where: { isActive: true, targetMilestoneCode: { not: null } },
      select: { targetMilestoneCode: true, graceDays: true, repeatEveryDays: true },
    }),
    prisma.milestoneDefinition.findMany({
      select: { code: true, name: true, side: true, orderIndex: true },
    }),
  ]);

  const defByCode = new Map(defs.map((d) => [d.code, d]));
  const overrideByCode = new Map(overrides.map((o) => [o.milestoneCode, o]));

  return rules
    .filter((r) => r.targetMilestoneCode && isClientChaseable(r.targetMilestoneCode))
    .map((r) => {
      const def = defByCode.get(r.targetMilestoneCode!);
      const ov = overrideByCode.get(r.targetMilestoneCode!);
      return {
        milestoneCode: r.targetMilestoneCode!,
        milestoneName: def?.name ?? r.targetMilestoneCode!,
        side: (def?.side ?? "vendor") as "vendor" | "purchaser",
        orderIndex: def?.orderIndex ?? 9999,
        graceDays: ov?.graceDays ?? r.graceDays,
        repeatEveryDays: ov?.repeatEveryDays ?? r.repeatEveryDays,
        defaultGraceDays: r.graceDays,
        defaultRepeatEveryDays: r.repeatEveryDays,
      };
    })
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "vendor" ? -1 : 1;
      return a.orderIndex - b.orderIndex;
    });
}
