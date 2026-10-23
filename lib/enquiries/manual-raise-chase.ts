// Manual "get enquiries raised" chase — the drawer behind the Chase button on
// the escalated enquiries reminder (founder plan 2026-10-21).
//
// Mirrors the autopilot's solicitor branch in raise-chase.ts exactly: same
// email builder, same replyable sender, same signature rules, same per-agency
// solicitor CC, same logging — and, crucially, the SAME EnquiryRaiseChase
// ledger (lastNudgedAt / lastTarget / nudgeCount), so the card shows one
// honest count and the autopilot's cadence clock resets on a manual send
// (no morning-after double nudge). After sending (or marking chased) the
// reminder re-arms via the lane's own hold: PM14 expectedDate pushed 3
// working days out, exactly like a snooze.

import { prisma } from "@/lib/prisma";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { sendChainEmail } from "@/lib/email";
import { solicitorCcForAgency } from "@/lib/services/solicitor-cc";
import { extractFirstName } from "@/lib/contacts/displayName";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { resolveAgentSignatureForFile } from "@/lib/email/agent-signature-for-file";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";
import { signSolicitorToken } from "@/lib/solicitor-confirm/token";
import { baseUrl } from "./chase";
import { buildRaiseSolicitorEmail } from "./raise-chase-email";
import { logChaseSend, logEnquiryChaseComm } from "./chase-log";
import { wrapEditedBody } from "@/lib/email/wrap-edited-body";

const TX_SELECT = {
  id: true,
  propertyAddress: true,
  agencyId: true,
  assignedUserId: true,
  agentUserId: true,
  activeBuyerRoundId: true,
  agency: { select: { name: true, logoPath: true } },
  purchaserSolicitorContact: { select: { id: true, email: true, name: true, secondaryEmail: true } },
  purchaserSolicitorFirm: { select: { name: true } },
  vendorSolicitorFirm: { select: { name: true } },
  contacts: { select: { name: true, roleType: true, buyerRoundId: true } },
} as const;

async function assemble(transactionId: string) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: TX_SELECT,
  });
  if (!tx) return null;

  const ownerId = tx.assignedUserId ?? tx.agentUserId;
  let senderName = tx.agency?.name ?? "The Sales Progressor";
  let ownerAgent: { name: string | null; agencyId: string | null; phone: string | null; directMobile: string | null } | null = null;
  if (ownerId) {
    ownerAgent = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { name: true, agencyId: true, phone: true, directMobile: true },
    });
    if (ownerAgent?.name) senderName = ownerAgent.name;
  }
  const agentSig = await resolveAgentSignatureForFile({
    assignedUserId: tx.assignedUserId,
    agentUserId: tx.agentUserId,
    agentName: senderName,
    agency: tx.agency,
  });
  const inHouseSig = !agentSig && ownerAgent && !ownerAgent.agencyId
    ? buildInHouseSignoff({
        name: senderName,
        agency: tx.agency?.name ?? "",
        phone: ownerAgent.directMobile ?? ownerAgent.phone ?? null,
      })
    : null;

  const clientNames = tx.contacts
    .filter((c) => c.roleType === "purchaser" && isActiveRoundContact(c, tx.activeBuyerRoundId))
    .map((c) => c.name);

  const mail = buildRaiseSolicitorEmail({
    address: tx.propertyAddress,
    clientNames,
    sellerFirmName: tx.vendorSolicitorFirm?.name ?? undefined,
    recipientFirstName: tx.purchaserSolicitorContact?.name?.trim()
      ? extractFirstName(tx.purchaserSolicitorContact.name)
      : undefined,
    senderName,
    agencyName: tx.agency?.name ?? "The Sales Progressor",
    provideUpdateUrl: `${baseUrl()}/s/${signSolicitorToken(tx.id, "purchaser")}`,
    now: new Date(),
    agentSignatureHtml: agentSig?.html ?? inHouseSig?.html ?? null,
    agentSignatureText: agentSig?.text ?? (inHouseSig ? inHouseSig.text.trim() : null),
  });

  return { tx, ownerId, mail };
}

export type ManualRaiseChaseDraft =
  | {
      ok: true;
      recipientName: string | null;
      recipientEmail: string;
      firmName: string | null;
      cc: string[];
      subject: string;
      bodyText: string;
      nudgeCount: number;
      lastNudgedAt: string | null;
    }
  | { ok: false; reason: "no_solicitor_email" | "not_found" };

// The drawer's opening payload: the exact email the autopilot would send,
// editable, plus the shared history line.
export async function loadManualRaiseChaseDraft(transactionId: string): Promise<ManualRaiseChaseDraft> {
  const a = await assemble(transactionId);
  if (!a) return { ok: false, reason: "not_found" };
  const email = a.tx.purchaserSolicitorContact?.email;
  if (!email) return { ok: false, reason: "no_solicitor_email" };

  const [cc, chase] = await Promise.all([
    solicitorCcForAgency(a.tx.purchaserSolicitorContact, a.tx.agencyId),
    prisma.enquiryRaiseChase.findFirst({
      where: { transactionId, closedAt: null },
      select: { nudgeCount: true, lastNudgedAt: true },
    }),
  ]);

  return {
    ok: true,
    recipientName: a.tx.purchaserSolicitorContact?.name ?? null,
    recipientEmail: email,
    firmName: a.tx.purchaserSolicitorFirm?.name ?? null,
    cc: cc ?? [],
    subject: a.mail.subject,
    bodyText: a.mail.text,
    nudgeCount: chase?.nudgeCount ?? 0,
    lastNudgedAt: chase?.lastNudgedAt?.toISOString() ?? null,
  };
}

// Stamp the shared ledger (one honest count; autopilot clock resets).
async function stampLedger(transactionId: string) {
  await prisma.enquiryRaiseChase.updateMany({
    where: { transactionId, closedAt: null },
    data: { lastNudgedAt: new Date(), lastTarget: "buyer_solicitor", nudgeCount: { increment: 1 } },
  }).catch(() => {});
}

export async function sendManualRaiseChase(
  transactionId: string,
  input: { subject?: string | null; bodyText?: string | null },
  sentByUserId: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const a = await assemble(transactionId);
  if (!a) return { ok: false, reason: "not_found" };
  const email = a.tx.purchaserSolicitorContact?.email;
  if (!email) return { ok: false, reason: "no_solicitor_email" };

  const { from, replyTo } = await resolveAgencySenderForTransaction(transactionId, { persona: "personal" });
  const edited = input.bodyText?.trim() || null;
  const subject = input.subject?.trim() || a.mail.subject;
  const text = edited ?? a.mail.text;
  const html = edited ? wrapEditedBody(edited) : a.mail.html;
  const now = new Date();

  await sendChainEmail({
    to: email,
    cc: await solicitorCcForAgency(a.tx.purchaserSolicitorContact, a.tx.agencyId),
    subject,
    text,
    html,
    from,
    replyTo,
  });
  await logChaseSend({
    transactionId,
    kind: "raise",
    recipient: "buyer_solicitor",
    recipientName: a.tx.purchaserSolicitorFirm?.name ?? null,
  }).catch(() => {});
  await logEnquiryChaseComm({
    transactionId,
    agencyId: a.tx.agencyId,
    subject,
    body: text,
    html,
    fromEmail: from,
    recipientEmail: email,
    recipientName: a.tx.purchaserSolicitorFirm?.name ?? null,
    createdById: sentByUserId,
    sentAt: now,
  }).catch(() => {});
  await stampLedger(transactionId);
  return { ok: true };
}

// "Mark chased" (no email): same ledger stamp, so the count stays honest and
// the autopilot clock still resets.
export async function markRaiseChased(transactionId: string): Promise<void> {
  await stampLedger(transactionId);
}
