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

export const dynamic = "force-dynamic";

export default async function AccountEmailsPage() {
  const { session } = await resolveAgentSession();
  if (session.user.role !== "director" || !session.user.agencyId) notFound();

  // Client-facing steps only (buyer/seller copy); strip agent/internal sides.
  const steps = buildStepList()
    .filter((s) => s.sides.includes("vendor") || s.sides.includes("purchaser"))
    .map((s) => ({ ...s, sides: s.sides.filter((x) => x === "vendor" || x === "purchaser") }));

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
          Your client emails
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6b7280", maxWidth: 620 }}>
          Every update your buyers and sellers receive is written for you, ready to send. Make any of it
          your own and we&apos;ll use your version from the next send. Anything you leave alone keeps ours.
        </p>
      </div>

      <AgencyMilestoneEmailsEditor steps={steps} />
    </div>
  );
}
