// app/(account)/agent/account/email-templates/page.tsx
//
// Account → Email templates. User-authored reusable email templates for the
// composer. Directors manage both company-wide and personal templates;
// negotiators manage their own personal ones. The company/personal gate and
// every write are enforced server-side in app/actions/email-templates.ts.

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { EmailTemplatesManager } from "@/components/account/templates/EmailTemplatesManager";

export const dynamic = "force-dynamic";

export default async function AccountEmailTemplatesPage() {
  const { session } = await resolveAgentSession();
  const role = session.user.role;
  if (!session.user.agencyId || (role !== "director" && role !== "negotiator")) notFound();
  const canManageCompany = role === "director";

  return (
    <>
      <AccountPageHeader
        title="Email templates"
        subtitle="Create, edit and reuse email templates to save time and keep your communication consistent."
      />
      <AccountCard>
        <EmailTemplatesManager canManageCompany={canManageCompany} />
      </AccountCard>
    </>
  );
}
