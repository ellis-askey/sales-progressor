// /agent/settings/connections — the progression business owner connects their own
// email inbox (Outlook or any IMAP provider: Gmail, Yahoo, custom domains) so
// replies from solicitors and clients on the sales THEY progress are matched to the
// file, and so they can send from their own address. The connection is per-user and
// file-matching is scoped to the owner's book (getAccessScope → business), so it
// only ever touches files they progress. Owner-gated. WhatsApp is omitted for now
// (external-business WhatsApp pairing is a later feature).

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountConnectionsCard } from "@/components/account/AccountConnectionsCard";
import { ImapConnectionCard } from "@/components/account/ImapConnectionCard";

export default async function BusinessConnectionsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  return (
    <>
      <AccountPageHeader
        title="Connections"
        subtitle="Connect your email inbox so replies on the sales you progress are saved to the file, and you can send from your own address."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-[13px] text-gray-500">
              Loading…
            </div>
          }
        >
          <AccountConnectionsCard />
        </Suspense>

        <ImapConnectionCard />
      </div>
    </>
  );
}
