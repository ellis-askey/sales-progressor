import { prisma } from "@/lib/prisma";
import { runProgressionAgent, createProductionAgentDeps } from "@/lib/agent/progression-agent";

// Read each newly captured inbound (Outlook) email and run the progression
// agent in SHADOW MODE. The agent is now the single source of truth for
// interpreting inbound email: it creates one AgentRun per email, records what
// it WOULD do as AgentActions (validated against real business rules), and —
// preserving the existing review surface — creates a MilestoneProposal where
// appropriate. It NEVER mutates transaction state. Approving/dismissing on
// /command/proposals remains the only thing that acts (a human clicking).
//
// Selection + idempotency are unchanged: only Outlook-sourced inbound emails
// that were matched to a transaction and not yet read, stamped aiInterpretedAt
// so each is processed once. Called from the outlook-sync cron.

export async function interpretNewInboundEmails(limit = 30): Promise<{ interpreted: number; proposed: number }> {
  const msgs = await prisma.outboundMessage.findMany({
    where: {
      type: "inbound",
      aiInterpretedAt: null,
      transactionId: { not: null },
      providerWebhookData: { path: ["source"], equals: "outlook" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, transactionId: true, agencyId: true, subject: true, content: true, providerWebhookData: true },
  });

  const deps = createProductionAgentDeps();
  let interpreted = 0;
  let proposed = 0;
  for (const m of msgs) {
    if (!m.transactionId) continue;
    const from = ((m.providerWebhookData as { from?: string } | null)?.from) ?? null;
    try {
      const res = await runProgressionAgent(
        { id: m.id, transactionId: m.transactionId, agencyId: m.agencyId, subject: m.subject, content: m.content, from },
        deps,
      );
      if (res.proposalCreated) proposed++;
    } catch {
      // A failed run is recorded inside the agent; it must never block the sweep.
    }
    // Stamp read-once regardless of the run outcome (a re-run is also guarded by
    // AgentRun.triggerMessageId's unique constraint).
    await prisma.outboundMessage.update({ where: { id: m.id }, data: { aiInterpretedAt: new Date() } }).catch(() => {});
    interpreted++;
  }
  return { interpreted, proposed };
}
