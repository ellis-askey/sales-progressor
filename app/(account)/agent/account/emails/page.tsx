// app/(account)/agent/account/emails/page.tsx
//
// Account → Emails. A director personalises the wording their buyers and
// sellers receive. Sales Progressor copy is the default; an edit saves the
// agency's own version, layered on top, from the next send. Director-only.
// Client-facing copy only — solicitor and internal emails stay ours.
//
// Redesign: "Step-by-step updates" (the milestone editor) and "Automated
// emails" (a compact list whose rows open the editor in a right-side drawer)
// as cards.

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { buildStepList } from "@/lib/milestone-emails/steps";
import { AgencyMilestoneEmailsEditor } from "@/components/account/emails/AgencyMilestoneEmailsEditor";
import { AutomatedEmailsList } from "@/components/account/emails/AutomatedEmailsList";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { ShareNetwork, EnvelopeSimple, Info } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function AccountEmailsPage() {
  const { session } = await resolveAgentSession();
  if (session.user.role !== "director" || !session.user.agencyId) notFound();

  // Client-facing steps only (buyer/seller copy); strip agent/internal sides.
  const steps = buildStepList()
    .filter((s) => s.sides.includes("vendor") || s.sides.includes("purchaser"))
    .map((s) => ({ ...s, sides: s.sides.filter((x) => x === "vendor" || x === "purchaser") }));

  return (
    <>
      <AccountPageHeader
        title="Your client emails"
        subtitle="Every email is ready to send. Customise any of them and we'll use your version instead."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccountCard
          icon={<ShareNetwork size={18} weight="bold" />}
          title="Step-by-step updates"
          subtitle="The email your client receives at each stage of the sale."
        >
          <AgencyMilestoneEmailsEditor steps={steps} />
        </AccountCard>

        <AccountCard
          icon={<EnvelopeSimple size={18} weight="bold" />}
          title="Automated emails"
          subtitle="Longer emails that go out at key moments."
        >
          <AutomatedEmailsList />
        </AccountCard>

        <AccountCard style={{ background: "rgba(37,99,235,0.04)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Info size={20} weight="fill" style={{ color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Your version, your clients see</p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>
                We&apos;ll automatically use your edited versions from the next send. Anything you leave alone keeps ours.
              </p>
            </div>
          </div>
        </AccountCard>
      </div>
    </>
  );
}
