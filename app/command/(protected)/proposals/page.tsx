import { commandDb } from "@/lib/command/prisma";
import { SOLICITOR_STEP_LABELS } from "@/lib/solicitor-confirm/codes";
import { ProposalReview, type ProposalRow, type ResolvedRow } from "@/components/command/ProposalReview";

export const dynamic = "force-dynamic";

// Tier 3 stage 2 — the review inbox. Every proposal the AI made from an inbound
// email that's still awaiting a decision. Approve runs the real confirm cascade
// (confirm) or logs a private note (note); dismiss just closes it. Nothing here
// has acted on its own.
export default async function ProposalsPage() {
  // Reconcile: a pending "confirm" proposal whose step has since been completed
  // on the file (anywhere) is moot — mark it superseded so it doesn't sit stale.
  // The live path is completeMilestone's hook; this catches anything from before.
  try {
    const pend = await commandDb.milestoneProposal.findMany({
      where: { status: "pending", actionType: "confirm" },
      select: { id: true, transactionId: true, milestoneCode: true },
    });
    if (pend.length > 0) {
      const txIds = [...new Set(pend.map((p) => p.transactionId))];
      const codes = [...new Set(pend.map((p) => p.milestoneCode).filter((c): c is string => !!c))];
      const dones = await commandDb.milestoneCompletion.findMany({
        where: {
          transactionId: { in: txIds },
          state: { in: ["complete", "not_required"] },
          milestoneDefinition: { code: { in: codes } },
        },
        select: { transactionId: true, milestoneDefinition: { select: { code: true } } },
      });
      const doneSet = new Set(dones.map((d) => `${d.transactionId}|${d.milestoneDefinition.code}`));
      const staleIds = pend
        .filter((p) => p.milestoneCode && doneSet.has(`${p.transactionId}|${p.milestoneCode}`))
        .map((p) => p.id);
      if (staleIds.length > 0) {
        await commandDb.milestoneProposal.updateMany({
          where: { id: { in: staleIds } },
          data: { status: "superseded", decidedAt: new Date() },
        });
      }
    }
  } catch {
    // reconcile is best-effort; never block the page
  }

  const [proposals, resolvedRecent] = await Promise.all([
    commandDb.milestoneProposal.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, actionType: true, milestoneCode: true, summary: true, confidence: true,
        emailFrom: true, emailSubject: true, emailSnippet: true, createdAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    }),
    commandDb.milestoneProposal.findMany({
      where: { status: "superseded", decidedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      orderBy: { decidedAt: "desc" },
      take: 15,
      select: {
        id: true, milestoneCode: true, decidedAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    }),
  ]);

  // Recipient preview for confirm proposals: which portal clients get emailed.
  const confirmTxIds = [...new Set(proposals.filter((p) => p.actionType === "confirm").map((p) => p.transaction.id))];
  const contacts = confirmTxIds.length
    ? await commandDb.contact.findMany({
        where: {
          propertyTransactionId: { in: confirmTxIds },
          roleType: { in: ["vendor", "purchaser"] },
          portalEligible: true,
          email: { not: null },
        },
        select: { propertyTransactionId: true, name: true, roleType: true },
      })
    : [];
  const recipientsByTx = new Map<string, string[]>();
  for (const c of contacts) {
    const arr = recipientsByTx.get(c.propertyTransactionId) ?? [];
    arr.push(`${c.name} (${c.roleType === "vendor" ? "seller" : "buyer"})`);
    recipientsByTx.set(c.propertyTransactionId, arr);
  }

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
    recipients: p.actionType === "confirm" ? (recipientsByTx.get(p.transaction.id) ?? []) : [],
  }));

  const resolved: ResolvedRow[] = resolvedRecent.map((p) => ({
    id: p.id,
    propertyAddress: p.transaction.propertyAddress,
    stepLabel: p.milestoneCode ? (SOLICITOR_STEP_LABELS[p.milestoneCode] ?? p.milestoneCode) : null,
    decidedAt: p.decidedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Proposed updates</h1>
        <p className="text-sm text-neutral-400 mt-1 max-w-3xl">
          Inbound emails the assistant thinks may have moved a file. The email is already saved on the file either way,
          so this is only about whether to act. Nothing has been actioned on its own.
        </p>
      </div>
      <ProposalReview proposals={rows} resolved={resolved} />
    </div>
  );
}
