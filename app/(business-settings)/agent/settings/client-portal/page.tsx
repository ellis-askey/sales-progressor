// /agent/settings/client-portal — the business owner's "Client portal" tab:
// the client-invitation mode (BusinessInviteMode) + the business-wide "what
// clients see" defaults for the sales this business progresses. Same cards as
// the agency director's Account → Client portal page. "What clients see" flips
// save via setBusinessPortalDefaultAction, which stores the default on the
// ProgressionBusiness; the portal reads the responsible party's value at render
// time, so it governs every file this business progresses (no write-through into
// client Agency rows). Owner-gated + flag-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { setBusinessPortalDefaultAction } from "@/app/actions/progression-clients";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { ClientPortalSettings } from "@/components/account/client-portal/ClientPortalSettings";
import { examplePreviewKeyDates } from "@/lib/portal/preview-key-dates";
import { BusinessInviteMode } from "@/components/account/client-portal/BusinessInviteMode";
import { PreviewPortalLink } from "@/components/account/client-portal/PreviewPortalLink";
import type { InviteMode } from "@/app/actions/progression-clients";
import { DeviceMobile, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";

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
      autoInviteOnAgentAdd: true,
      autoInviteOnOwnAdd: true,
    },
  });

  // Collapse the two per-creator flags into the single-choice mode the card shows.
  const agentAdd = business?.autoInviteOnAgentAdd ?? true;
  const ownAdd = business?.autoInviteOnOwnAdd ?? true;
  const inviteMode: InviteMode = !agentAdd ? "manual" : ownAdd ? "auto" : "agent_only";

  return (
    <>
      <AccountPageHeader
        title="Client portal"
        subtitle="Choose when buyers and sellers are invited to their portals and what they can see on sales you progress. You can also adjust key dates for individual sales."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccountCard
          icon={<PaperPlaneTilt size={18} weight="bold" />}
          title="Client invitations"
          subtitle="Choose when buyers and sellers receive their portal invitation."
        >
          <BusinessInviteMode initial={inviteMode} />
          <PreviewPortalLink variant="business" />
        </AccountCard>
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
            exampleKeyDates={examplePreviewKeyDates()}
          />
        </AccountCard>
      </div>
    </>
  );
}
