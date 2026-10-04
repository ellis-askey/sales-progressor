// /agent/settings/emails — the owner's business-level email settings:
//   1. the client milestone-email wording, editable like an agency's (loads the
//      Sales Progressor default; their edits become the business layer and send on
//      every file they progress, for all their clients — the client agency can't
//      touch it); and
//   2. the business's own DEFAULT sending address (the tier beneath a client
//      agency's own verified sender).
// Owner-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { buildStepList } from "@/lib/milestone-emails/steps";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AgencyMilestoneEmailsEditor } from "@/components/account/emails/AgencyMilestoneEmailsEditor";
import { SenderDomainSection } from "@/components/progression/SenderDomainSection";
import { ShareNetwork } from "@phosphor-icons/react/dist/ssr";

export default async function BusinessEmailsPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  // Client-facing steps only (buyer/seller copy) — same as the agency editor.
  const steps = buildStepList()
    .filter((s) => s.sides.includes("vendor") || s.sides.includes("purchaser"))
    .map((s) => ({ ...s, sides: s.sides.filter((x) => x === "vendor" || x === "purchaser") }));

  return (
    <>
      <AccountPageHeader
        title="Emails"
        subtitle="The client emails that send on the sales you progress, and how they're sent."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccountCard
          icon={<ShareNetwork size={18} weight="bold" />}
          title="Step-by-step updates"
          subtitle="The email a client's buyer or seller receives at each stage. Starts from our default; your edits apply to every file you progress."
        >
          <AgencyMilestoneEmailsEditor steps={steps} base="/api/agent/settings/milestone-emails" />
        </AccountCard>

        <AccountCard title="Sending address" subtitle="The address your clients' emails come from.">
          <SenderDomainSection base="/api/agent/settings/sender" scope="business" />
          <p style={{ margin: "14px 2px 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--agent-text-muted)" }}>
            To send a specific client&rsquo;s emails from their own address instead, open that client from
            Clients and set up their sending address on the Branding tab.
          </p>
        </AccountCard>
      </div>
    </>
  );
}
