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
import { buildFrom } from "@/lib/email/from-name";
import { parseInboundParts } from "@/lib/email/forward-attachments";
import type { IngestMessage } from "@/lib/integrations/mail/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Shared-secret gate. SendGrid Inbound Parse doesn't sign its requests, so the
  // Parse URL carries a secret query param (?k=...) that only SendGrid knows.
  // Enforced once SENDGRID_INBOUND_SECRET is set; until then the endpoint keeps
  // working so live inbound mail isn't interrupted before the URL is configured.
  const inboundSecret = process.env.SENDGRID_INBOUND_SECRET;
  if (inboundSecret && req.nextUrl.searchParams.get("k") !== inboundSecret) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

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
  // No reply token → it may be mail to a minted address on an agency's
  // delegated inbound subdomain (sender-ladder tier 3a) — replies AND fresh
  // composes both land here.
  if (!token) return handleMintedInbound(to, form);

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

  // Attachments: file them all to the sale's Documents (unchanged), and build a
  // forward copy so the progressor's forwarded email renders faithfully —
  // inline images carry their Content-ID so signature / inline-screenshot cid:
  // references resolve instead of showing broken boxes, and real files ride
  // along too. See lib/email/forward-attachments.ts.
  const { ingest: attachments, forward: forwardAttachments } = await parseInboundParts(form);

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
    attachments,
    outbound: false,
  };

  try {
    await logSingleIngestMessage(tx.id, msg, "reply-capture");
  } catch (err) {
    console.error(`[reply-capture] filing reply failed for tx ${tx.id}:`, err);
  }

  // Forward to the file's agent (assigned progressor first, else the client
  // agent) so the reply still lands in their own inbox, reading as naturally as
  // the sender's own email: their NAME on the From, their address as Reply-To,
  // their subject + body untouched. The sending address must be a verified
  // sender of ours to deliver, so that's the only tell — flagged by one discreet
  // provenance line at the foot. Replying goes straight to the real sender.
  const agentEmail = tx.assignedUser?.email ?? tx.agentUser?.email ?? null;
  if (agentEmail) {
    const provenance = `Forwarded by Sales Progressor · filed on your sale at ${tx.propertyAddress}`;
    const forwardHtml = html && html.trim()
      ? `${html}<p style="color:#8a8a8a;font-size:12px;margin-top:16px">— ${escapeHtml(provenance)}</p>`
      : undefined;
    await sendEmail({
      to: agentEmail,
      from: buildFrom(sender.name ?? sender.email, "updates@thesalesprogressor.co.uk"),
      replyTo: sender.email,
      subject,
      text: `${body}\n\n—\n${provenance}`,
      html: forwardHtml,
      attachments: forwardAttachments.length ? forwardAttachments : undefined,
    }).catch((err) => console.error(`[reply-capture] forward failed for tx ${tx.id}:`, err));
  }

  return NextResponse.json({ ok: true, matched: true });
}

// ─── Minted-address inbound (sender-ladder tier 3a) ──────────────────────────
// Mail to {first}@progression.{agency-domain} — the per-company address the
// ladder mints on an agency's delegated inbound subdomain. Resolution:
// subdomain → VerifiedDomain → agency; local part → the progressor whose
// minted name it is (first name, or first.surname-initial) among the active
// progression companies at that agency. The reply is ALWAYS forwarded to that
// progressor's real inbox (zero-loss promise); filing onto a sale is
// best-effort by sender match — an unmatched email still reaches the human.
async function handleMintedInbound(toRaw: string, form: FormData) {
  const toAddr = parseAddress(toRaw);
  const at = toAddr.email.indexOf("@");
  if (at < 1) return NextResponse.json({ ok: true, matched: false });
  const local = toAddr.email.slice(0, at);
  const host = toAddr.email.slice(at + 1);

  const vd = await prisma.verifiedDomain.findFirst({
    where: { inboundHost: host, agencyId: { not: null } },
    select: { agencyId: true },
  });
  if (!vd?.agencyId) return NextResponse.json({ ok: true, matched: false });

  // Resolve the local part to a progressor at this agency's active companies.
  const links = await prisma.progressionBusinessClient.findMany({
    where: { agencyId: vd.agencyId, removedAt: null },
    select: { progressionBusinessId: true },
  });
  const bizIds = links.map((l) => l.progressionBusinessId);
  if (!bizIds.length) return NextResponse.json({ ok: true, matched: false });
  const members = await prisma.user.findMany({
    where: { progressionBusinessId: { in: bizIds } },
    select: { id: true, name: true, email: true, progressionBusinessId: true },
  });
  const { mintedLocalPart } = await import("@/lib/progression/sender");
  const target =
    members.find((m) => mintedLocalPart(m.name, false) === local) ??
    members.find((m) => mintedLocalPart(m.name, true) === local);
  if (!target?.email) return NextResponse.json({ ok: true, matched: false });

  const sender = parseAddress(String(form.get("from") ?? ""));
  const subject = String(form.get("subject") ?? "").trim() || "(no subject)";
  const text = String(form.get("text") ?? "");
  const html = String(form.get("html") ?? "");
  const body = (text && text.trim()) || stripHtml(html);
  // File all parts to the matched sale; carry a forward copy (inline images
  // keep their Content-ID so the forward renders faithfully).
  const { ingest: attachments, forward: forwardAttachments } = await parseInboundParts(form);

  // Best-effort filing: the sender's address → a contact on one of this
  // company's live sales at this agency. Exactly one match → file it there.
  let filedTx: string | null = null;
  if (sender.email) {
    const contacts = await prisma.contact.findMany({
      where: {
        email: { equals: sender.email, mode: "insensitive" },
        transaction: {
          agencyId: vd.agencyId,
          progressionBusinessId: target.progressionBusinessId,
          status: { in: ["draft", "active", "on_hold"] },
        },
      },
      select: { propertyTransactionId: true },
    });
    const txIds = [...new Set(contacts.map((c) => c.propertyTransactionId))];
    if (txIds.length === 1) {
      filedTx = txIds[0];
      const msg: IngestMessage = {
        id: `minted:${host}:${Date.now()}`,
        subject,
        from: sender.email,
        fromName: sender.name,
        to: [toRaw],
        cc: [],
        receivedDateTime: new Date().toISOString(),
        bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 255),
        body,
        folder: "Inbox",
        conversationId: null,
        internetMessageId: null,
        inReplyTo: null,
        references: null,
        headers: {},
        attachments,
        outbound: false,
      };
      await logSingleIngestMessage(filedTx, msg, "reply-capture").catch((err) =>
        console.error(`[minted-inbound] filing failed for tx ${filedTx}:`, err),
      );
    }
  }

  // ALWAYS forward — the zero-loss promise. Reads like the sender's own email;
  // replying goes straight to them.
  const provenance = filedTx
    ? "Forwarded by Sales Progressor · filed on the matching sale"
    : "Forwarded by Sales Progressor · sent to your progression address";
  await sendEmail({
    to: target.email,
    from: buildFrom(sender.name ?? sender.email ?? "Client", "updates@thesalesprogressor.co.uk"),
    replyTo: sender.email || undefined,
    subject,
    text: `${body}\n\n—\n${provenance}`,
    html: html && html.trim()
      ? `${html}<p style="color:#8a8a8a;font-size:12px;margin-top:16px">— ${escapeHtml(provenance)}</p>`
      : undefined,
    attachments: forwardAttachments.length ? forwardAttachments : undefined,
  }).catch((err) => console.error(`[minted-inbound] forward failed for ${toAddr.email}:`, err));

  return NextResponse.json({ ok: true, matched: true, filed: !!filedTx });
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

// Escape the handful of characters that matter inside an HTML text node.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
