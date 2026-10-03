// /agent/settings/emails — the owner's business-level email settings. For now
// this is the business's own DEFAULT sending address (the tier beneath a client
// agency's own verified sender). Owner-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { SenderDomainSection } from "@/components/progression/SenderDomainSection";

export default async function BusinessEmailsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  return (
    <>
      <AccountPageHeader
        title="Emails"
        subtitle="How your client-facing emails are sent."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SenderDomainSection base="/api/agent/settings/sender" scope="business" />
        <p style={{ margin: "0 2px", fontSize: 12.5, lineHeight: 1.6, color: "var(--agent-text-muted)" }}>
          To send a specific client&rsquo;s emails from their own address instead, open that client from
          Clients and set up their sending address on the Branding tab.
        </p>
      </div>
    </>
  );
}
