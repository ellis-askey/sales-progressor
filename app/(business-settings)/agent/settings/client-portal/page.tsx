// /agent/settings/client-portal — the business owner's "Client portal" tab. The
// business-wide default for what buyers and sellers see on the portals of the
// sales this business progresses. Same card + live previews as the agency
// director's Account → Client portal page (ClientPortalSettings), but each flip
// saves via setBusinessPortalDefaultAction, which stores the default on the
// ProgressionBusiness AND writes it through to every current client agency's own
// Agency.showPortal* flag (the flags the portal actually reads). New client
// agencies are seeded from this default at provision. Owner-gated + flag-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { setBusinessPortalDefaultAction } from "@/app/actions/progression-clients";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { ClientPortalSettings } from "@/components/account/client-portal/ClientPortalSettings";
import { DeviceMobile } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function BusinessClientPortalPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const business = await prisma.progressionBusiness.findUnique({
    where: { id: owner.businessId },
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
        subtitle="Choose what buyers and sellers see on the portals for the sales you progress. New clients start from these settings, and a change here applies to your current clients too. You can still fine-tune any client in their workspace."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccountCard
          icon={<DeviceMobile size={18} weight="bold" />}
          title="What clients see"
          subtitle="Switch any of these off to hide them across your clients' portals."
        >
          <ClientPortalSettings
            initial={{
              showPortalKeyDates: business?.showPortalKeyDates ?? true,
              showPortalCosts: business?.showPortalCosts ?? true,
              showPortalProgressPercent: business?.showPortalProgressPercent ?? true,
              showPortalWelcomeSheet: business?.showPortalWelcomeSheet ?? true,
            }}
            save={setBusinessPortalDefaultAction}
          />
        </AccountCard>
      </div>
    </>
  );
}
