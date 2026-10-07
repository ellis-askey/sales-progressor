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
import { SolicitorPerCodeTable } from "@/components/automation/SolicitorPerCodeTable";
import { WeeklyUpdateToggle } from "@/components/automation/WeeklyUpdateToggle";
import { ChainNeighbourUpdatesToggle } from "@/components/automation/ChainNeighbourUpdatesToggle";

export default async function AutomationSettingsPage() {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  // Who's allowed in: an agency director (their self-managed files), OR a
  // progression-business OWNER (their own outsourced files, #228). Anyone else
  // (negotiators, non-owner business members) gets the standard notFound gate.
  const isAgencyDirector = session.user.role === "director" && !!agencyId;
  const isBusinessOwner = !!session.user.progressionBusinessId && session.user.progressionBusinessRole === "owner";
  if (!isAgencyDirector && !isBusinessOwner) notFound();

  // Shared: the platform rules + milestone names.
  const [rules, defs] = await Promise.all([
    prisma.reminderRule.findMany({
      where: { isActive: true, targetMilestoneCode: { not: null } },
      select: { targetMilestoneCode: true, graceDays: true, repeatEveryDays: true },
    }),
    prisma.milestoneDefinition.findMany({
      select: { code: true, name: true, side: true, orderIndex: true },
    }),
  ]);

  // Resolve the owner's own master toggle + overrides (agency vs business).
  const scope: "agency" | "business" = isAgencyDirector ? "agency" : "business";
  let masterEnabled = false;
  let overrides: { milestoneCode: string; graceDays: number; repeatEveryDays: number }[] = [];
  // Agency-only extras (weekly update, chain updates, solicitor chases).
  let agencyExtras: { weekly: boolean; chain: boolean } | null = null;
  let solicitorSettings: Awaited<ReturnType<typeof prisma.solicitorChaseSettings.findUnique>> = null;
  let solicitorRules: Awaited<ReturnType<typeof prisma.solicitorReminderRule.findMany>> = [];

  if (isAgencyDirector) {
    const [agency, agencyOverrides, solSettings, solRules] = await Promise.all([
      prisma.agency.findUnique({
        where: { id: agencyId! },
        select: { chaseEmailsEnabled: true, weeklyClientUpdatesEnabled: true, chainNeighbourUpdatesEnabled: true },
      }),
      prisma.agencyChaseRuleOverride.findMany({
        where: { agencyId: agencyId! },
        select: { milestoneCode: true, graceDays: true, repeatEveryDays: true },
      }),
      prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } }),
      prisma.solicitorReminderRule.findMany({ orderBy: { milestoneCode: "asc" } }),
    ]);
    if (!agency) notFound();
    masterEnabled = agency.chaseEmailsEnabled;
    overrides = agencyOverrides;
    agencyExtras = { weekly: agency.weeklyClientUpdatesEnabled, chain: agency.chainNeighbourUpdatesEnabled };
    solicitorSettings = solSettings;
    solicitorRules = solRules;
  } else {
    const businessId = session.user.progressionBusinessId!;
    const [biz, bizOverrides] = await Promise.all([
      prisma.progressionBusiness.findUnique({ where: { id: businessId }, select: { chaseClientsEnabled: true } }),
      prisma.businessChaseRuleOverride.findMany({
        where: { progressionBusinessId: businessId },
        select: { milestoneCode: true, graceDays: true, repeatEveryDays: true },
      }),
    ]);
    if (!biz) notFound();
    masterEnabled = biz.chaseClientsEnabled;
    overrides = bizOverrides;
  }

  const defByCode = new Map(defs.map((d) => [d.code, d]));
  // Overlay this agency's overrides on the platform default so the form shows
  // their effective timings (a milestone with no override shows the default).
  const overrideByCode = new Map(overrides.map((o) => [o.milestoneCode, o]));

  // Filter to chaseable codes only — exchange/completion/gate codes can't
  // receive client chases so editing their grace/repeat is meaningless.
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
        // The platform default (before this agency's override) — the baseline the
        // timing-profile presets scale from, and what "Reset to defaults" restores.
        defaultGraceDays: r.graceDays,
        defaultRepeatEveryDays: r.repeatEveryDays,
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
        subtitle={scope === "business"
          ? "Control automated chase emails sent to clients on your outsourced files."
          : "Control automated chase emails sent to clients on your agency's files."}
      />
      <AutomationSettingsForm
        initialChaseEmailsEnabled={masterEnabled}
        initialRules={editableRules}
        scope={scope}
      />
      {isAgencyDirector && agencyExtras && (
        <>
          <WeeklyUpdateToggle initialEnabled={agencyExtras.weekly} />
          <ChainNeighbourUpdatesToggle initialEnabled={agencyExtras.chain} />
          <SolicitorAutomationForm
            initial={{
              enabled: solicitorSettings?.enabledByDefault ?? false,
              graceWorkingDays: solicitorSettings?.graceWorkingDays ?? 5,
              repeatDays: solicitorSettings?.repeatDays ?? 7,
              maxChases: solicitorSettings?.maxChases ?? 2,
            }}
          />
          <SolicitorPerCodeTable
            initial={solicitorRules.map((r) => ({
              milestoneCode: r.milestoneCode,
              graceWorkingDays: r.graceWorkingDays,
              repeatWorkingDays: r.repeatWorkingDays,
              maxChases: r.maxChases,
              active: r.active,
              anchorMilestoneCode: r.anchorMilestoneCode,
              useAnchorEventDate: r.useAnchorEventDate,
            }))}
          />
        </>
      )}
    </div>
  );
}
