"use server";

// Server actions for the agent email composer (critique 2026-10-05).
// Phase 1: search your sales, load a sale's recipients, and send an email now
// from your own address, logged to the file's timeline. Schedule-send (Phase 2)
// and AI refine (Phase 3) are added alongside.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { getComposeContext, splitComposeAddress, type ComposeContext } from "@/lib/services/compose-recipients";
import { resolveSenderForTransaction, sendEmail, buildOutboundMessageId, type EmailAttachment } from "@/lib/email";
import { isEmailThreadingEnabled } from "@/lib/email/threading";
import { findContinuableThread, type ContinuableThread } from "@/lib/email/thread-continue";
import { randomUUID } from "crypto";
import { storeOutboundEmailAttachments } from "@/lib/integrations/mail/outbound-attachments";
import { sanitizeChaseBodyHtml } from "@/lib/email/sanitize-signature";
import { isHtmlEmpty } from "@/lib/chase/rich-text";
import { getSignedUrl, getSignedUrlMap } from "@/lib/supabase-storage";
import { enqueueComposedEmail, listScheduledComposeEmails, cancelScheduledComposeEmail, type ScheduledComposeRow, type ComposeQueuePayload } from "@/lib/email/compose-queue";
import { agencySideKey } from "@/lib/chain/intel";

export type ComposeSaleResult = { id: string; line1: string; location: string; photoUrl: string | null };
export type ComposeContextWithPhoto = ComposeContext & { photoUrl: string | null };
export type ComposeAttachmentInput = { filename: string; contentBase64: string; type: string };
export type SendResult = { ok: true } | { ok: false; error: string };

// ── Search your sales (property picker) ─────────────────────────────────────
export async function searchComposeSales(query: string): Promise<ComposeSaleResult[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  // Match each word of the query independently (AND), so "ake" finds "Akeman"
  // and "36 n" finds "36 Akeman Lane" — order and completeness don't matter.
  // Scope is nested as its own AND element so the token clauses can never clobber
  // the tenant filter (Law 7).
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const where: Prisma.PropertyTransactionWhereInput = {
    AND: [
      scopeTransactionWhere(scope),
      { status: "active", isDemo: false },
      ...tokens.map((t): Prisma.PropertyTransactionWhereInput => ({ propertyAddress: { contains: t, mode: "insensitive" } })),
    ],
  };
  const rows = await prisma.propertyTransaction.findMany({
    where,
    select: { id: true, propertyAddress: true, photoStoragePath: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const photoMap = await getSignedUrlMap(rows.map((r) => r.photoStoragePath));
  return rows.map((r) => {
    const { line1, location } = splitComposeAddress(r.propertyAddress);
    return { id: r.id, line1, location, photoUrl: r.photoStoragePath ? photoMap.get(r.photoStoragePath) ?? null : null };
  });
}

// ── Load a sale's recipients + sender identity ──────────────────────────────
export async function getComposeContextAction(transactionId: string): Promise<ComposeContextWithPhoto | null> {
  const session = await requireSession();
  const ctx = await getComposeContext(transactionId, session);
  if (!ctx) return null;
  const photoUrl = ctx.sale.photoPath ? await getSignedUrl(ctx.sale.photoPath).catch(() => null) : null;
  return { ...ctx, photoUrl };
}

function dedupeEmails(arr: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr ?? []) {
    const e = raw.trim();
    if (!e) continue;
    const k = e.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-4])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Send now, or schedule for later ──────────────────────────────────────────
export async function sendComposedEmail(input: {
  transactionId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  attachments?: ComposeAttachmentInput[];
  // ISO timestamp — when set and in the future, the email is queued and sent at
  // that time by the hourly drain instead of now (phase 2).
  scheduledFor?: string | null;
  // Chain-email mode: per-To-recipient logging. A recipient with a real chain
  // linkId logs a check-in entry on YOUR side of that neighbour (not your file,
  // never theirs). Recipients without a linkId (a free-typed address, or the
  // estate agent on an outsourced file) fall back to a sent-email entry on your
  // own file so nothing is lost. When present, the single default file log is
  // skipped. Cc/Bcc are never logged (visibility only).
  chainRecipients?: { email: string; linkId: string | null }[];
  // Email threading (Stage 2): the Message-ID of a prior email on this sale the
  // agent chose to continue (from the "continue conversation" whisper). When set
  // and threading is on, this send threads under it. Ignored when threading is
  // off. Validated server-side (must belong to this sale).
  continueFromMessageId?: string | null;
}): Promise<SendResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Tenant guard: the sale must be in the caller's scope.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, agencyId: true },
  });
  if (!tx) return { ok: false, error: "Sale not found" };

  const to = dedupeEmails(input.to);
  const cc = dedupeEmails(input.cc);
  const bcc = dedupeEmails(input.bcc);
  const subject = input.subject.trim();
  if (!to.length) return { ok: false, error: "Add at least one recipient." };
  if (!subject) return { ok: false, error: "Add a subject." };
  if (isHtmlEmpty(input.bodyHtml)) return { ok: false, error: "Write a message before sending." };

  const scheduledAt = input.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduledAt && (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 30_000)) {
    return { ok: false, error: "Pick a send time in the future." };
  }

  const html = sanitizeChaseBodyHtml(input.bodyHtml);
  const text = htmlToText(html);

  // Stage 1 (email threading, Boardwalk-gated): stamp a stable RFC Message-ID on
  // the send and remember it on the row, so a later email can continue this
  // conversation. OFF for every agency by default → undefined here → the send +
  // the stored row are byte-for-byte unchanged (no header, null threading key).
  const outboundMessageId = isEmailThreadingEnabled(tx.agencyId)
    ? buildOutboundMessageId(`compose-${randomUUID()}`)
    : undefined;

  // The To set (lower-cased) remembered on the row so a later email to the same
  // group can be recognised. Stored only on threaded sends (empty otherwise).
  const recipientEmailsLower = outboundMessageId ? to.map((e) => e.toLowerCase()) : [];

  // Continue an existing conversation: re-derive the threading headers from the
  // chosen prior message server-side (never trust client-supplied references),
  // and only when it genuinely belongs to this sale.
  let inReplyTo: string | undefined;
  let references: string | undefined;
  let replyToConversationId: string | null | undefined;
  if (outboundMessageId && input.continueFromMessageId) {
    const parent = await prisma.outboundMessage.findFirst({
      where: { transactionId: input.transactionId, internetMessageId: input.continueFromMessageId },
      select: { internetMessageId: true, emailReferences: true, conversationId: true },
    });
    if (parent?.internetMessageId) {
      inReplyTo = parent.internetMessageId;
      references = parent.emailReferences ? `${parent.emailReferences} ${parent.internetMessageId}` : parent.internetMessageId;
      // Stage 3: if the prior email went via a connected Outlook mailbox we also
      // have its Outlook conversation — reuse it so this send threads natively.
      replyToConversationId = parent.conversationId;
    }
  }

  const { from, replyTo } = await resolveSenderForTransaction(input.transactionId, session.user);
  const attachments: EmailAttachment[] | undefined = input.attachments?.length
    ? input.attachments.map((a) => ({ content: a.contentBase64, filename: a.filename, type: a.type, disposition: "attachment" }))
    : undefined;

  // Map To addresses back to Contact ids where they match a client recipient
  // (solicitor/team ids are NOT Contact ids, so excluded), and resolve the sale
  // line for the scheduled-list label.
  const ctx = await getComposeContext(input.transactionId, session);
  const contactIds = ctx
    ? (to
        .map((e) => {
          const r = ctx.recipients.find((x) => x.email.toLowerCase() === e.toLowerCase());
          return r && (r.kind === "vendor" || r.kind === "purchaser" || r.kind === "broker") ? r.id : null;
        })
        .filter(Boolean) as string[])
    : [];
  const recipientName = ctx?.recipients.find((x) => x.email.toLowerCase() === to[0].toLowerCase())?.name ?? null;
  const ccEmails = cc.length ? cc.join(", ") : null;

  // ── Schedule: queue it; the drain sends + logs at the chosen time. ──────────
  if (scheduledAt) {
    const payload: ComposeQueuePayload = {
      transactionId: input.transactionId,
      saleLine1: ctx?.sale.line1 ?? "",
      to, cc, bcc, subject, text, html, from, replyTo,
      attachments: attachments?.map((a) => ({ content: a.content, filename: a.filename, type: a.type })),
      createdById: session.user.id,
      createdByRole: session.user.role,
      ccEmails,
      recipientName,
      contactIds,
      // Threading resolved now, so the delayed send behaves like a send-now.
      outboundMessageId,
      inReplyTo,
      references,
      recipientEmails: recipientEmailsLower,
      replyToConversationId,
    };
    try {
      await enqueueComposedEmail(payload, scheduledAt);
    } catch (e) {
      console.error("[compose] schedule failed", e);
      return { ok: false, error: "Couldn't schedule the email. Please try again." };
    }
    return { ok: true };
  }

  // ── Send now. ───────────────────────────────────────────────────────────────
  // When the send routes through a connected Outlook mailbox, sendEmail returns
  // the Outlook conversation id; we remember it so a later email threads natively
  // (Stage 3). Null on the SendGrid / SMTP routes.
  let outlookConversationId: string | null = replyToConversationId ?? null;
  // Diagnostic (test period): which route a threaded send actually took. Defaults
  // to "standard" (SendGrid / fall-back) for a threaded send; a mailbox / Outlook
  // route overrides it. Null for non-threaded sends.
  let threadSendRoute: string | null = outboundMessageId ? "standard" : null;
  try {
    const sendRes = await sendEmail({ to, cc, bcc, subject, text, html, from, replyTo, attachments, emailType: "agent_compose", messageId: outboundMessageId, inReplyTo, references, replyToConversationId });
    if (sendRes && typeof sendRes === "object") {
      if ("outlookConversationId" in sendRes) {
        outlookConversationId = (sendRes as { outlookConversationId?: string | null }).outlookConversationId ?? outlookConversationId;
      }
      const r = "sendRoute" in sendRes ? (sendRes as { sendRoute?: string | null }).sendRoute : null;
      if (r) threadSendRoute = r;
    }
  } catch (e) {
    console.error("[compose] send failed", e);
    return { ok: false, error: "Couldn't send the email. Please try again." };
  }

  // File the sent attachments onto the property (previously dropped) and keep
  // metadata to mark the email on the timeline. Best-effort — a storage hiccup
  // never fails the send, which already went out.
  const attachmentMeta = await storeOutboundEmailAttachments(
    input.transactionId,
    input.attachments,
    session.user.id,
  ).catch((e) => {
    console.error("[compose] attachment filing failed", e);
    return [];
  });
  const attachmentData = attachmentMeta.length ? { attachments: attachmentMeta } : undefined;

  if (input.chainRecipients && input.chainRecipients.length) {
    // ── Chain-email logging: per To recipient, by the rounded-system rules. ──
    const sideKey = agencySideKey(tx.agencyId);
    // Neighbour recipients (real link) → a check-in entry on YOUR side of their
    // link. Not your file, never theirs. This also freshens their check-in.
    for (const r of input.chainRecipients) {
      if (!r.linkId) continue;
      await prisma.chainLinkEntry.create({
        data: {
          chainLinkId: r.linkId,
          body: `Emailed ${r.email}\n\n${text}`,
          authorId: session.user.id,
          authorName: session.user.name ?? null,
          authorSideKey: sideKey,
          authorAgencyId: session.user.agencyId ?? null,
          authorBusinessId: session.user.progressionBusinessId ?? null,
        },
      }).catch((e) => console.error("[compose] chain check-in log failed", e));
    }
    // Non-neighbour To recipients still need a home: a sent-email entry on YOUR
    // own file (free-typed addresses / the outsourced estate agent).
    const nonNeighbour = input.chainRecipients.filter((r) => !r.linkId).map((r) => r.email);
    if (nonNeighbour.length) {
      await prisma.outboundMessage.create({
        data: {
          transactionId: input.transactionId,
          sentAt: new Date(),
          type: "outbound", method: "email", channel: "email", purpose: "other",
          contactIds,
          content: `Email sent to ${nonNeighbour.join(", ")}${cc.length ? `\nCc: ${cc.join(", ")}` : ""}\n\nSubject: ${subject}\n\n${text}`,
          subject, bodyFormat: "html", sentEmailHtml: html, sentFromEmail: from,
          recipientEmail: nonNeighbour[0], recipientName, ccEmails,
          createdById: session.user.id, createdByRole: session.user.role, visibleToClient: false,
          providerWebhookData: attachmentData,
          // Stage 1: the Message-ID we stamped on the send (Boardwalk-gated), so a
          // later email can thread to it. Null when threading is off (unchanged).
          internetMessageId: outboundMessageId ?? null,
          // Stage 2: full To set + thread linkage (this row is the send's anchor).
          recipientEmails: recipientEmailsLower,
          inReplyTo: inReplyTo ?? null,
          emailReferences: references ?? null,
          conversationId: outlookConversationId, // Stage 3 (Outlook sends only)
          threadSendRoute, // diagnostic: which route this send took
        },
      }).catch((e) => console.error("[compose] anchor log failed", e));
    } else if (outboundMessageId) {
      // Threaded chain send where EVERY recipient is a chain link (so the loop
      // above only wrote per-neighbour check-ins, no sent-email row). Threading
      // needs one anchor carrying the Message-ID + the full To set, so a later
      // chain email to this group can continue the thread. Only for threaded
      // (Boardwalk) sends — non-threaded chain sends keep the old behaviour with
      // no extra timeline row.
      await prisma.outboundMessage.create({
        data: {
          transactionId: input.transactionId,
          sentAt: new Date(),
          type: "outbound", method: "email", channel: "email", purpose: "other",
          contactIds,
          content: `Email sent to ${to.join(", ")}${cc.length ? `\nCc: ${cc.join(", ")}` : ""}\n\nSubject: ${subject}\n\n${text}`,
          subject, bodyFormat: "html", sentEmailHtml: html, sentFromEmail: from,
          recipientEmail: to[0], recipientName, ccEmails,
          createdById: session.user.id, createdByRole: session.user.role, visibleToClient: false,
          providerWebhookData: attachmentData,
          internetMessageId: outboundMessageId,
          recipientEmails: recipientEmailsLower,
          inReplyTo: inReplyTo ?? null,
          emailReferences: references ?? null,
          conversationId: outlookConversationId, // Stage 3 (Outlook sends only)
          threadSendRoute, // diagnostic: which route this send took
        },
      }).catch((e) => console.error("[compose] chain thread-anchor failed", e));
    }
  } else {
    await prisma.outboundMessage.create({
      data: {
        transactionId: input.transactionId,
        // Real send time — also the key the Sent-folder re-ingest de-dups on when
        // the mailbox provider rewrote our Message-ID (e.g. a Graph send).
        sentAt: new Date(),
        type: "outbound",
        method: "email",
        channel: "email",
        purpose: "other",
        contactIds,
        content: `Email sent to ${to.join(", ")}${cc.length ? `\nCc: ${cc.join(", ")}` : ""}\n\nSubject: ${subject}\n\n${text}`,
        subject,
        bodyFormat: "html",
        sentEmailHtml: html,
        sentFromEmail: from, // real From at send time (critique #298B)
        recipientEmail: to[0],
        recipientName,
        ccEmails,
        createdById: session.user.id,
        createdByRole: session.user.role,
        visibleToClient: false,
        providerWebhookData: attachmentData,
        // Stage 1: the Message-ID we stamped on the send (Boardwalk-gated), so a
        // later email can thread to it. Null when threading is off (unchanged).
        internetMessageId: outboundMessageId ?? null,
        // Stage 2: the full To set + thread linkage, so a later email to the same
        // group can continue this conversation. Empty/null when threading is off.
        recipientEmails: recipientEmailsLower,
        inReplyTo: inReplyTo ?? null,
        emailReferences: references ?? null,
        // Stage 3: the Outlook conversation (connected-mailbox sends only).
        conversationId: outlookConversationId,
        threadSendRoute, // diagnostic: which route this send took
      },
    });
  }

  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

// ── Scheduled list + cancel ──────────────────────────────────────────────────
export async function listScheduledComposeEmailsAction(): Promise<ScheduledComposeRow[]> {
  const session = await requireSession();
  return listScheduledComposeEmails(session.user.id);
}

export async function cancelScheduledComposeEmailAction(id: string): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const ok = await cancelScheduledComposeEmail(id, session.user.id);
  return { ok };
}

// ── Email threading (Stage 2): is there a conversation to continue? ───────────
// Given the sale + who's currently in the To line, returns the prior email the
// agent could continue (or null). Tenant-scoped; returns null when the sale
// isn't the caller's, when threading is off for the agency, or when there's no
// matching prior conversation — so the composer's whisper simply never shows.
export async function findContinuableThreadAction(transactionId: string, toEmails: string[]): Promise<ContinuableThread | null> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, agencyId: true },
  });
  if (!tx) return null;
  return findContinuableThread(transactionId, toEmails, tx.agencyId);
}
