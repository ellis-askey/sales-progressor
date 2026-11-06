"use server";

// "Email the chain" — build the draft the composer opens with: the subject
// (every sale's street line, bottom -> top) and the chain's agents (every other
// sale's agent, with the email we have on file, or null for the no-email flow).
// Read-only; the send itself goes through the normal composer path (which logs
// to your file and checks its own ownership).

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { getChainForTransactionV2 } from "@/lib/services/chains";
import type { IntelViewer } from "@/lib/chain/intel";
import { chainEmailSubject } from "@/lib/chain/chain-email";
import { splitComposeAddress } from "@/lib/services/compose-recipients";

export type ChainEmailAgent = {
  linkId: string;
  name: string;
  email: string | null;
  address: string; // street line, for display in the picker
  // Account photo — only for a claimed (connected) agency's agent; null for a
  // stub agent (shows the grey agent avatar instead).
  image: string | null;
};

export type ChainEmailDraft = {
  anchorTransactionId: string;
  subject: string;
  agents: ChainEmailAgent[];
};

export async function buildChainEmailDraft(
  transactionId: string,
): Promise<{ ok: true; draft: ChainEmailDraft } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Law 7: you can only build a chain email from a sale you can access.
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true, serviceType: true, propertyAddress: true,
      agentUser: { select: { id: true, name: true, email: true, image: true, firmName: true } },
    },
  });
  if (!owned) return { ok: false, error: "You don't have access to this sale." };

  const viewer: IntelViewer = {
    userId: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
    businessId: session.user.progressionBusinessId ?? null,
    scope,
  };

  const chain = await getChainForTransactionV2(transactionId, session.user.id, viewer);
  if (!chain) return { ok: false, error: "This sale isn't in a chain yet." };

  // Chain order, bottom -> top.
  const links = [...chain.links].sort((a, b) => a.position - b.position);

  // Subject lists EVERY sale (including yours).
  const firstLines = links
    .map((l) => splitComposeAddress(l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "").line1)
    .filter(Boolean);

  // Recipients = every OTHER sale's agent (exclude your own link).
  const others = links.filter((l) => l.transactionId !== transactionId);

  // Claimed links point at a real user (the agency that joined) — look up their
  // name + email in one batch. Stub links carry the neighbour details you entered.
  const claimerIds = others.map((l) => l.claimedByUserId).filter((x): x is string => !!x);
  const claimers = claimerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: claimerIds } },
        select: { id: true, name: true, email: true, firmName: true, image: true },
      })
    : [];
  const claimerById = new Map(claimers.map((u) => [u.id, u]));

  const agents: ChainEmailAgent[] = others.map((l) => {
    const address = splitComposeAddress(l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "").line1;
    if (l.claimedByUserId) {
      const u = claimerById.get(l.claimedByUserId);
      return {
        linkId: l.id,
        name: u?.name?.trim() || u?.firmName?.trim() || l.stubAgencyName?.trim() || "Agent",
        email: u?.email ?? null,
        address,
        image: u?.image ?? null,
      };
    }
    return {
      linkId: l.id,
      name: l.stubAgentName?.trim() || l.stubAgencyName?.trim() || "Agent",
      email: l.stubAgentEmail ?? null,
      address,
      image: null,
    };
  });

  // Outsourced files: the progressor (TSP / external business) isn't the estate
  // agent, so include the anchor sale's own agent — "the agent that added it" —
  // as a recipient too. (On a self-managed file that agent is the viewer, so we
  // leave them out.) linkId is a sentinel; they already have an email, so the
  // no-email edit-drawer flow never targets them.
  if (owned.serviceType === "outsourced" && owned.agentUser) {
    const u = owned.agentUser;
    agents.unshift({
      linkId: `anchor-${transactionId}`,
      name: u.name?.trim() || u.firmName?.trim() || "Agent",
      email: u.email ?? null,
      address: splitComposeAddress(owned.propertyAddress).line1,
      image: u.image ?? null,
    });
  }

  return { ok: true, draft: { anchorTransactionId: transactionId, subject: chainEmailSubject(firstLines), agents } };
}
