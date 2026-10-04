// /agent/settings/security — the owner's sign-in security. Per-user cards (no
// agency coupling), reused verbatim from the agency Security tab. Owner-gated.

import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { ChangePasswordCard } from "@/components/account/v2/ChangePasswordCard";
import { TwoFactorCard } from "@/components/account/v2/TwoFactorCard";
import { SessionsCard } from "@/components/account/v2/SessionsCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export default async function BusinessSecurityPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  return (
    <>
      <AccountPageHeader
        title="Security"
        subtitle="Manage how you sign in to Sales Progressor."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ChangePasswordCard />
        <TwoFactorCard />
        <SessionsCard />
      </div>
    </>
  );
}
