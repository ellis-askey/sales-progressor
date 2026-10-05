// /agent/settings → the business settings landing. Owners land on the business
// identity tab (the distinctive landing); a team member can't see that tab, so they
// land on their own Profile instead of a 404 (audit SP-polish).
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveBusinessMember } from "@/lib/services/progression-clients";

export default async function BusinessSettingsIndex() {
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  redirect(member?.isOwner ? "/agent/settings/business" : "/agent/settings/profile");
}
