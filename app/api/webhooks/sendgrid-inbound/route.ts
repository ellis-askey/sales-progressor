// POST /api/webhooks/sendgrid-inbound
//
// SendGrid Inbound Parse receiver for two kinds of reply, both keyed on an
// unguessable reply+<token>@<inbound domain> address (the token IS the auth):
//
//   1. PROSPECT replies — outreach emails set this Reply-To; we match the token
//      to the ProspectEmail, stamp the reply, and log a timeline activity.
//   2. FILE replies (reply-capture, lib/email/reply-capture.ts) — per-file emails
//      sent via a connected mailbox (e.g. eXp UK, whose inbox we can't reliably
//      read over IMAP) set this Reply-To; we match the token to the
//      PropertyTransaction and file the reply onto the file just like an ingested
//      inbound email, then forward it to the agent's own inbox.
//
// Setup (Ellis): SendGrid → Settings → Inbound Parse → add the host with the POST
// URL pointing here, and set that subdomain's MX record to mx.sendgrid.net.
// reply.salesprogressorapp.co.uk is already wired for (1); (2) uses whatever
// REPLY_CAPTURE_DOMAIN points at (can reuse the same host). See ELLIS_MANUAL_TODO.

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haltActiveFlows } from "@/lib/prospects/flow-ops";
import { logSingleIngestMessage } from "@/lib/integrations/mail/ingest";
import { sendEmail } from "@/lib/email";
import type { IngestMessage } from "@/lib/integrations/mail/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }

  const to = String(form.get("to") ?? "");
  const bodyText = String(form.get("text") ?? form.get("html") ?? "");
  const match = to.match(/reply\+([a-z0-9]+)@/i);
  const token = match?.[1] ?? null;
  if (!token) return NextResponse.json({ ok: true, matched: false });

  const email = await prisma.prospectEmail.findUnique({
    where: { replyToken: token },
    select: { id: true, prospectId: true },
  });
  // Not a prospect reply → try a file (reply-capture) reply before giving up.
  if (!email) return handleFileReply(token, form);

  const now = new Date();
  await prisma.prospectEmail.updateMany({ where: { id: email.id, repliedAt: null }, data: { repliedAt: now } });
  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 400);

  // A reply that asks to stop is an opt-out, not a lead. Detect the common
  // phrasings (also how the List-Unsubscribe mailto lands here) and suppress +
  // halt instead of advancing to "replied".
  const optOut = /\b(unsubscribe|opt[\s-]?out|remove me|take me off|stop (emailing|contacting)|no longer wish|do not (contact|email))\b/i.test(bodyText);
  if (optOut) {
    await prisma.prospect.updateMany({ where: { id: email.prospectId, optedOutAt: null }, data: { optedOutAt: now } }).catch(() => {});
    await haltActiveFlows(email.prospectId, "opted_out").catch(() => {});
    await prisma.prospectActivity.create({
      data: { prospectId: email.prospectId, type: "opted_out", summary: "Asked to unsubscribe (reply)", body: snippet || null },
    }).catch(() => {});
    return NextResponse.json({ ok: true, matched: true, optedOut: true });
  }

  // A reply is a strong positive — advance an early-stage prospect to "replied".
  const prospect = await prisma.prospect.findUnique({ where: { id: email.prospectId }, select: { status: true } });
  if (prospect && (prospect.status === "new" || prospect.status === "contacted")) {
    await prisma.prospect.update({ where: { id: email.prospectId }, data: { status: "replied" } }).catch(() => {});
  }

  // Stop any running outreach flow — we never chase someone who has replied.
  await haltActiveFlows(email.prospectId, "replied").catch(() => {});

  await prisma.prospectActivity.create({
    data: { prospectId: email.prospectId, type: "email_received", summary: "Reply received", body: snippet || null },
  }).catch(() => {});

  return NextResponse.json({ ok: true, matched: true });
}

// ─── File (reply-capture) replies ─────────────────────────────────────────────

// Match the token to a file and record the reply on it (same storage as an
// ingested inbound email), then forward a copy to the file's agent so it still
// reaches their own inbox. Best-effort throughout: a reply is never lost to a
// forward/log failure, and an unknown token is simply "not matched".
async function handleFileReply(token: string, form: FormData) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { replyToken: token },
    select: {
      id: true,
      propertyAddress: true,
      agentUser: { select: { email: true } },
      assignedUser: { select: { email: true } },
    },
  });
  if (!tx) return NextResponse.json({ ok: true, matched: false });

  const sender = parseAddress(String(form.get("from") ?? ""));
  if (!sender.email) return NextResponse.json({ ok: true, matched: false });
  const subject = String(form.get("subject") ?? "").trim() || "(no subject)";
  const text = String(form.get("text") ?? "");
  const html = String(form.get("html") ?? "");
  const ccRaw = String(form.get("cc") ?? "");
  const toRaw = String(form.get("to") ?? "");
  const headersRaw = String(form.get("headers") ?? "");

  const body = (text && text.trim()) || stripHtml(html);
  const messageId = headerValue(headersRaw, "Message-ID") ?? headerValue(headersRaw, "Message-Id");

  const msg: IngestMessage = {
    id: messageId ?? `reply-capture:${token}:${Date.now()}`,
    subject,
    from: sender.email,
    fromName: sender.name,
    to: toRaw ? [toRaw] : [],
    cc: ccRaw ? ccRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    receivedDateTime: new Date().toISOString(),
    bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 255),
    body,
    folder: "Inbox",
    conversationId: null,
    internetMessageId: messageId,
    inReplyTo: headerValue(headersRaw, "In-Reply-To"),
    references: headerValue(headersRaw, "References"),
    headers: {},
    attachments: [],
    outbound: false,
  };

  try {
    await logSingleIngestMessage(tx.id, msg, "reply-capture");
  } catch (err) {
    console.error(`[reply-capture] filing reply failed for tx ${tx.id}:`, err);
  }

  // Forward to the file's agent (assigned progressor first, else the client
  // agent) so the reply still lands in their own inbox. Reply-To is the original
  // sender, so the agent can reply to them directly from their email.
  const agentEmail = tx.assignedUser?.email ?? tx.agentUser?.email ?? null;
  if (agentEmail) {
    const fromLabel = sender.name ? `${sender.name} <${sender.email}>` : sender.email;
    const forwardText = `This reply came in on your sale at ${tx.propertyAddress} and has been filed on the file.\nFrom: ${fromLabel}\n\n----------\n\n${body}`;
    await sendEmail({
      to: agentEmail,
      from: "Sales Progressor <updates@thesalesprogressor.co.uk>",
      replyTo: sender.email,
      subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
      text: forwardText,
    }).catch((err) => console.error(`[reply-capture] forward failed for tx ${tx.id}:`, err));
  }

  return NextResponse.json({ ok: true, matched: true });
}

// "Name <email>" / "email" → parts. email is lowercased; name is null when absent.
function parseAddress(raw: string): { name: string | null; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || "").trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}

// First value of a header from SendGrid's raw `headers` blob, or null.
function headerValue(raw: string, name: string): string | null {
  const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : null;
}

// Minimal HTML → text, used only when a reply has no text/plain part.
function stripHtml(html: string): string {
  return (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
