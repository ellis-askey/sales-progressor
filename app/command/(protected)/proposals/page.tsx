import { commandDb } from "@/lib/command/prisma";
import { SOLICITOR_STEP_LABELS } from "@/lib/solicitor-confirm/codes";
import { ProposalReview, type ProposalRow } from "@/components/command/ProposalReview";

export const dynamic = "force-dynamic";

// Tier 3 stage 2 — the review inbox. Every proposal the AI made from an inbound
// email that's still awaiting a decision. Approve runs the real confirm cascade;
// dismiss just closes it. Nothing here has acted on its own.
export default async function ProposalsPage() {
  const proposals = await commandDb.milestoneProposal.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, actionType: true, milestoneCode: true, summary: true, confidence: true,
      emailFrom: true, emailSubject: true, emailSnippet: true, createdAt: true,
      transaction: { select: { id: true, propertyAddress: true } },
    },
  });

  const rows: ProposalRow[] = proposals.map((p) => ({
    id: p.id,
    transactionId: p.transaction.id,
    propertyAddress: p.transaction.propertyAddress,
    actionType: p.actionType as "confirm" | "note",
    stepLabel: p.actionType === "confirm" && p.milestoneCode ? (SOLICITOR_STEP_LABELS[p.milestoneCode] ?? p.milestoneCode) : null,
    milestoneCode: p.milestoneCode,
    summary: p.summary,
    confidence: p.confidence,
    emailFrom: p.emailFrom,
    emailSubject: p.emailSubject,
    emailSnippet: p.emailSnippet,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Proposed updates</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Inbound emails the assistant thinks may have moved a file. Nothing has been actioned. Approve to confirm the step (this emails the client and runs the usual updates), or dismiss.
        </p>
      </div>
      <ProposalReview proposals={rows} />
    </div>
  );
}
