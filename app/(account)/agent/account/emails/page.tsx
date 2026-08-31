// app/(account)/agent/account/emails/page.tsx
//
// Account → Emails. A director personalises the wording their buyers and
// sellers receive at each step of a sale. Sales Progressor copy is the default;
// an edit here saves the agency's own version, layered on top, and applies from
// the next send. Director-only (matches Billing / Automation). Client-facing
// copy only — solicitor and internal emails stay ours.

import { notFound } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";
import { buildStepList } from "@/lib/milestone-emails/steps";
import { AgencyMilestoneEmailsEditor } from "@/components/account/emails/AgencyMilestoneEmailsEditor";
import { CompletionPackEditor } from "@/components/account/emails/CompletionPackEditor";
import { ExchangeDayClientEditor } from "@/components/account/emails/ExchangeDayClientEditor";
import { ClientChaseEditor } from "@/components/account/emails/ClientChaseEditor";
import { WeeklyUpdateEditor } from "@/components/account/emails/WeeklyUpdateEditor";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";

export const dynamic = "force-dynamic";

const HAIRLINE = "0.5px solid rgba(0,0,0,0.08)";

function SectionHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</h2>
      <p style={{ margin: "5px 0 0", fontSize: 13, lineHeight: 1.55, color: "#6b7280", maxWidth: 620 }}>{blurb}</p>
    </div>
  );
}

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
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionHeading
          title="Step-by-step updates"
          blurb="The email your client gets at each stage of the sale, from offer accepted through to completion."
        />
        <AgencyMilestoneEmailsEditor steps={steps} />
      </section>

      <div style={{ borderTop: HAIRLINE }} />

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionHeading
          title="Other automated emails"
          blurb="Longer emails that go out at key moments. More will appear here over time."
        />
        <CompletionPackEditor />
        <div style={{ borderTop: HAIRLINE, marginTop: 4 }} />
        <ExchangeDayClientEditor />
        <div style={{ borderTop: HAIRLINE, marginTop: 4 }} />
        <ClientChaseEditor />
        <div style={{ borderTop: HAIRLINE, marginTop: 4 }} />
        <WeeklyUpdateEditor />
      </section>
      </div>
    </>
  );
}
