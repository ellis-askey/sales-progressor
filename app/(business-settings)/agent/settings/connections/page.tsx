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

export default async function BusinessConnectionsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) notFound();

  return (
    <>
      <AccountPageHeader
        title="Connections"
        subtitle="Connect your inbox so replies about your sales are saved to the right file, and so the emails you write yourself go out from your own address."
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

        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>WhatsApp</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Link your WhatsApp so your property group chats are saved to the right sale. We only read
            your &ldquo;Sale of &hellip;&rdquo; and &ldquo;Purchase of &hellip;&rdquo; groups, never your one-to-one chats, and you can
            disconnect at any time.
          </p>
        </div>
        <WhatsAppConnectionCard />
      </div>
    </>
  );
}
