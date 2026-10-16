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

import Link from "next/link";
import { notFound } from "next/navigation";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEditableChaseRules } from "@/lib/services/chase-cadence";
import { getAgentChasePrefs } from "@/lib/services/agent-chase-prefs";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { SettingsNote } from "@/components/ui/SettingsNote";
import { AgencyChaseGrid } from "@/components/automation/AgencyChaseGrid";
import { AutomationSettingsForm } from "@/components/automation/AutomationSettingsForm";

export default async function AgencyChasingPage() {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  if (session.user.role !== "director" || !agencyId) notFound();

  const [prefs, agency, overrides] = await Promise.all([
    getAgentChasePrefs(agencyId),
    prisma.agency.findUnique({ where: { id: agencyId }, select: { chaseEmailsEnabled: true, clientChaseEscalateAfter: true } }),
    prisma.agencyChaseRuleOverride.findMany({
      where: { agencyId },
      select: { milestoneCode: true, graceDays: true, repeatEveryDays: true, escalateAfterChases: true, enabled: true },
    }),
  ]);
  if (!agency) notFound();

  const editableRules = await getEditableChaseRules(overrides, agency.clientChaseEscalateAfter);

  return (
    <>
      <AccountPageHeader
        title="Automated chasing"
        subtitle="Choose which chases run on sales you progress yourself and how often. You can also adjust these for individual sales. Sales managed by a progression company follow their settings instead."
      />
      <AgencyChaseGrid initial={prefs} />

      {/* Cross-link: this page is the chasing cadence; the wording + look of
          these emails live on the Emails page. */}
      <div style={{ margin: "4px 0 20px" }}>
        <SettingsNote
          tone="info"
          icon={<EnvelopeSimple size={18} weight="fill" />}
          title="Want to change how these emails look or sound?"
          body="Head to the Emails page to customise their wording and appearance. Here, you choose what gets chased and how often."
          action={<Link href="/agent/account/emails" style={{ color: "inherit", textDecoration: "none" }}>Go to Emails →</Link>}
        />
      </div>

      <AutomationSettingsForm
        initialChaseEmailsEnabled={agency.chaseEmailsEnabled}
        initialRules={editableRules}
        initialEscalateAfter={agency.clientChaseEscalateAfter}
        scope="agency"
        showMasterToggle={false}
      />
    </>
  );
}
