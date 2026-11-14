// /agent/account/connect-crm — "Connect your CRM" (critique #289). Agents only
// (director + negotiator). Lets an agency register interest in connecting a CRM
// so it and Sales Progressor stay in step both ways — nothing is wired to a real
// CRM yet, so each tile records a request rather than claiming a live connection.
// The demand lands in the Command Centre (/command/crm-requests).

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { CRM_CATALOGUE } from "@/lib/crm/catalogue";
import { getCrmCounts, getAgencyRequestedKeys } from "@/lib/crm/requests";
import { ConnectCrmPanel } from "@/components/account/crm/ConnectCrmPanel";

export const dynamic = "force-dynamic";

export default async function ConnectCrmPage() {
  const { session } = await resolveAgentSession();
  if ((session.user.role !== "director" && session.user.role !== "negotiator") || !session.user.agencyId) notFound();

  const [counts, requested] = await Promise.all([
    getCrmCounts(),
    getAgencyRequestedKeys(session.user.agencyId),
  ]);

  return (
    <>
      <AccountPageHeader
        title="Connect your CRM"
        subtitle="Connect your CRM to sync sale updates automatically, with no double entry. Tell us which CRM you use to help prioritise integrations."
      />
      <ConnectCrmPanel catalogue={CRM_CATALOGUE} counts={counts} requested={requested} />
    </>
  );
}
