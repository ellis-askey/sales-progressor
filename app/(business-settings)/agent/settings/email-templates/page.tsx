// app/(business-settings)/agent/settings/email-templates/page.tsx
//
// Business settings → Email templates. The external-progression-business
// counterpart to the agency page: the owner manages company-wide + personal
// templates, progressors manage their own personal ones. All writes are gated
// server-side in app/actions/email-templates.ts.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { EmailTemplatesManager } from "@/components/account/templates/EmailTemplatesManager";

export const dynamic = "force-dynamic";

export default async function BusinessEmailTemplatesPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  return (
    <>
      <AccountPageHeader
        title="Email templates"
        subtitle="Create, edit and reuse email templates to save time and keep your communication consistent."
        backLabel="Back to progression"
      />
      <AccountCard>
        <EmailTemplatesManager canManageCompany={member.isOwner} />
      </AccountCard>
    </>
  );
}
