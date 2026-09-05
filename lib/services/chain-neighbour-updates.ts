// Note A — onward-neighbour update notifications.
//
// When a SELLER confirms a step on their onward-purchase tracker, we let the
// agent handling that onward purchase (the chain link ABOVE) know — a polite
// "we've been informed" note, agency-branded, with a small "see the chain on
// Sales Progressor" nudge. Value to a neighbour before they're a customer.
//
// Guardrails (never spam):
//   - The seller's agency must have opted in (Agency.chainNeighbourUpdatesEnabled).
//   - The neighbour must have been INVITED (inviteStatus = SENT) and not yet
//     joined — never a cold contact, never an existing customer.
//   - The neighbour must have an email and not have unsubscribed.
//   - Several confirmations in a short window drain into ONE concise digest.
//
// Its own tiny queue (ChainNeighbourUpdate) rather than OutboundEmailQueue,
// which only accepts a User/Contact recipient (a stub agent is neither).
//
// See docs/active/three-notes-distilled-2026-08-27.md (Note A).

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveChainInviteSender } from "@/lib/chain/invite";
import { neighbourStepClause } from "@/lib/updates-copy";
import { buildInviteUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { isInviteEmailSuppressed } from "@/lib/email";
import { buildChainUpdate } from "@/lib/emails/chain-update";
import { greetingName } from "@/lib/contacts/displayName";

// Several confirmations within this window collapse into one digest email.
const BATCH_WINDOW_MS = 10 * 60 * 1000;

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

/**
 * Queue an update to the onward agent above, if eligible. Fire-and-forget from
 * the seller's portal confirm. Cheap early gates here; fully re-checked at drain.
 */
export async function enqueueOnwardNeighbourUpdate(
  sellerTransactionId: string,
  milestoneCode: string,
): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: sellerTransactionId },
    select: { chainLinkId: true, agency: { select: { chainNeighbourUpdatesEnabled: true } } },
  });
  if (!tx?.chainLinkId || !tx.agency?.chainNeighbourUpdatesEnabled) return;

  const ownLink = await prisma.chainLink.findUnique({
    where: { id: tx.chainLinkId },
    select: { position: true, chainId: true },
  });
  if (!ownLink) return;

  const above = await prisma.chainLink.findFirst({
    where: { chainId: ownLink.chainId, position: ownLink.position - 1 },
    select: { id: true, inviteStatus: true, stubAgentEmail: true, transactionId: true },
  });
  // Invited, not-yet-joined neighbour with an email — never cold, never a customer.
  if (!above || above.transactionId !== null || above.inviteStatus !== "SENT" || !above.stubAgentEmail) return;

  await prisma.chainNeighbourUpdate
    .create({
      data: {
        chainLinkId: above.id,
        transactionId: sellerTransactionId,
        milestoneCode,
        scheduledFor: new Date(Date.now() + BATCH_WINDOW_MS),
      },
    })
    .catch(() => {}); // dedup on (chainLinkId, milestoneCode)
}

/**
 * Send every due update, one email per neighbour (single or digest). Called by
 * the drain cron. Returns how many emails were sent.
 */
export async function drainChainNeighbourUpdates(now: Date = new Date()): Promise<{ sent: number }> {
  // Due, but not older than a day — a persistently-failing send ages out rather
  // than retrying forever, and a day-old chain update isn't worth sending anyway.
  const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const due = await prisma.chainNeighbourUpdate.findMany({
    where: { sentAt: null, scheduledFor: { lte: now }, createdAt: { gte: staleCutoff } },
    select: { id: true, chainLinkId: true, transactionId: true, milestoneCode: true },
    orderBy: { createdAt: "asc" },
  });
  if (due.length === 0) return { sent: 0 };

  const byLink = new Map<string, typeof due>();
  for (const r of due) {
    const list = byLink.get(r.chainLinkId) ?? [];
    list.push(r);
    byLink.set(r.chainLinkId, list);
  }

  let sent = 0;
  for (const [chainLinkId, rows] of byLink) {
    const rowIds = rows.map((r) => r.id);
    try {
      const emailed = await sendNeighbourGroup(chainLinkId, rows);
      // Mark sent whether we emailed or dropped (opted out / suppressed) so we
      // never retry a dropped neighbour forever. Only a thrown send error leaves
      // the rows for the next drain.
      await prisma.chainNeighbourUpdate.updateMany({ where: { id: { in: rowIds } }, data: { sentAt: now } });
      if (emailed) sent++;
    } catch (err) {
      console.error(`[drainChainNeighbourUpdates] link ${chainLinkId} failed`, err);
    }
  }
  return { sent };
}

async function sendNeighbourGroup(
  chainLinkId: string,
  rows: { transactionId: string; milestoneCode: string }[],
): Promise<boolean> {
  const link = await prisma.chainLink.findUnique({
    where: { id: chainLinkId },
    select: {
      inviteStatus: true, inviteToken: true, stubAgentEmail: true, stubAgentName: true,
      stubPropertyAddress: true, transactionId: true,
    },
  });
  // Re-gate: invited stub with an email, not joined, not unsubscribed.
  if (!link || link.transactionId !== null || link.inviteStatus !== "SENT" || !link.stubAgentEmail) return false;
  if (await isInviteEmailSuppressed(chainLinkId)) return false;

  const sellerTransactionId = rows[0].transactionId;
  const seller = await prisma.propertyTransaction.findUnique({
    where: { id: sellerTransactionId },
    select: {
      agency: { select: { name: true, chainNeighbourUpdatesEnabled: true } },
      contacts: { where: { roleType: "vendor" }, select: { name: true }, take: 1 },
    },
  });
  if (!seller?.agency?.chainNeighbourUpdatesEnabled) return false;

  // Raw name drives the pronoun (his/her from a title, else their); the display
  // name drops the honorific (voice rule: no titles in rendered names). So
  // "Mr Marcus Fielding" shows as "Marcus Fielding" but reads "his".
  const rawName = seller.contacts[0]?.name ?? "your buyer";
  const displayName = rawName.replace(/^(mr|mrs|ms|miss|dr|prof|sir|dame|lord|lady)\.?\s+/i, "").trim() || rawName;
  const onwardAddress = link.stubPropertyAddress ?? "the property";

  const codes = [...new Set(rows.map((r) => r.milestoneCode))];
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: codes } },
    select: { code: true, name: true },
  });
  const nameByCode = new Map(defs.map((d) => [d.code, d.name]));
  // Bespoke, possessive, third-person clauses ("his solicitor has received his
  // mortgage offer") — never the seller's own second-person portal wording.
  const labels = codes.map((c) => neighbourStepClause(c, { name: rawName }, nameByCode.get(c) ?? c));

  const sender = await resolveChainInviteSender(sellerTransactionId, {
    name: seller.agency.name,
    agencyId: null,
    agencyName: seller.agency.name,
  });

  const claimUrl = link.inviteToken ? `${baseUrl()}/claim?token=${link.inviteToken}` : `${baseUrl()}/`;
  const unsubscribeUrl = buildInviteUnsubscribeUrl(chainLinkId);

  const { subject, html, text } = buildChainUpdate({
    recipientName: greetingName(link.stubAgentName),
    agencyName: sender.displayAgency,
    sellerName: displayName,
    onwardAddress,
    labels,
    chainUrl: claimUrl,
    unsubscribeUrl,
  });

  await sendAgentEmail({
    to: link.stubAgentEmail,
    subject,
    html,
    text,
    from: sender.from,
    replyTo: sender.replyTo,
    kind: "chain_neighbour_update",
    meta: { originatorAgency: sender.displayAgency },
  });
  return true;
}

// The neighbour-update email is now the redesigned buildChainUpdate template
// (lib/emails/chain-update.ts), wired in sendNeighbourGroup above.
