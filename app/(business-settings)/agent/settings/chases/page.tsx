// /agent/settings/chases — the business owner's "Automation" tab: change which chases
// run across the whole book (set once in the welcome pop-up, editable here — critique
// #22) plus the auto-send-chain-invites toggle (#23). Owner-gated.
//
// Uses the /chases URL (not /automation) because /agent/settings/automation already
// belongs to the agency director automation page; the nav labels this "Automation".

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getProgressorAutomation } from "@/lib/services/progressor-chase-prefs";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { BusinessAutomationForm } from "@/components/progression/BusinessAutomationForm";

export default async function BusinessChasesPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const automation = await getProgressorAutomation(owner.businessId);

  return (
    <>
      <AccountPageHeader
        title="Automation"
        subtitle="Which chases we run for you, and how chain invites are sent."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <BusinessAutomationForm initial={automation} />
      </div>
    </>
  );
}
