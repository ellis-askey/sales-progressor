// Agency "Automated chasing" tab (settings consolidation, Phase 1). The single
// home for a self-managed agency's chasing: the 5-toggle grid (what we chase) +
// the timing / per-milestone editor (how often). Director-only. Replaces the
// menu-less /agent/settings/automation page and the enquiry toggle that used to
// sit on the Emails tab.
//
// The grid owns every on/off (incl. the client-chase master), so the timing form
// hides its own master toggle to avoid two controls over the same flag. Solicitor
// cadence stays in the Command Centre (it's a platform default), so only the
// solicitor on/off shows here, inside the grid.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";
import { getAgentChasePrefs } from "@/lib/services/agent-chase-prefs";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AgencyChaseGrid } from "@/components/automation/AgencyChaseGrid";
import { AutomationSettingsForm } from "@/components/automation/AutomationSettingsForm";

export default async function AgencyChasingPage() {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  if (session.user.role !== "director" || !agencyId) notFound();

  const [prefs, agency, rules, defs, overrides] = await Promise.all([
    getAgentChasePrefs(agencyId),
    prisma.agency.findUnique({ where: { id: agencyId }, select: { chaseEmailsEnabled: true } }),
    prisma.reminderRule.findMany({
      where: { isActive: true, targetMilestoneCode: { not: null } },
      select: { targetMilestoneCode: true, graceDays: true, repeatEveryDays: true },
    }),
    prisma.milestoneDefinition.findMany({ select: { code: true, name: true, side: true, orderIndex: true } }),
    prisma.agencyChaseRuleOverride.findMany({
      where: { agencyId },
      select: { milestoneCode: true, graceDays: true, repeatEveryDays: true },
    }),
  ]);
  if (!agency) notFound();

  const defByCode = new Map(defs.map((d) => [d.code, d]));
  const overrideByCode = new Map(overrides.map((o) => [o.milestoneCode, o]));

  const editableRules = rules
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

  return (
    <>
      <AccountPageHeader
        title="Automated chasing"
        subtitle="Which chases we run on the sales your team progresses, and how often. You can still fine-tune them on an individual file. Sales you outsource to a progression company are chased by that company instead."
      />
      <AgencyChaseGrid initial={prefs} />
      <AutomationSettingsForm
        initialChaseEmailsEnabled={agency.chaseEmailsEnabled}
        initialRules={editableRules}
        scope="agency"
        showMasterToggle={false}
      />
    </>
  );
}
