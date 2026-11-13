// app/(account)/agent/account/connections/page.tsx
//
// Connections tab. A director or negotiator connects their email inbox so
// replies from solicitors and clients that relate to their sales are matched to
// files. Gated to agency users; internal staff use the Command Centre
// connections page instead. The connect + callback routes return agency users
// here (rather than the superadmin page) so the flow no longer dead-ends.

import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { AccountConnectionsCard } from "@/components/account/AccountConnectionsCard";
import { ImapConnectionCard } from "@/components/account/ImapConnectionCard";
import { WhatsAppConnectionCard } from "@/components/account/WhatsAppConnectionCard";
import { ConnectionsMatrix } from "@/components/account/ConnectionsMatrix";
import { ConnectionsCardsRow } from "@/components/account/ConnectionsCardsRow";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { SendingAddressesSection } from "@/components/verified-emails/SendingAddressesSection";
import { canUseWhatsAppConnect } from "@/lib/integrations/whatsapp/connect-access";
import { prisma } from "@/lib/prisma";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";

export default async function AccountConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await requireSession();
  const role = session.user.role;
  // Agency agents as before; external progression-business members also reach
  // this page for the WhatsApp link (pivot 2026-10-18) — email connection
  // cards below stay for all (same inbox-matching value for a business).
  if (role !== "director" && role !== "negotiator" && !(await canUseWhatsAppConnect(session))) notFound();

  // Sending-address management lives here now (consolidated onto Connections,
  // 2026-11-13). ?verified=1 lands here when an email verification link
  // succeeds. domainVerified lets the section reassure (rather than push the
  // per-address code step) when the user already sends from their own domain.
  const { verified } = await searchParams;
  const userDomain = session.user.email?.split("@")[1]?.toLowerCase() ?? null;
  const domainVerified = !!(
    session.user.agencyId && userDomain &&
    (await prisma.verifiedDomain.findFirst({
      where: { agencyId: session.user.agencyId, domain: userDomain, status: "verified" },
      select: { id: true },
    }))
  );

  return (
    <>
      <AccountPageHeader
        title="Connections"
        subtitle="Connect your inbox to automatically match emails from solicitors and clients to the correct sale. We only access emails related to your sales, and you can disconnect at any time."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <ConnectionsMatrix domainVerified={domainVerified} />

        <AccountCard
          icon={<EnvelopeSimple size={18} weight="bold" />}
          title="Sending addresses"
          subtitle="Send emails to clients directly from your own work email address."
        >
          <SendingAddressesSection
            initialVerified={verified === "1"}
            domainVerified={domainVerified}
            ownAddress={session.user.email ?? undefined}
            homeHref="/agent/account/connections"
          />
        </AccountCard>

        <ConnectionsCardsRow
          outlook={
            <Suspense
              fallback={
                <div className="rounded-xl border border-gray-200 bg-white p-5 text-[13px] text-gray-500">
                  Loading…
                </div>
              }
            >
              <AccountConnectionsCard />
            </Suspense>
          }
          email={<ImapConnectionCard />}
          whatsapp={<WhatsAppConnectionCard />}
        />
      </div>
    </>
  );
}
