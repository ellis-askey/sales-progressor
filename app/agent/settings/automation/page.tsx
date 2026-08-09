// Director-only settings page for automation controls.
//
// Negotiators get notFound() (matches the agent app's role-gate pattern).
// Editable surface:
//   - Master toggle: Agency.chaseEmailsEnabled
//   - Per-milestone graceDays + repeatEveryDays (ReminderRule rows)
//
// NOT editable (hardcoded guardrails — see the plan):
//   - 2-chase cap (CLIENT_CHASE_COUNT_CAP)
//   - 14-day silence ceiling (CLIENT_CHASE_SILENCE_DAYS)
//   - escalateAfterChases (agent-engine-only; surfacing would confuse)
//
// Settings edits are forward-only: existing transactions keep their
// chaseRuleSnapshot. See lib/services/transactions.ts: buildChaseRuleSnapshot.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";
import { AutomationSettingsForm } from "@/components/automation/AutomationSettingsForm";
import { SolicitorAutomationForm } from "@/components/automation/SolicitorAutomationForm";

export default async function AutomationSettingsPage() {
  const session = await requireSession();
  if (session.user.role !== "director") notFound();
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  const [agency, rules, defs, solicitorSettings] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: agencyId },
      select: { chaseEmailsEnabled: true },
    }),
    prisma.reminderRule.findMany({
      where: { isActive: true, targetMilestoneCode: { not: null } },
      select: {
        targetMilestoneCode: true,
        graceDays: true,
        repeatEveryDays: true,
      },
    }),
    prisma.milestoneDefinition.findMany({
      select: { code: true, name: true, side: true, orderIndex: true },
    }),
    prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!agency) notFound();

  const defByCode = new Map(defs.map((d) => [d.code, d]));

  // Filter to chaseable codes only — exchange/completion/gate codes can't
  // receive client chases so editing their grace/repeat is meaningless.
  const editableRules = rules
    .filter((r) => r.targetMilestoneCode && isClientChaseable(r.targetMilestoneCode))
    .map((r) => {
      const def = defByCode.get(r.targetMilestoneCode!);
      return {
        milestoneCode: r.targetMilestoneCode!,
        milestoneName: def?.name ?? r.targetMilestoneCode!,
        side: (def?.side ?? "vendor") as "vendor" | "purchaser",
        orderIndex: def?.orderIndex ?? 9999,
        graceDays: r.graceDays,
        repeatEveryDays: r.repeatEveryDays,
      };
    })
    // Vendor first, then purchaser; within each side, follow the milestone
    // engine's canonical orderIndex (matches what users see on the file).
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "vendor" ? -1 : 1;
      return a.orderIndex - b.orderIndex;
    });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Automation settings"
        subtitle="Control automated chase emails sent to clients on your agency's files."
      />
      <AutomationSettingsForm
        initialChaseEmailsEnabled={agency.chaseEmailsEnabled}
        initialRules={editableRules}
      />
      <SolicitorAutomationForm
        initial={{
          enabled: solicitorSettings?.enabledByDefault ?? false,
          graceWorkingDays: solicitorSettings?.graceWorkingDays ?? 5,
          repeatDays: solicitorSettings?.repeatDays ?? 7,
          maxChases: solicitorSettings?.maxChases ?? 2,
        }}
      />
    </div>
  );
}
