// /agent/settings/chases — the business owner's "Automation" tab: change which chases
// run across the whole book (set once in the welcome pop-up, editable here — critique
// #22) plus the auto-send-chain-invites toggle (#23). Owner-gated.
//
// Uses the /chases URL (not /automation) because /agent/settings/automation already
// belonged to the (now retired) agency director automation page; the nav labels
// this "Automated chasing".

import Link from "next/link";
import { notFound } from "next/navigation";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getProgressorAutomation } from "@/lib/services/progressor-chase-prefs";
import { getEditableChaseRules } from "@/lib/services/chase-cadence";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { SettingsNote } from "@/components/ui/SettingsNote";
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
  const [automation, business, overrides] = await Promise.all([
    getProgressorAutomation(owner.businessId),
    prisma.progressionBusiness.findUnique({ where: { id: owner.businessId }, select: { clientChaseEscalateAfter: true } }),
    prisma.businessChaseRuleOverride.findMany({
      where: { progressionBusinessId: owner.businessId },
      select: { milestoneCode: true, graceDays: true, repeatEveryDays: true, escalateAfterChases: true, enabled: true },
    }),
  ]);
  const globalEscalateAfter = business?.clientChaseEscalateAfter ?? 2;
  const editableRules = await getEditableChaseRules(overrides, globalEscalateAfter);

  return (
    <>
      <AccountPageHeader
        title="Automated chasing"
        subtitle="Which chases we run for you, how often, and how chain invites are sent."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <BusinessAutomationForm initial={automation} />

        {/* Cross-link: this page is the chasing cadence; the wording + look of
            these emails live on the Emails page. */}
        <SettingsNote
          tone="info"
          icon={<EnvelopeSimple size={18} weight="fill" />}
          title="Want to change how these emails look or sound?"
          body="Head to the Emails page to customise their wording and appearance. Here, you choose what gets chased and how often."
          action={<Link href="/agent/settings/emails" style={{ color: "inherit", textDecoration: "none" }}>Go to Emails →</Link>}
        />

        {/* The client-chase on/off master lives in the toggles above, so the
            cadence editor hides its own master toggle (showMasterToggle={false}). */}
        <AutomationSettingsForm
          initialChaseEmailsEnabled={automation.client}
          initialRules={editableRules}
          initialEscalateAfter={globalEscalateAfter}
          scope="business"
          showMasterToggle={false}
        />
      </div>
    </>
  );
}
