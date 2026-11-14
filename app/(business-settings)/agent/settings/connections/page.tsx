// /agent/settings/connections — a progression business member connects their own
// email inbox (Outlook or any IMAP provider: Gmail, Yahoo, custom domains) so
// replies from solicitors and clients on the sales THEY progress are matched to the
// file, and so they can send from their own address — and, since the capture-first
// pivot (2026-10-18/19), their own WhatsApp: a QR link on the number they already
// have, so their "Sale of …" / "Purchase of …" group chats file against the right
// sale. Connections are per-user; file-matching is scoped to the member's book
// (ConnectionScope.businessId / getAccessScope → business), so they only ever
// touch files they progress.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountConnectionsCard } from "@/components/account/AccountConnectionsCard";
import { ImapConnectionCard } from "@/components/account/ImapConnectionCard";
import { WhatsAppConnectionCard } from "@/components/account/WhatsAppConnectionCard";
import { ConnectionsMatrix } from "@/components/account/ConnectionsMatrix";
import { ConnectionsCardsRow } from "@/components/account/ConnectionsCardsRow";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function BusinessConnectionsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  // Where buyers and sellers' emails actually send from across this business's
  // agencies: each active client link has a verified branded sender, else the
  // platform address. This is the client-facing stream, separate from the
  // member's own inbox the grid is about.
  const clientWhere = { progressionBusinessId: member.businessId, removedAt: null };
  const [clientTotal, clientBranded] = await Promise.all([
    prisma.progressionBusinessClient.count({ where: clientWhere }),
    prisma.progressionBusinessClient.count({ where: { ...clientWhere, senderVerified: true } }),
  ]);
  const PLATFORM_FROM = "updates@thesalesprogressor.co.uk";
  const sends = (n: number) => (n === 1 ? "sends" : "send");
  const fallbackCount = clientTotal - clientBranded;
  const senderSummary =
    clientTotal === 0
      ? "You haven't added any agencies yet. Once you do, set up each one's branded email so their buyers and sellers hear from the agency."
      : clientBranded === 0
        ? `Updates to buyers and sellers currently send from ${PLATFORM_FROM}. Set up branded sending per agency so they come from the agency instead.`
        : clientBranded === clientTotal
          ? clientTotal === 1
            ? "Your agency sends from its own branded address."
            : `All ${clientTotal} of your agencies send from their own branded address.`
          : `${clientBranded} of your ${clientTotal} agencies ${sends(clientBranded)} from their own branded address. The other ${fallbackCount} ${sends(fallbackCount)} from ${PLATFORM_FROM}.`;
  const senderLinkLabel = clientTotal === 0 ? "Add a client →" : "Manage per agency →";

  return (
    <>
      <AccountPageHeader
        title="Connections"
        subtitle="Connect your own inbox for the emails you send directly to agents, like invites and nudges. Your clients' branded emails are set up separately, per client."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Grid = the member's OWN inbox. Joined to its foot, a discreet line on
            the client-facing stream (branded per agency) with a link to set it up. */}
        <ConnectionsMatrix
          variant="progression"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/60 px-5 py-3">
              <p className="text-[11.5px] leading-relaxed text-gray-500">{senderSummary}</p>
              <Link href="/agent/clients" className="shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--agent-coral-deep, #E2452A)", textDecoration: "none" }}>
                {senderLinkLabel}
              </Link>
            </div>
          }
        />

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
