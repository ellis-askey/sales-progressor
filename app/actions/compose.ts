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
import { resolveSenderForTransaction, sendEmail, type EmailAttachment } from "@/lib/email";
import { sanitizeChaseBodyHtml } from "@/lib/email/sanitize-signature";
import { isHtmlEmpty } from "@/lib/chase/rich-text";
import { getSignedUrl, getSignedUrlMap } from "@/lib/supabase-storage";
import { enqueueComposedEmail, listScheduledComposeEmails, cancelScheduledComposeEmail, type ScheduledComposeRow, type ComposeQueuePayload } from "@/lib/email/compose-queue";

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
}): Promise<SendResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Tenant guard: the sale must be in the caller's scope.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
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
  try {
    await sendEmail({ to, cc, bcc, subject, text, html, from, replyTo, attachments, emailType: "agent_compose" });
  } catch (e) {
    console.error("[compose] send failed", e);
    return { ok: false, error: "Couldn't send the email. Please try again." };
  }

  await prisma.outboundMessage.create({
    data: {
      transactionId: input.transactionId,
      type: "outbound",
      method: "email",
      channel: "email",
      purpose: "other",
      contactIds,
      content: `Email sent to ${to.join(", ")}${cc.length ? `\nCc: ${cc.join(", ")}` : ""}\n\nSubject: ${subject}\n\n${text}`,
      subject,
      bodyFormat: "html",
      sentEmailHtml: html,
      recipientEmail: to[0],
      recipientName,
      ccEmails,
      createdById: session.user.id,
      createdByRole: session.user.role,
      visibleToClient: false,
    },
  });

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
