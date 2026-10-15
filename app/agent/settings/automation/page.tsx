// Retired (settings consolidation, Phase 1). This menu-less page was the agency's
// only chasing-settings surface; its content now lives in the proper tabs:
//   - agency director  → /agent/account/chasing (Account > Automated chasing)
//   - progression owner → /agent/settings/chases (Settings > Automated chasing)
// Kept as a redirect so any bookmarked URL lands in the right place. The global
// solicitor-cadence tables that used to render here were a platform singleton
// mis-exposed to agency directors; they belong in the Command Centre (follow-up).

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

export default async function AutomationSettingsPage() {
  const session = await requireSession();
  const isBusinessOwner =
    !!session.user.progressionBusinessId && session.user.progressionBusinessRole === "owner";
  redirect(isBusinessOwner ? "/agent/settings/chases" : "/agent/account/chasing");
}
