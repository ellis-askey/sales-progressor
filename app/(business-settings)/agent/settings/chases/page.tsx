// /agent/settings/chases — the business owner's "Automation" tab: change which chases
// run across the whole book (set once in the welcome pop-up, editable here — critique
// #22) plus the auto-send-chain-invites toggle (#23). Owner-gated.
//
// Uses the /chases URL (not /automation) because /agent/settings/automation already
// belongs to the agency director automation page; the nav labels this "Automation".

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getProgressorAutomation } from "@/lib/services/progressor-chase-prefs";
import { getEditableChaseRules } from "@/lib/services/chase-cadence";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { BusinessAutomationForm } from "@/components/progression/BusinessAutomationForm";
import { AutomationSettingsForm } from "@/components/automation/AutomationSettingsForm";

export default async function BusinessChasesPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  // Toggles (which chases run) + the per-milestone grace/repeat cadence, which
  // used to live on the hidden /agent/settings/automation page and now sits
  // underneath the toggles here. Owner-scoped to this business's outsourced files.
  const [automation, overrides] = await Promise.all([
    getProgressorAutomation(owner.businessId),
    prisma.businessChaseRuleOverride.findMany({
      where: { progressionBusinessId: owner.businessId },
      select: { milestoneCode: true, graceDays: true, repeatEveryDays: true },
    }),
  ]);
  const editableRules = await getEditableChaseRules(overrides);

  return (
    <>
      <AccountPageHeader
        title="Automation"
        subtitle="Which chases we run for you, how often, and how chain invites are sent."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <BusinessAutomationForm initial={automation} />
        {/* The client-chase on/off master lives in the toggles above, so the
            cadence editor hides its own master toggle (showMasterToggle={false}). */}
        <AutomationSettingsForm
          initialChaseEmailsEnabled={automation.client}
          initialRules={editableRules}
          scope="business"
          showMasterToggle={false}
        />
      </div>
    </>
  );
}
