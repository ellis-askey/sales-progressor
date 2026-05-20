// lib/email/chainNotifications.ts
// Email content builders and fire functions for chain notification emails.
// Withdrawal: synchronous fire + ChainNotificationQueue cron fallback.
// Exchange / completion / celebration: OutboundEmailQueue quiet-hours drain.

import { prisma } from "@/lib/prisma";
import { sendChainEmail, isUserEmailSuppressed } from "@/lib/email";
import { buildUserUnsubscribeUrl } from "@/lib/email/unsubscribe";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

// ─── Withdrawal ────────────────────────────────────────────────────────────────

export function buildWithdrawalEmailPayload({
  withdrawingAddress,
  reason,
  recipientTransactionId,
  unsubscribeUrl,
}: {
  withdrawingAddress: string;
  reason: string | null;
  recipientTransactionId: string | null;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${withdrawingAddress} has withdrawn from the chain`;
  const ctaUrl = recipientTransactionId
    ? `${portalBase()}/agent/transactions/${recipientTransactionId}`
    : `${portalBase()}/agent/hub`;

  const textLines = [
    `${withdrawingAddress} has withdrawn.`,
    ...(reason ? [`Reason: ${reason}`] : []),
    `Open the chain to update your plans.`,
    ``,
    `Open chain: ${ctaUrl}`,
    ``,
    `—`,
    `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`,
    `Need help? support@thesalesprogressor.co.uk`,
  ];
  const text = textLines.join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 20px;line-height:1.3;">${escapeHtml(withdrawingAddress)} has withdrawn from the chain</h1>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(withdrawingAddress)} has withdrawn.</p>
          ${reason ? `<p style="font-size:14px;color:#4a5162;margin:0 0 8px;">Reason: ${escapeHtml(reason)}</p>` : ""}
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">Open the chain to update your plans.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="border-radius:8px;background:#FF6B4A;">
              <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;color:white;text-decoration:none;font-weight:500;font-size:15px;">Open chain</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#c0c4d0;text-align:center;">
        <a href="${unsubscribeUrl}" style="color:#c0c4d0;text-decoration:none;">Unsubscribe</a> &nbsp;·&nbsp;
        <a href="mailto:support@thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none;">support@thesalesprogressor.co.uk</a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

// Reads all pending ChainNotificationQueue records and fires withdrawal emails.
// Called synchronously from notifyChainMatesOfWithdrawal, and by the hourly cron fallback.
export async function fireWithdrawalNotifications(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const pending = await prisma.chainNotificationQueue.findMany({
    where: { notifiedAt: null },
    take: 50,
  });
  if (pending.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  // Batch-fetch withdrawing property addresses
  const withdrawingTxIds = [...new Set(pending.map((r) => r.withdrawingTransactionId))];
  const withdrawingTxs = await prisma.propertyTransaction.findMany({
    where: { id: { in: withdrawingTxIds } },
    select: { id: true, propertyAddress: true },
  });
  const addrMap = new Map(withdrawingTxs.map((t) => [t.id, t.propertyAddress]));

  // Batch-fetch recipient transaction IDs via ChainLink
  const recipientLinkIds = [...new Set(pending.map((r) => r.recipientLinkId))];
  const recipientLinks = await prisma.chainLink.findMany({
    where: { id: { in: recipientLinkIds } },
    select: { id: true, transactionId: true },
  });
  const txIdMap = new Map(recipientLinks.map((l) => [l.id, l.transactionId]));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of pending) {
    const suppressed = await isUserEmailSuppressed(record.recipientUserId);
    if (suppressed) {
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { notifiedAt: new Date() },
      });
      console.log(
        `[EMAIL_SKIP] type=WITHDRAWAL userId=${record.recipientUserId} reason=unsubscribed`,
      );
      skipped++;
      continue;
    }

    const withdrawingAddress = addrMap.get(record.withdrawingTransactionId) ?? "A property";
    const recipientTransactionId = txIdMap.get(record.recipientLinkId) ?? null;
    const unsubscribeUrl = buildUserUnsubscribeUrl(record.recipientUserId);

    const { subject, text, html } = buildWithdrawalEmailPayload({
      withdrawingAddress,
      reason: record.withdrawingReason,
      recipientTransactionId,
      unsubscribeUrl,
    });

    try {
      await sendChainEmail({ to: record.recipientEmail, subject, text, html });
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { notifiedAt: new Date() },
      });
      console.log(`[EMAIL_SENT] type=WITHDRAWAL to=${record.recipientEmail}`);
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "send error";
      console.error(`[EMAIL_FAIL] type=WITHDRAWAL to=${record.recipientEmail} err=${message}`);
      failed++;
    }
  }

  return { sent, skipped, failed };
}
