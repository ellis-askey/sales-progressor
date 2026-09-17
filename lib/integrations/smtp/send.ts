// Mailbox sending, one level up from the transport: given a From address that
// belongs to a send-enabled ImapConnection, send the email through that
// mailbox's own SMTP server and file a byte-identical copy in its Sent folder.
//
// This is the send path for agents whose domain can never be SendGrid-verified
// (e.g. eXp UK — IT won't touch DNS, but Zoho app-passwords need no sign-off).
// lib/email.ts routes here when the resolved From matches a send-enabled
// connection; any failure here falls back to the SendGrid path there, so a
// client email never dies on a mailbox hiccup.
//
// Health stamping lives here too: success clears smtpFailCount/smtpLastError;
// failure increments the counter and records a user-safe reason. Escalation
// (auto-disable on repeated auth failures + telling the agent) sits on top in
// disableSendOnAuthFailure.

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/token-crypto";
import { resolveSmtpSettings } from "@/lib/integrations/imap/config";
import { appendToSentMailbox } from "@/lib/integrations/imap/client";
import { sendSmtpMessage, type SmtpMessage } from "./client";
import type { ImapConnection } from "@prisma/client";

/**
 * The send-enabled, SMTP-verified connection for a bare email address, or null.
 * This is the routing lookup: "does this From address have its own mailbox?"
 * Most recently verified wins if the same mailbox is somehow connected twice
 * (it's unique per user, but two users could in theory connect a shared inbox).
 */
export async function findSendMailboxForAddress(address: string | null | undefined): Promise<ImapConnection | null> {
  const email = address?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return prisma.imapConnection.findFirst({
    where: { email, sendEnabled: true, smtpVerifiedAt: { not: null } },
    orderBy: { smtpVerifiedAt: "desc" },
  });
}

export type MailboxSendOutcome =
  | { ok: true }
  | { ok: false; error: string; authFailure: boolean; transient: boolean };

/**
 * Send `msg` through `conn`'s own SMTP server. Never throws. On success the
 * raw message is also appended to the mailbox's Sent folder (best-effort —
 * the send already happened, so a copy failure only logs).
 */
export async function sendViaMailboxConnection(conn: ImapConnection, msg: SmtpMessage): Promise<MailboxSendOutcome> {
  const settings = resolveSmtpSettings(conn.email, {
    host: conn.smtpHost,
    port: conn.smtpHost ? conn.smtpPort : null,
    secure: conn.smtpHost ? conn.smtpSecure : null,
  });
  if (!settings) {
    return { ok: false, error: "No sending server is known for this mailbox.", authFailure: false, transient: false };
  }

  let pass: string;
  try {
    pass = decryptSecret(conn.encryptedPassword);
  } catch {
    return { ok: false, error: "This mailbox's saved app-password is unreadable. Reconnect it.", authFailure: true, transient: false };
  }

  const result = await sendSmtpMessage({ ...settings, user: conn.email, pass }, msg);

  if (result.ok) {
    await prisma.imapConnection
      .update({ where: { id: conn.id }, data: { smtpFailCount: 0, smtpLastError: null } })
      .catch(() => {});
    try {
      const copied = await appendToSentMailbox(
        { host: conn.host, port: conn.port, secure: conn.secure, user: conn.email, pass },
        result.raw
      );
      if (!copied) console.warn(`[smtp] sent ok but no Sent mailbox found for ${conn.email}`);
    } catch {
      console.warn(`[smtp] sent ok but Sent-folder copy failed for ${conn.email}`);
    }
    return { ok: true };
  }

  await prisma.imapConnection
    .update({
      where: { id: conn.id },
      data: { smtpFailCount: { increment: 1 }, smtpLastError: result.error },
    })
    .catch(() => {});
  return { ok: false, error: result.error, authFailure: result.authFailure, transient: result.transient };
}
