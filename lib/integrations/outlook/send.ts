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
};

/**
 * Send one email through the connected mailbox via Graph. Returns ok:false on any
 * failure (the caller falls back to SendGrid). A dead sign-in flags needsReconnect
 * so the UI prompts "Reconnect" rather than silently failing.
 */
export async function sendViaOutlookGraph(
  conn: ConnRow,
  msg: OutlookSendMsg,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  const message: Record<string, unknown> = {
    subject: msg.subject,
    body: { contentType: "HTML", content: msg.html ?? msg.text },
    toRecipients: recipients([msg.to]),
    ...(msg.cc?.length ? { ccRecipients: recipients(msg.cc) } : {}),
    ...(msg.bcc ? { bccRecipients: recipients([msg.bcc]) } : {}),
    ...(msg.replyTo ? { replyTo: recipients([msg.replyTo]) } : {}),
    // Skipped by the Sent-folder re-ingest so a Graph-sent email never double-logs.
    internetMessageHeaders: [{ name: "x-tsp-sent", value: "1" }],
    ...(msg.attachments?.length
      ? {
          attachments: msg.attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.filename,
            contentType: a.type,
            contentBytes: a.content, // already base64
          })),
        }
      : {}),
  };

  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (res.status === 202) return { ok: true }; // sendMail returns 202 Accepted
    let code = String(res.status);
    try {
      const j = (await res.json()) as { error?: { code?: string } };
      if (j?.error?.code) code = j.error.code;
    } catch {
      /* ignore parse */
    }
    // A 401 means the token was rejected mid-flight — flag reconnect.
    if (res.status === 401) {
      await prisma.outlookConnection.update({ where: { id: conn.id }, data: { needsReconnect: true } }).catch(() => {});
    }
    return { ok: false, error: `graph_${code}` };
  } catch {
    return { ok: false, error: "network" };
  }
}
