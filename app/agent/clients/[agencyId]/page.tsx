// app/agent/clients/[agencyId]/page.tsx
//
// A single client agency's workspace, for a progression-business OWNER. Flag-
// and owner-gated, and owner-scoped to this specific client (getClientAgencyDetail
// returns null unless a ProgressionBusinessClient link exists). The link grants
// NO access to the agency's other files — only files tagged to this business show.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner, getClientAgencyDetail } from "@/lib/services/progression-clients";
import { AgencyWorkspace } from "@/components/progression/AgencyWorkspace";

export default async function ClientAgencyPage({ params }: { params: Promise<{ agencyId: string }> }) {
  if (!progressionBusinessesEnabled()) notFound();

  const { agencyId } = await params;
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const detail = await getClientAgencyDetail(owner.businessId, agencyId);
  if (!detail) notFound();

  return (
    <div className="px-5 md:px-10 pt-6 md:pt-10 pb-12" style={{ width: "100%" }}>
      <AgencyWorkspace detail={detail} />
    </div>
  );
}
