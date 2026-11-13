// lib/integrations/outlook/send.ts
//
// Outgoing send through a connected Microsoft mailbox (Microsoft Graph). The
// counterpart to the read sync: when an agent has connected their Outlook, their
// drawer emails go out as THEM via Graph's /me/sendMail, so a copy lands in their
// Outlook Sent Items (instead of going out via SendGrid, which never touches
// their mailbox). Flag-gated and routed from lib/email.ts; on ANY failure the
// caller falls back to SendGrid, so a send never dies on a Graph hiccup.
//
// De-dup: every Graph send is stamped x-tsp-sent, which the Sent-folder re-ingest
// skips (lib/integrations/mail/ingest.ts) — so a send logged at send time is
// never logged a second time when the Sent sync reads it back.

import "server-only";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, type ConnRow } from "./sync";
import { OutlookAuthError } from "./config";

/**
 * A healthy Outlook connection that can send AS `address`. Graph's /me/sendMail
 * always sends as the authenticated mailbox, so the connection's own email must
 * equal the From. Requires the Mail.Send scope and a live sign-in.
 */
export async function findOutlookSendConnection(address: string): Promise<ConnRow | null> {
  const email = address.trim().toLowerCase();
  if (!email.includes("@")) return null;
  return prisma.outlookConnection.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      needsReconnect: false,
      scope: { contains: "Mail.Send" },
    },
    select: { id: true, email: true, accessToken: true, refreshToken: true, tokenExpiresAt: true, scope: true },
  });
}

const bareAddr = (s: string): string => {
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
};
const recipients = (addrs: string[]) => addrs.filter(Boolean).map((a) => ({ emailAddress: { address: bareAddr(a) } }));

export type OutlookSendMsg = {
  from: string;
  to: string;
  cc?: string[];
  bcc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { content: string; filename: string; type: string }[];
  // Email threading (Stage 3): the Outlook conversation to continue. When set and
  // a message in it is found, we send as a native reply so it threads inside the
  // recipient's (and our own) Outlook. Graph rewrites the RFC Message-ID and
  // ignores In-Reply-To/References, so the conversation is the only reliable key.
  replyToConversationId?: string | null;
  // Use the draft+send path so we can read back the conversation id (for a future
  // continue). Only set on threading-enabled sends — everything else keeps the
  // original one-shot /me/sendMail, so existing Outlook sends are unchanged.
  captureConversation?: boolean;
};

// The Graph ids captured on a successful send, so a later email can continue the
// same Outlook conversation. conversationId is stable across the thread. route is
// the diagnostic label for which Outlook path was used.
export type OutlookSendResult =
  | { ok: true; conversationId?: string | null; route?: "outlook_reply" | "outlook_new" }
  | { ok: false; error: string };

const GRAPH = "https://graph.microsoft.com/v1.0";
const TSP_HEADER = [{ name: "x-tsp-sent", value: "1" }];

function graphAttachments(msg: OutlookSendMsg): Record<string, unknown>[] | undefined {
  if (!msg.attachments?.length) return undefined;
  return msg.attachments.map((a) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: a.filename,
    contentType: a.type,
    contentBytes: a.content, // already base64
  }));
}

async function graphCode(res: Response): Promise<string> {
  let code = String(res.status);
  try {
    const j = (await res.json()) as { error?: { code?: string } };
    if (j?.error?.code) code = j.error.code;
  } catch { /* ignore parse */ }
  return code;
}

/**
 * Send one email through the connected mailbox via Graph. Returns ok:false on any
 * failure (the caller falls back to SendGrid). A dead sign-in flags needsReconnect
 * so the UI prompts "Reconnect" rather than silently failing.
 *
 * Mechanism (Stage 3): create a draft → (optionally make it a native reply into
 * an existing conversation) → send it. The draft step is what lets us read back
 * the conversationId, which a later email reuses to thread. On a reply we find a
 * message in that conversation, createReplyAll, then overwrite its recipients /
 * subject / body with ours so the content is exactly what the agent wrote.
 */
export async function sendViaOutlookGraph(
  conn: ConnRow,
  msg: OutlookSendMsg,
): Promise<OutlookSendResult> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(conn);
  } catch (err) {
    if (err instanceof OutlookAuthError) {
      await prisma.outlookConnection.update({ where: { id: conn.id }, data: { needsReconnect: true } }).catch(() => {});
      return { ok: false, error: "needs_reconnect" };
    }
    return { ok: false, error: "token" };
  }

  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const body = { contentType: "HTML", content: msg.html ?? msg.text };
  const toR = recipients([msg.to]);
  const ccR = msg.cc?.length ? recipients(msg.cc) : [];
  const bccR = msg.bcc ? recipients([msg.bcc]) : [];
  const attachments = graphAttachments(msg);

  const flagReconnectOn401 = async (status: number) => {
    if (status === 401) {
      await prisma.outlookConnection.update({ where: { id: conn.id }, data: { needsReconnect: true } }).catch(() => {});
    }
  };

  // Fast path (unchanged): a plain, non-threaded send goes out via one-shot
  // /me/sendMail exactly as before. Only threading-enabled sends use the
  // draft+send path below (which reads back the conversation id).
  if (!msg.replyToConversationId && !msg.captureConversation) {
    const message: Record<string, unknown> = {
      subject: msg.subject,
      body,
      toRecipients: toR,
      ...(ccR.length ? { ccRecipients: ccR } : {}),
      ...(bccR.length ? { bccRecipients: bccR } : {}),
      ...(msg.replyTo ? { replyTo: recipients([msg.replyTo]) } : {}),
      internetMessageHeaders: TSP_HEADER,
      ...(attachments ? { attachments } : {}),
    };
    try {
      const res = await fetch(`${GRAPH}/me/sendMail`, { method: "POST", headers, body: JSON.stringify({ message, saveToSentItems: true }) });
      if (res.status === 202) return { ok: true };
      await flagReconnectOn401(res.status);
      return { ok: false, error: `graph_${await graphCode(res)}` };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  try {
    let draftId: string;
    let conversationId: string | null | undefined;
    let route: "outlook_reply" | "outlook_new" = "outlook_new";

    if (msg.replyToConversationId) {
      // Find any message in the conversation to reply into. Any one works as the
      // reply anchor (createReplyAll keeps the conversation); no $orderby, which
      // Graph can reject when combined with a $filter.
      const look = await fetch(
        `${GRAPH}/me/messages?$filter=${encodeURIComponent(`conversationId eq '${msg.replyToConversationId}'`)}&$select=id&$top=1`,
        { headers },
      );
      const anchorId: string | undefined = look.ok ? (await look.json())?.value?.[0]?.id : undefined;
      if (anchorId) {
        // Native reply-all draft, then overwrite with our recipients + content.
        const reply = await fetch(`${GRAPH}/me/messages/${anchorId}/createReplyAll`, { method: "POST", headers, body: "{}" });
        if (!reply.ok) { await flagReconnectOn401(reply.status); return { ok: false, error: `graph_${await graphCode(reply)}` }; }
        const draft = await reply.json();
        draftId = draft.id;
        conversationId = draft.conversationId ?? msg.replyToConversationId;
        const patch = await fetch(`${GRAPH}/me/messages/${draftId}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ toRecipients: toR, ccRecipients: ccR, bccRecipients: bccR, subject: msg.subject, body, internetMessageHeaders: TSP_HEADER }),
        });
        if (!patch.ok) return { ok: false, error: `graph_${await graphCode(patch)}` };
        if (attachments) {
          for (const a of attachments) {
            await fetch(`${GRAPH}/me/messages/${draftId}/attachments`, { method: "POST", headers, body: JSON.stringify(a) }).catch(() => {});
          }
        }
        route = "outlook_reply";
      } else {
        // Couldn't locate the conversation (e.g. moved/deleted) — fall through to
        // a fresh draft so the email still goes out, just not threaded.
        draftId = "";
        conversationId = undefined;
      }
    } else {
      draftId = "";
    }

    if (!draftId) {
      // Fresh draft (new conversation, or reply-anchor not found).
      const message: Record<string, unknown> = {
        subject: msg.subject,
        body,
        toRecipients: toR,
        ...(ccR.length ? { ccRecipients: ccR } : {}),
        ...(bccR.length ? { bccRecipients: bccR } : {}),
        ...(msg.replyTo ? { replyTo: recipients([msg.replyTo]) } : {}),
        internetMessageHeaders: TSP_HEADER,
        ...(attachments ? { attachments } : {}),
      };
      const create = await fetch(`${GRAPH}/me/messages`, { method: "POST", headers, body: JSON.stringify(message) });
      if (!create.ok) { await flagReconnectOn401(create.status); return { ok: false, error: `graph_${await graphCode(create)}` }; }
      const draft = await create.json();
      draftId = draft.id;
      conversationId = draft.conversationId;
    }

    const send = await fetch(`${GRAPH}/me/messages/${draftId}/send`, { method: "POST", headers });
    if (send.status === 202 || send.ok) return { ok: true, conversationId, route };
    await flagReconnectOn401(send.status);
    return { ok: false, error: `graph_${await graphCode(send)}` };
  } catch {
    return { ok: false, error: "network" };
  }
}
