// Progression-business "Your team" surface. Owner-only: the owner sets, per team
// member, whether they see the whole business book (see-all) or only their own
// assigned files (see-own). Flag- and owner-gated. The access rule itself lives in
// lib/security/access-scope.ts + resolveInternalVisibility.
//
// Lives under the (business-settings) route group so it renders inside the settings
// shell (AccountShell variant="business") with the settings nav — the mobile menu
// then shows the settings tabs, not the main app nav (critique #175). The URL stays
// /agent/team (route groups don't affect the path). BusinessTeamView renders its own
// AccountPageHeader (with the "Back to progression" link) so the Back affordance
// matches every other settings tab (critique #183).

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner, listBusinessTeam } from "@/lib/services/progression-clients";
import { BusinessTeamView } from "@/components/progression/BusinessTeamView";

export default async function AgentTeamPage() {
  if (!progressionBusinessesEnabled()) notFound();

  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const team = await listBusinessTeam(owner.businessId, session.user.id);

  return <BusinessTeamView team={team} />;
}
