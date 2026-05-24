// lib/email/chainNotifications.ts
// Email content builders and fire functions for chain notification emails.
// Withdrawal: synchronous fire + ChainNotificationQueue cron fallback.
// Exchange / completion / celebration: OutboundEmailQueue quiet-hours drain.

import { prisma } from "@/lib/prisma";
import { sendChainEmail, isUserEmailSuppressed } from "@/lib/email";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import { buildUserUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { enqueueEmail } from "@/lib/email/outboundQueue";

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

// ─── Chain cascade notifications ───────────────────────────────────────────────
// Three notification types fire through the same queue + drain pipeline:
//   - LOST_BUYER      — the buyer for the recipient's client's property pulled out
//   - LOST_PURCHASE   — the property the recipient's client was buying fell through
//   - ASKED_TO_WAIT   — onward chain is being re-formed; will your client wait?
//
// All three are framed from the recipient's own client's standpoint. The
// withdrawn party is always adjacent to the recipient, never the recipient.
// Voice rules: no system self-references, no process jargon, active where
// natural, no exclamation marks.

type CascadePayloadArgs = {
  recipientAddress: string;
  recipientTransactionId: string | null;
  unsubscribeUrl: string;
};

function ctaUrlFor(recipientTransactionId: string | null): string {
  return recipientTransactionId
    ? `${portalBase()}/agent/transactions/${recipientTransactionId}`
    : `${portalBase()}/agent/hub`;
}

function shellHtml({ heading, body, ctaUrl, unsubscribeUrl }: { heading: string; body: string; ctaUrl: string; unsubscribeUrl: string }): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 20px;line-height:1.3;">${escapeHtml(heading)}</h1>
          ${body}
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
}

export function buildLostBuyerEmailPayload({
  recipientAddress,
  recipientTransactionId,
  unsubscribeUrl,
}: CascadePayloadArgs): { subject: string; text: string; html: string } {
  const subject = `Update on ${recipientAddress} — the buyer has pulled out`;
  const ctaUrl = ctaUrlFor(recipientTransactionId);
  const lead = `The buyer for your client's property at ${recipientAddress} has pulled out of the chain.`;
  const follow = `Open the chain to let us know what's next — find a new buyer, or withdraw.`;

  const text = [lead, follow, ``, `Open chain: ${ctaUrl}`, ``, `—`, `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`, `Need help? support@thesalesprogressor.co.uk`].join("\n");
  const html = shellHtml({
    heading: subject,
    body: `<p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(lead)}</p><p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">${escapeHtml(follow)}</p>`,
    ctaUrl,
    unsubscribeUrl,
  });
  return { subject, text, html };
}

export function buildLostPurchaseEmailPayload({
  recipientAddress,
  recipientTransactionId,
  unsubscribeUrl,
}: CascadePayloadArgs): { subject: string; text: string; html: string } {
  const subject = `Update on ${recipientAddress} — the onward purchase has fallen through`;
  const ctaUrl = ctaUrlFor(recipientTransactionId);
  const lead = `The property your client was buying has fallen through.`;
  const follow = `Open the chain to let us know what's next — find a new purchase, proceed without one, or withdraw.`;

  const text = [lead, follow, ``, `Open chain: ${ctaUrl}`, ``, `—`, `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`, `Need help? support@thesalesprogressor.co.uk`].join("\n");
  const html = shellHtml({
    heading: subject,
    body: `<p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(lead)}</p><p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">${escapeHtml(follow)}</p>`,
    ctaUrl,
    unsubscribeUrl,
  });
  return { subject, text, html };
}

export function buildAskedToWaitEmailPayload({
  recipientAddress,
  recipientTransactionId,
  unsubscribeUrl,
}: CascadePayloadArgs): { subject: string; text: string; html: string } {
  const subject = `Update on ${recipientAddress} — onward chain is re-forming`;
  const ctaUrl = ctaUrlFor(recipientTransactionId);
  const lead = `The onward chain is being re-formed.`;
  const follow = `Is your client happy to wait while the gap is filled? Open the chain to let us know — wait, or withdraw.`;

  const text = [lead, follow, ``, `Open chain: ${ctaUrl}`, ``, `—`, `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`, `Need help? support@thesalesprogressor.co.uk`].join("\n");
  const html = shellHtml({
    heading: subject,
    body: `<p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(lead)}</p><p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">${escapeHtml(follow)}</p>`,
    ctaUrl,
    unsubscribeUrl,
  });
  return { subject, text, html };
}

export function buildWaitNudgeEmailPayload({
  recipientAddress,
  recipientTransactionId,
  unsubscribeUrl,
}: CascadePayloadArgs): { subject: string; text: string; html: string } {
  const subject = `Still waiting on ${recipientAddress}?`;
  const ctaUrl = ctaUrlFor(recipientTransactionId);
  const lead = `Two weeks ago your client agreed to wait while the onward chain re-formed.`;
  const follow = `Is your client still waiting, or has this moved? Open the chain to update us.`;

  const text = [lead, follow, ``, `Open chain: ${ctaUrl}`, ``, `—`, `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`, `Need help? support@thesalesprogressor.co.uk`].join("\n");
  const html = shellHtml({
    heading: subject,
    body: `<p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(lead)}</p><p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">${escapeHtml(follow)}</p>`,
    ctaUrl,
    unsubscribeUrl,
  });
  return { subject, text, html };
}

/**
 * Drains all unsent (emailSentAt IS NULL) ChainNotificationQueue rows, picking
 * the right payload builder per notification type. Called synchronously after
 * cascade writes; also drained daily by /api/cron/drain-withdrawal-notifications
 * as a fallback for any rows the synchronous fire missed.
 */
export async function fireChainCascadeNotifications(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const pending = await prisma.chainNotificationQueue.findMany({
    where: { emailSentAt: null },
    take: 50,
  });
  if (pending.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  // Batch-fetch the recipient's own transaction address + id (for the email heading + CTA)
  const recipientLinkIds = [...new Set(pending.map((r) => r.recipientLinkId))];
  const recipientLinks = await prisma.chainLink.findMany({
    where: { id: { in: recipientLinkIds } },
    select: { id: true, transactionId: true, transaction: { select: { propertyAddress: true } } },
  });
  const linkInfoMap = new Map(
    recipientLinks.map((l) => [l.id, { transactionId: l.transactionId, address: l.transaction?.propertyAddress ?? "your file" }]),
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of pending) {
    const suppressed = await isUserEmailSuppressed(record.recipientUserId);
    if (suppressed) {
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { emailSentAt: new Date() },
      });
      console.log(`[EMAIL_SKIP] type=${record.type} userId=${record.recipientUserId} reason=unsubscribed`);
      skipped++;
      continue;
    }

    // Per-user opt-out for chain emails. Mark the queue row sent so we don't
    // retry on every cron pass — agent has actively chosen not to receive.
    const prefs = await getNotificationPrefs(record.recipientUserId);
    if (!prefs.chainEmails) {
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { emailSentAt: new Date() },
      });
      console.log(`[EMAIL_SKIP] type=${record.type} userId=${record.recipientUserId} reason=chainEmailsOptOut`);
      skipped++;
      continue;
    }

    const info = linkInfoMap.get(record.recipientLinkId);
    const recipientAddress = info?.address ?? "your file";
    const recipientTransactionId = info?.transactionId ?? null;
    const unsubscribeUrl = buildUserUnsubscribeUrl(record.recipientUserId);

    const payload =
      record.type === "LOST_BUYER"
        ? buildLostBuyerEmailPayload({ recipientAddress, recipientTransactionId, unsubscribeUrl })
        : record.type === "LOST_PURCHASE"
          ? buildLostPurchaseEmailPayload({ recipientAddress, recipientTransactionId, unsubscribeUrl })
          : buildAskedToWaitEmailPayload({ recipientAddress, recipientTransactionId, unsubscribeUrl });

    try {
      await sendChainEmail({ to: record.recipientEmail, subject: payload.subject, text: payload.text, html: payload.html });
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { emailSentAt: new Date() },
      });
      console.log(`[EMAIL_SENT] type=${record.type} to=${record.recipientEmail}`);
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "send error";
      console.error(`[EMAIL_FAIL] type=${record.type} to=${record.recipientEmail} err=${message}`);
      failed++;
    }
  }

  return { sent, skipped, failed };
}

/**
 * Sends a single nudge email for each WAITING response older than 14 days
 * with nudgeSentAt still null. Sets nudgeSentAt on send so it doesn't fire
 * again. Called daily from /api/cron/drain-withdrawal-notifications.
 */
export async function sendChainWaitNudges(): Promise<{ nudged: number; skipped: number; failed: number }> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const stale = await prisma.chainNotificationQueue.findMany({
    where: {
      response: "WAITING",
      respondedAt: { lt: cutoff },
      nudgeSentAt: null,
    },
    take: 50,
    select: {
      id: true,
      recipientUserId: true,
      recipientEmail: true,
      recipientLinkId: true,
    },
  });

  if (stale.length === 0) return { nudged: 0, skipped: 0, failed: 0 };

  const linkIds = [...new Set(stale.map((r) => r.recipientLinkId))];
  const links = await prisma.chainLink.findMany({
    where: { id: { in: linkIds } },
    select: { id: true, transactionId: true, transaction: { select: { propertyAddress: true } } },
  });
  const linkInfoMap = new Map(
    links.map((l) => [l.id, { transactionId: l.transactionId, address: l.transaction?.propertyAddress ?? "your file" }]),
  );

  let nudged = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of stale) {
    const suppressed = await isUserEmailSuppressed(record.recipientUserId);
    if (suppressed) {
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { nudgeSentAt: new Date() },
      });
      console.log(`[EMAIL_SKIP] type=WAIT_NUDGE userId=${record.recipientUserId} reason=unsubscribed`);
      skipped++;
      continue;
    }

    // Per-user opt-out for chain emails (covers nudges too).
    const prefs = await getNotificationPrefs(record.recipientUserId);
    if (!prefs.chainEmails) {
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { nudgeSentAt: new Date() },
      });
      console.log(`[EMAIL_SKIP] type=WAIT_NUDGE userId=${record.recipientUserId} reason=chainEmailsOptOut`);
      skipped++;
      continue;
    }

    const info = linkInfoMap.get(record.recipientLinkId);
    const recipientAddress = info?.address ?? "your file";
    const recipientTransactionId = info?.transactionId ?? null;
    const unsubscribeUrl = buildUserUnsubscribeUrl(record.recipientUserId);

    const payload = buildWaitNudgeEmailPayload({ recipientAddress, recipientTransactionId, unsubscribeUrl });

    try {
      await sendChainEmail({ to: record.recipientEmail, subject: payload.subject, text: payload.text, html: payload.html });
      await prisma.chainNotificationQueue.update({
        where: { id: record.id },
        data: { nudgeSentAt: new Date() },
      });
      console.log(`[EMAIL_SENT] type=WAIT_NUDGE to=${record.recipientEmail}`);
      nudged++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "send error";
      console.error(`[EMAIL_FAIL] type=WAIT_NUDGE to=${record.recipientEmail} err=${message}`);
      failed++;
    }
  }

  return { nudged, skipped, failed };
}

// ─── Decline notification ──────────────────────────────────────────────────────

export function buildDeclineEmailPayload({
  stubAgentEmail,
  stubAddress,
  originatorTransactionId,
  unsubscribeUrl,
}: {
  stubAgentEmail: string;
  stubAddress: string;
  originatorTransactionId: string | null;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${stubAgentEmail} declined your invite — ${stubAddress}`;
  const ctaUrl = originatorTransactionId
    ? `${portalBase()}/agent/transactions/${originatorTransactionId}`
    : `${portalBase()}/agent/hub`;

  const text = [
    `The agent at ${stubAgentEmail} declined your invite for ${stubAddress}.`,
    `Open the chain to update their details and resend, or remove them from the chain.`,
    ``,
    `Open chain: ${ctaUrl}`,
    ``,
    `—`,
    `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`,
    `Need help? support@thesalesprogressor.co.uk`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 20px;line-height:1.3;">${escapeHtml(stubAgentEmail)} declined your invite — ${escapeHtml(stubAddress)}</h1>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">The agent at ${escapeHtml(stubAgentEmail)} declined your invite for ${escapeHtml(stubAddress)}.</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">Open the chain to update their details and resend, or remove them from the chain.</p>
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

// ─── Exchange notification ─────────────────────────────────────────────────────

export function buildExchangeEmailPayload({
  exchangedAddress,
  recipientTransactionId,
  unsubscribeUrl,
}: {
  exchangedAddress: string;
  recipientTransactionId: string | null;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${exchangedAddress} has exchanged — chain update`;
  const ctaUrl = recipientTransactionId
    ? `${portalBase()}/agent/transactions/${recipientTransactionId}`
    : `${portalBase()}/agent/hub`;

  const text = [
    `${exchangedAddress} has exchanged contracts.`,
    `Open the chain to see what this means for yours.`,
    ``,
    `Open chain: ${ctaUrl}`,
    ``,
    `—`,
    `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`,
    `Need help? support@thesalesprogressor.co.uk`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 20px;line-height:1.3;">${escapeHtml(exchangedAddress)} has exchanged — chain update</h1>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(exchangedAddress)} has exchanged contracts.</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">Open the chain to see what this means for yours.</p>
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

// ─── Completion notification ───────────────────────────────────────────────────

export function buildCompletionEmailPayload({
  completedAddress,
  recipientTransactionId,
  unsubscribeUrl,
}: {
  completedAddress: string;
  recipientTransactionId: string | null;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${completedAddress} has completed — chain update`;
  const ctaUrl = recipientTransactionId
    ? `${portalBase()}/agent/transactions/${recipientTransactionId}`
    : `${portalBase()}/agent/hub`;

  const text = [
    `${completedAddress} has completed.`,
    `Open the chain to see what's next.`,
    ``,
    `Open chain: ${ctaUrl}`,
    ``,
    `—`,
    `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`,
    `Need help? support@thesalesprogressor.co.uk`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 20px;line-height:1.3;">${escapeHtml(completedAddress)} has completed — chain update</h1>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">${escapeHtml(completedAddress)} has completed.</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">Open the chain to see what&apos;s next.</p>
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

// Enqueues exchange or completion notifications for all claimed chain-mates.
// Called fire-and-forget from completeMilestone on VM19/PM26/VM20/PM27.
// Dedup via OutboundEmailQueue unique constraint; business-hours scheduled via enqueueEmail.
export async function enqueueChainMilestoneNotifications(
  transactionId: string,
  emailType: "EXCHANGE" | "COMPLETION",
): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { propertyAddress: true, chainLinkId: true },
  });
  if (!tx?.chainLinkId) return;

  const thisLink = await prisma.chainLink.findUnique({
    where: { id: tx.chainLinkId },
    select: { chainId: true },
  });
  if (!thisLink) return;

  const mates = await prisma.chainLink.findMany({
    where: {
      chainId: thisLink.chainId,
      inviteStatus: "CLAIMED",
      transactionId: { not: null },
      id: { not: tx.chainLinkId },
    },
    select: {
      claimedByUserId: true,
      claimedBy: { select: { email: true } },
      transactionId: true,
    },
  });

  const notifiable = mates.filter((m) => m.claimedByUserId && m.claimedBy?.email);

  for (const mate of notifiable) {
    const suppressed = await isUserEmailSuppressed(mate.claimedByUserId!);
    if (suppressed) {
      console.log(`[EMAIL_SKIP] type=${emailType} userId=${mate.claimedByUserId} reason=unsubscribed`);
      continue;
    }

    const unsubscribeUrl = buildUserUnsubscribeUrl(mate.claimedByUserId!);
    const payload =
      emailType === "EXCHANGE"
        ? buildExchangeEmailPayload({
            exchangedAddress: tx.propertyAddress,
            recipientTransactionId: mate.transactionId,
            unsubscribeUrl,
          })
        : buildCompletionEmailPayload({
            completedAddress: tx.propertyAddress,
            recipientTransactionId: mate.transactionId,
            unsubscribeUrl,
          });

    await enqueueEmail({
      emailType,
      sourceId: tx.chainLinkId,
      recipientEmail: mate.claimedBy!.email!,
      recipientUserId: mate.claimedByUserId!,
      payload: { ...payload, unsubscribeUrl },
    });
  }
}

// ─── Celebration ──────────────────────────────────────────────────────────────

export function buildCelebrationEmailPayload({
  unsubscribeUrl,
}: {
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Your chain has completed`;

  const text = [
    `Every sale in your chain has completed.`,
    ``,
    `—`,
    `Unsubscribe from all Sales Progressor emails: ${unsubscribeUrl}`,
    `Need help? support@thesalesprogressor.co.uk`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 20px;line-height:1.3;">Your chain has completed</h1>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0;">Every sale in your chain has completed.</p>
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

// Checks if all claimed links in the chain have VM20 or PM27 complete, then
// enqueues one celebration email per claimed agent (guarded by celebrationSentAt).
// Called fire-and-forget from completeMilestone on VM20/PM27.
export async function maybeEnqueueCelebration(transactionId: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { chainLinkId: true },
  });
  if (!tx?.chainLinkId) return;

  const thisLink = await prisma.chainLink.findUnique({
    where: { id: tx.chainLinkId },
    select: { chainId: true },
  });
  if (!thisLink) return;

  const chainId = thisLink.chainId;

  // Guard: only send once per chain
  const chain = await prisma.propertyChain.findUnique({
    where: { id: chainId },
    select: { celebrationSentAt: true },
  });
  if (chain?.celebrationSentAt != null) return;

  // Check all claimed links have VM20 or PM27 complete
  const claimedLinks = await prisma.chainLink.findMany({
    where: { chainId, inviteStatus: "CLAIMED", transactionId: { not: null } },
    select: {
      claimedByUserId: true,
      claimedBy: { select: { email: true } },
      transaction: {
        select: {
          milestoneCompletions: {
            where: {
              state: "complete",
              milestoneDefinition: { code: { in: ["VM20", "PM27"] } },
            },
            select: { id: true },
          },
        },
      },
    },
  });

  if (claimedLinks.length === 0) return;

  const allCompleted = claimedLinks.every(
    (l) => (l.transaction?.milestoneCompletions?.length ?? 0) > 0,
  );
  if (!allCompleted) return;

  // Claim the celebrationSentAt guard atomically to prevent duplicate sends
  const updated = await prisma.propertyChain.updateMany({
    where: { id: chainId, celebrationSentAt: null },
    data: { celebrationSentAt: new Date() },
  });
  if (updated.count === 0) return; // Another concurrent call already claimed it

  // Enqueue one celebration email per claimed agent
  const notifiable = claimedLinks.filter((l) => l.claimedByUserId && l.claimedBy?.email);

  for (const link of notifiable) {
    const suppressed = await isUserEmailSuppressed(link.claimedByUserId!);
    if (suppressed) {
      console.log(`[EMAIL_SKIP] type=CELEBRATION userId=${link.claimedByUserId} reason=unsubscribed`);
      continue;
    }

    const unsubscribeUrl = buildUserUnsubscribeUrl(link.claimedByUserId!);
    const payload = buildCelebrationEmailPayload({ unsubscribeUrl });

    await enqueueEmail({
      emailType: "CELEBRATION",
      sourceId: chainId,
      recipientEmail: link.claimedBy!.email!,
      recipientUserId: link.claimedByUserId!,
      payload: { ...payload, unsubscribeUrl },
    });
  }

  console.log(`[CELEBRATION_QUEUED] chain=${chainId} recipients=${notifiable.length}`);
}

// ─── Decline notification ──────────────────────────────────────────────────────

// Sends a decline notification to the chain originator. Called synchronously from the decline page.
// No queue — fire once, no retry.
export async function fireDeclineNotification({
  chainId,
  createdByUserId,
  stubAgentEmail,
  stubAddress,
}: {
  chainId: string;
  createdByUserId: string;
  stubAgentEmail: string;
  stubAddress: string;
}): Promise<void> {
  // Fetch originator user — check suppression and get their email
  const originator = await prisma.user.findUnique({
    where: { id: createdByUserId },
    select: { email: true, emailUnsubscribedAt: true },
  });
  if (!originator?.email || originator.emailUnsubscribedAt != null) {
    console.log(`[EMAIL_SKIP] type=DECLINE userId=${createdByUserId} reason=${originator?.emailUnsubscribedAt ? "unsubscribed" : "no-email"}`);
    return;
  }

  // Per-user opt-out for chain emails (DECLINE included — it's a chain event).
  const declinePrefs = await getNotificationPrefs(createdByUserId);
  if (!declinePrefs.chainEmails) {
    console.log(`[EMAIL_SKIP] type=DECLINE userId=${createdByUserId} reason=chainEmailsOptOut`);
    return;
  }

  // Find the originator's own transaction in this chain
  const originatorLink = await prisma.chainLink.findFirst({
    where: { chainId, claimedByUserId: createdByUserId, transactionId: { not: null } },
    select: { transactionId: true },
  });

  const unsubscribeUrl = buildUserUnsubscribeUrl(createdByUserId);
  const { subject, text, html } = buildDeclineEmailPayload({
    stubAgentEmail,
    stubAddress,
    originatorTransactionId: originatorLink?.transactionId ?? null,
    unsubscribeUrl,
  });

  await sendChainEmail({ to: originator.email, subject, text, html });
  console.log(`[EMAIL_SENT] type=DECLINE to=${originator.email}`);
}
