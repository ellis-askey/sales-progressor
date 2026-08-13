// "Ready to exchange" email (audit #10).
//
// The single biggest moment before exchange: both sides have cleared the
// exchange gate (VM18 vendor-ready + PM25 purchaser-ready, confirmed by the
// solicitors or by us on their behalf). Today only a push notification fires,
// so an email-only client can miss it. This sends one clean, celebratory
// email to the buyer + seller.
//
// Send-once is guaranteed by the OutboundEmailQueue unique constraint
// (emailType + sourceId + recipientContactId): re-confirming a gate just hits
// the dedup and no second email goes out. Safe to call from every path that
// can complete VM18 / PM25 (agent confirm, solicitor-confirm flow) — it
// re-checks both gates itself and no-ops until both are done.

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outboundQueue";
import { preheader } from "@/lib/email/preheader";
import { resolveSenderForTransaction } from "@/lib/email";

const GATE_CODES = ["VM18", "PM25"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildReadyToExchangeEmail({
  first, address, agencyName,
}: { first: string; address: string; agencyName: string }): { subject: string; text: string; html: string } {
  const short = address.split(",")[0];
  const subject = `Ready to exchange on ${short}`;

  const text =
    `Hi ${first},\n\n` +
    `Everything's ready for exchange on ${address}. This is the last big step before exchange itself, and both sides are now in place.\n\n` +
    `If an exchange date hasn't already been agreed, your solicitor will be in touch to arrange it.\n\n` +
    `${agencyName}\n`;

  const html =
`<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${preheader("Both sides are ready. Here's what happens next.")}
<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase">${escapeHtml(agencyName)}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">Ready to exchange</h1>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Everything's ready for exchange on <strong>${escapeHtml(address)}</strong>. This is the last big step before exchange itself, and both sides are now in place.</p>
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">If an exchange date hasn't already been agreed, your solicitor will be in touch to arrange it.</p>
<p style="margin:0;font-size:12px;color:#8b91a3">${escapeHtml(agencyName)}</p>
</body></html>`;

  return { subject, text, html };
}

export async function maybeSendReadyToExchangeEmail(transactionId: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      activeBuyerRoundId: true,
      serviceType: true,
      agency: { select: { name: true } },
      assignedUser: { select: { id: true, name: true, email: true, role: true } },
      agentUser:    { select: { id: true, name: true, email: true, role: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        // unsubscribedAt so a client who opted out of everything doesn't get it.
        select: { id: true, name: true, email: true, roleType: true, unsubscribedAt: true },
      },
    },
  });
  if (!tx) return;

  const gateCompletions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      state: "complete",
      milestoneDefinition: { code: { in: GATE_CODES } },
    },
    select: { buyerRoundId: true, milestoneDefinition: { select: { code: true } } },
  });

  const vm18Done = gateCompletions.some((c) => c.milestoneDefinition.code === "VM18");
  // Round-scope the purchaser gate so a fallen-through earlier round can't
  // count. Accept null (pre-round files) or the file's active round.
  const pm25Done = gateCompletions.some(
    (c) =>
      c.milestoneDefinition.code === "PM25" &&
      (tx.activeBuyerRoundId == null || c.buyerRoundId == null || c.buyerRoundId === tx.activeBuyerRoundId),
  );
  if (!vm18Done || !pm25Done) return;

  const agencyName = tx.agency?.name ?? "Sales Progressor";

  // White-label the sender to the file's own agency address (same one the
  // rest of the file's emails come from), so the client doesn't see a
  // "Sales Progressor" sender. Falls back to the platform default.
  const person = tx.serviceType !== "self_managed" ? tx.assignedUser : tx.agentUser;
  let from: string | undefined;
  let replyTo: string | undefined;
  if (person) {
    try {
      const resolved = await resolveSenderForTransaction(transactionId, {
        id: person.id, email: person.email, name: person.name, role: person.role, agencyId: null,
      });
      from = resolved.from;
      replyTo = resolved.replyTo;
    } catch {
      // Fall back to the chain-email defaults in the drain.
    }
  }

  for (const c of tx.contacts) {
    if (!c.email || c.unsubscribedAt) continue;
    const first = c.name.trim().split(/\s+/)[0] || c.name;
    const email = buildReadyToExchangeEmail({ first, address: tx.propertyAddress, agencyName });
    await enqueueEmail({
      emailType: "READY_TO_EXCHANGE",
      sourceId: transactionId,
      recipientEmail: c.email,
      recipientContactId: c.id,
      payload: { subject: email.subject, text: email.text, html: email.html, from, replyTo },
    });
  }
}
