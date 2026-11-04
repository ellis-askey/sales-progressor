// Settings → Welcome call. Director-only. Edits the agency's team default script
// (the numbered talking points on every file's intro-call drawer). Each member
// can tailor their own copy on top, from the drawer itself.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAgencyWelcomeCallScriptAction } from "@/app/actions/welcome-call-script";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AgencyWelcomeCallEditor } from "@/components/welcome-call/AgencyWelcomeCallEditor";
import { Phone } from "@/components/icons/ph-ssr";

export default async function WelcomeCallSettingsPage() {
  const session = await requireSession();
  if (session.user.role !== "director") notFound();

  const { points } = await getAgencyWelcomeCallScriptAction();

  return (
    <>
      <AccountPageHeader
        title="Welcome call"
        subtitle="The script your team reads to clients on the intro call. Set the team default here; each member can tailor their own copy on top."
      />
      <AccountCard
        icon={<Phone size={18} weight="bold" />}
        title="Team script"
        subtitle="These talking points show on every file's intro-call drawer. Edit, add, reorder, or reset to our default."
      >
        <AgencyWelcomeCallEditor initialPoints={points} />
      </AccountCard>
    </>
  );
}
