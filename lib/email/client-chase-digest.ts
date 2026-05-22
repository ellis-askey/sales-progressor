// lib/email/client-chase-digest.ts
//
// B4 of the client-chase arc (Sub-arc B). Two exports:
//   1. assembleDigestPayload — pure function that turns a (transaction,
//      contact, due-milestones[]) into the { subject, text, html, unsubscribeUrl }
//      shape that OutboundEmailQueue payloads expect. Testable in isolation.
//   2. enqueueClientChaseDigest — calls (1), enqueues via A5's enqueueEmail
//      with recipientContactId set, then updates ClientChaseState for each
//      milestone in the digest (chaseCount++, lastChasedAt=now, firstChasedAt
//      if null). No real send here — drainOutboundQueue (cron at 09:00 UTC)
//      ships the queued row during business hours.
//
// NO PRODUCTION CALLERS in B4. B7's cron is the production wire-up. Until
// then this code is dormant and only exercised by scripts/verify-b4.ts.
//
// ────────────────────────────────────────────────────────────────────────────
// COPY STATUS: DRAFT — the email subject + body strings below are PLACEHOLDER.
// Real client-facing copy is reviewed in the pre-B7 batch alongside the
// confirm-page strings, the six hard-block explanatory lines, and the
// unsubscribe copy. Drafts kept calm + brief, no em-dashes, house style,
// but treat as illustrative until the batch lands. Tone-split (do-it-
// yourself vs nudge-your-solicitor) is also a copy-review concern; v1
// draft is a single neutral tone.
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outboundQueue";
import { buildContactUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { extractFirstName } from "@/lib/contacts/displayName";

export type DigestMilestone = {
  code: string;
  // milestoneDefinitionId not required for assembly (we use code for client
  // copy lookup); reserved for B5's deep-link query param if we add it.
};

export type AssembleDigestInput = {
  transaction: { id: string; propertyAddress: string };
  contact: { id: string; name: string; portalToken: string };
  milestones: DigestMilestone[];
};

export type AssembledDigest = {
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
  respondUrl: string;
};

function portalBase(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

function shortAddress(propertyAddress: string): string {
  return propertyAddress.split(",")[0]?.trim() || propertyAddress;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function assembleDigestPayload(input: AssembleDigestInput): AssembledDigest {
  const { transaction, contact, milestones } = input;
  const base = portalBase();

  // Deep-link with milestone codes as a query-param hint. B5's respond page
  // reads ClientChaseState authoritatively, not this param — the param is
  // for click-analytics + a small "you have N items" hint at page-load.
  const codes = milestones.map((m) => m.code).join(",");
  const respondUrl = `${base}/portal/${contact.portalToken}/respond?items=${encodeURIComponent(codes)}`;
  const unsubscribeUrl = buildContactUnsubscribeUrl(contact.id);

  const address = shortAddress(transaction.propertyAddress);
  const first = extractFirstName(contact.name);
  const count = milestones.length;
  const items = count === 1 ? "1 update" : `${count} updates`;

  // ─── DRAFT subject ────────────────────────────────────────────────────────
  const subject =
    count === 1
      ? `Quick update needed on ${address}`
      : `${count} quick updates on ${address}`;

  // ─── DRAFT text body ──────────────────────────────────────────────────────
  // No em-dashes (house style).
  const milestoneListText = milestones
    .map((m) => `  • ${getMilestoneCopy(m.code).label}`)
    .join("\n");

  const text = [
    `Hi ${first},`,
    ``,
    count === 1
      ? `One thing on your sale at ${address} is waiting for your update:`
      : `${count} things on your sale at ${address} are waiting for your update:`,
    ``,
    milestoneListText,
    ``,
    `Open the page below to confirm, set a date you're expecting, or leave a quick note. It'll take a minute.`,
    ``,
    `${respondUrl}`,
    ``,
    `Thanks,`,
    `Sales Progressor`,
    ``,
    `If you'd rather we stop emailing you about updates, unsubscribe here:`,
    `${unsubscribeUrl}`,
  ].join("\n");

  // ─── DRAFT HTML body ──────────────────────────────────────────────────────
  const milestoneListHtml = milestones
    .map((m) => `        <li style="margin:0 0 6px;color:#1a1d29;font-size:14px;line-height:1.5;">${escapeHtml(getMilestoneCopy(m.code).label)}</li>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <h1 style="font-size:20px;color:#1a1d29;margin:0 0 12px;line-height:1.3;">${count === 1 ? "Quick update needed" : items + " on your sale"}</h1>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 8px;">Hi ${escapeHtml(first)},</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 20px;">${count === 1 ? "One thing on your sale at" : count + " things on your sale at"} <strong>${escapeHtml(address)}</strong> ${count === 1 ? "is waiting for your update:" : "are waiting for your update:"}</p>
          <ul style="margin:0 0 24px;padding-left:20px;">
${milestoneListHtml}
          </ul>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 28px;">Open the page below to confirm, set a date you're expecting, or leave a quick note. It'll take a minute.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="border-radius:8px;background:#FF6B4A;">
              <a href="${respondUrl}" style="display:inline-block;padding:12px 24px;color:white;text-decoration:none;font-weight:500;font-size:15px;">Open the page</a>
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
</body>
</html>`;

  return { subject, text, html, unsubscribeUrl, respondUrl };
}

// ─── enqueueClientChaseDigest ───────────────────────────────────────────────
// Looks up the transaction + contact, builds the digest payload, enqueues
// via A5's enqueueEmail with recipientContactId set, then updates
// ClientChaseState for each milestone:
//   - chaseCount++
//   - lastChasedAt = now
//   - firstChasedAt set if null (the "silence clock starts here" anchor)
//
// sourceId pattern: ${transactionId}:${contactId}:${YYYY-MM-DD-UTC}
//   — one digest per (transaction, contact) per UTC day. The
//   OutboundEmailQueue unique partial-index on (emailType, sourceId,
//   recipientContactId) dedups repeat enqueues for the same day. A new
//   day means a new sourceId means a new enqueue is allowed.
//
// Returns null if the contact wasn't found (defensive — the cron would
// already have filtered, but a race between cron and contact deletion is
// possible). Otherwise returns the queued row's id.

export async function enqueueClientChaseDigest(input: {
  transactionId: string;
  contactId: string;
  milestoneCodes: string[];
}): Promise<{ enqueued: boolean; rowId: string | null }> {
  const { transactionId, contactId, milestoneCodes } = input;
  if (milestoneCodes.length === 0) {
    return { enqueued: false, rowId: null };
  }

  // Pull everything in one round-trip-ish — the assembler is pure so we
  // hand it resolved data.
  const [transaction, contact] = await Promise.all([
    prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: { id: true, propertyAddress: true },
    }),
    prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, name: true, portalToken: true, email: true, unsubscribedAt: true },
    }),
  ]);

  if (!transaction || !contact) return { enqueued: false, rowId: null };
  // Sanity: contact must have email + portalToken at THIS layer. The cron
  // is supposed to gate on these via the fail-soft helper (no_email,
  // no_portalToken kinds) before calling here, but defence-in-depth.
  if (!contact.email || !contact.portalToken) return { enqueued: false, rowId: null };
  // Don't enqueue to opted-out contacts. Drain would skip them anyway, but
  // shortest-path: don't even queue.
  if (contact.unsubscribedAt) return { enqueued: false, rowId: null };

  const payload = assembleDigestPayload({
    transaction: { id: transaction.id, propertyAddress: transaction.propertyAddress },
    contact: { id: contact.id, name: contact.name, portalToken: contact.portalToken },
    milestones: milestoneCodes.map((code) => ({ code })),
  });

  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const sourceId = `${transactionId}:${contactId}:${yyyymmdd}`;

  // Enqueue. A5's enqueueEmail handles the dedup (P2002 swallowed). If a
  // digest already exists for this (transaction, contact, day) the second
  // call no-ops silently.
  await enqueueEmail({
    emailType: "CLIENT_CHASE",
    sourceId,
    recipientEmail: contact.email,
    recipientContactId: contact.id,
    payload: {
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    },
  });

  // Look up the queue row we just created (or that already existed via
  // dedup). The unique constraint guarantees at most one.
  const row = await prisma.outboundEmailQueue.findFirst({
    where: {
      emailType: "CLIENT_CHASE",
      sourceId,
      recipientContactId: contact.id,
    },
    select: { id: true },
  });
  if (!row) return { enqueued: false, rowId: null };

  // Update ClientChaseState for each milestone in the digest. Upsert so the
  // first chase for a (transaction, contact, milestone) tuple creates the
  // row; subsequent chases bump chaseCount + lastChasedAt.
  const now = new Date();
  for (const code of milestoneCodes) {
    await prisma.clientChaseState.upsert({
      where: {
        transactionId_contactId_milestoneCode: {
          transactionId,
          contactId,
          milestoneCode: code,
        },
      },
      create: {
        transactionId,
        contactId,
        milestoneCode: code,
        chaseCount: 1,
        firstChasedAt: now,
        lastChasedAt: now,
        status: "active",
      },
      update: {
        chaseCount: { increment: 1 },
        lastChasedAt: now,
        // firstChasedAt set only on create — never overwrite
      },
    });
  }

  return { enqueued: true, rowId: row.id };
}
