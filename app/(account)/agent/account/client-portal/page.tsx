// app/(account)/agent/account/client-portal/page.tsx
//
// Account → Client portal. A director chooses what buyers and sellers see on
// their portal, agency-wide. All default on. Key-dates can also be overridden
// per sale in that file's Client settings drawer. Director-only.

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { ClientPortalSettings } from "@/components/account/client-portal/ClientPortalSettings";
import { Browser } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function AccountClientPortalPage() {
  const { session } = await resolveAgentSession();
  if (session.user.role !== "director" || !session.user.agencyId) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId },
    select: {
      showPortalKeyDates: true,
      showPortalCosts: true,
      showPortalProgressPercent: true,
      showPortalWelcomeSheet: true,
    },
  });

  return (
    <>
      <AccountPageHeader
        title="Client portal"
        subtitle="Choose what your buyers and sellers see on their portal. Applies to every sale unless a colleague overrides it on a specific file."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccountCard
          icon={<Browser size={18} weight="bold" />}
          title="What clients see"
          subtitle="Turn any of these off to hide them from every client's portal."
        >
          <ClientPortalSettings
            initial={{
              showPortalKeyDates: agency?.showPortalKeyDates ?? true,
              showPortalCosts: agency?.showPortalCosts ?? true,
              showPortalProgressPercent: agency?.showPortalProgressPercent ?? true,
              showPortalWelcomeSheet: agency?.showPortalWelcomeSheet ?? true,
            }}
          />
        </AccountCard>
      </div>
    </>
  );
}
