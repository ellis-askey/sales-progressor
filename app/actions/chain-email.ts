"use server";

// "Email the chain" — build the draft the composer opens with: the subject
// (every sale's street line, bottom -> top) and the chain's agents (every other
// sale's agent, with the email we have on file, or null for the no-email flow).
//
// Reads the chain's links DIRECTLY (not via the display-stripped getChainV2) so a
// stub agent's email is visible exactly when the viewer may MANAGE that stub —
// the SAME rule as the edit drawer (canManageStub). Using the display rule here
// (canViewNodeIntel) stripped emails the viewer had just saved, which left the
// no-email flow going in circles. Read-only; the send goes through the normal
// composer path (which logs to your file and checks its own ownership).

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { canManageStub, ownershipFromLinkRow, loadChainEditContext } from "@/lib/chain/stub-permissions";
import { chainEmailSubject } from "@/lib/chain/chain-email";
import { splitComposeAddress } from "@/lib/services/compose-recipients";
import { buildSaleShareSummary } from "@/lib/chain/share-summary";

export type ChainEmailStubEdit = {
  id: string;
  stubPropertyAddress: string | null;
  stubAgencyName: string | null;
  stubAgentName: string | null;
  stubAgentEmail: string | null;
  stubAgentPhone: string | null;
  stubNotes: string | null;
};

export type ChainEmailAgent = {
  linkId: string;
  name: string;
  email: string | null;
  address: string; // street line, for display in the picker
  // Account photo — only for a claimed (connected) agency's agent; null for a
  // stub agent (shows the grey agent avatar instead).
  image: string | null;
  // The stub's current details, so the no-email flow can open the edit drawer.
  // Null for claimed agencies and the anchor estate agent (they have emails).
  editing: ChainEmailStubEdit | null;
};

export type ChainEmailDraft = {
  anchorTransactionId: string;
  chainId: string;
  subject: string;
  agents: ChainEmailAgent[];
  // "Share our latest" — the factual progress block for OUR sale (null if it
  // can't be built). The composer drops it in on demand; never auto-inserted.
  shareSummaryHtml: string | null;
};

export async function buildChainEmailDraft(
  transactionId: string,
): Promise<{ ok: true; draft: ChainEmailDraft } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Law 7: you can only build a chain email from a sale you can access. Also
  // grab the chain this sale belongs to + (for outsourced) its estate agent.
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true, serviceType: true, propertyAddress: true,
      agentUser: { select: { id: true, name: true, email: true, image: true, firmName: true } },
      chainLink: { select: { chainId: true } },
    },
  });
  if (!owned) return { ok: false, error: "You don't have access to this sale." };
  if (!owned.chainLink) return { ok: false, error: "This sale isn't in a chain yet." };
  const chainId = owned.chainLink.chainId;

  // Build the "Share our latest" block in parallel with the chain reads below.
  const summaryPromise = buildSaleShareSummary(transactionId);

  const links = await prisma.chainLink.findMany({
    where: { chainId },
    select: {
      id: true, position: true, transactionId: true,
      stubPropertyAddress: true, stubAgencyName: true, stubAgentName: true, stubAgentEmail: true,
      stubAgentPhone: true, stubNotes: true,
      claimedByUserId: true, createdByUserId: true,
      createdBy: { select: { agencyId: true } },
      transaction: { select: { propertyAddress: true, agencyId: true, assignedUserId: true, agentUserId: true, progressionBusinessId: true } },
    },
    orderBy: { position: "asc" },
  });

  // Edit context (only the "business" scope needs the extra lookup) — the same
  // context the edit routes use, so email-visibility tracks edit-permission.
  const editCtx = await loadChainEditContext(session, chainId);

  // Subject lists EVERY sale (including yours).
  const firstLines = links
    .map((l) => splitComposeAddress(l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "").line1)
    .filter(Boolean);

  // Recipients = every OTHER sale's agent (exclude your own link).
  const others = links.filter((l) => l.transactionId !== transactionId);

  // Claimed links point at a real user (the agency that joined) — batch their
  // name + email + photo. Stub links carry the neighbour details you entered.
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
        editing: null,
      };
    }
    // Stub: show the email only when the viewer may manage this stub (the same
    // rule that let them add it). Others see the agent with no email.
    const canManage = canManageStub(session, ownershipFromLinkRow(l), editCtx);
    return {
      linkId: l.id,
      name: l.stubAgentName?.trim() || l.stubAgencyName?.trim() || "Agent",
      email: canManage ? (l.stubAgentEmail ?? null) : null,
      address,
      image: null,
      editing: canManage
        ? {
            id: l.id,
            stubPropertyAddress: l.stubPropertyAddress,
            stubAgencyName: l.stubAgencyName,
            stubAgentName: l.stubAgentName,
            stubAgentEmail: l.stubAgentEmail,
            stubAgentPhone: l.stubAgentPhone,
            stubNotes: l.stubNotes,
          }
        : null,
    };
  });

  // Outsourced files: the progressor (TSP / external business) isn't the estate
  // agent, so include the anchor sale's own agent — "the agent that added it" —
  // as a recipient too. (On a self-managed file that agent is the viewer.)
  if (owned.serviceType === "outsourced" && owned.agentUser) {
    const u = owned.agentUser;
    agents.unshift({
      linkId: `anchor-${transactionId}`,
      name: u.name?.trim() || u.firmName?.trim() || "Agent",
      email: u.email ?? null,
      address: splitComposeAddress(owned.propertyAddress).line1,
      image: u.image ?? null,
      editing: null,
    });
  }

  return { ok: true, draft: { anchorTransactionId: transactionId, chainId, subject: chainEmailSubject(firstLines), agents, shareSummaryHtml: await summaryPromise } };
}
