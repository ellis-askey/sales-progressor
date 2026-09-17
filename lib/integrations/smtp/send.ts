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
import { buildMailboxSendingStopped } from "@/lib/email/mailbox-sending-notices";
import type { ImapConnection } from "@prisma/client";

// The routing lookup lives in ./mailbox-lookup (light import, no transport
// chain); this module is the heavy half that actually sends.
export { findSendMailboxForAddress } from "./mailbox-lookup";

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

  let failCount = conn.smtpFailCount + 1;
  try {
    const stamped = await prisma.imapConnection.update({
      where: { id: conn.id },
      data: { smtpFailCount: { increment: 1 }, smtpLastError: result.error },
    });
    failCount = stamped.smtpFailCount;
  } catch {
    /* health stamping is best-effort */
  }

  // A revoked/removed app-password can't fix itself: after consecutive auth
  // failures, stop trying (every send would fail + fall back anyway), tell the
  // agent, and let the send path's SendGrid fallback carry their mail until
  // they reconnect. Two strikes, not one, in case a provider mislabels a
  // transient hiccup as an auth problem.
  if (result.authFailure && failCount >= AUTH_FAILURES_BEFORE_DISABLE) {
    await disableSendingAndNotify(conn).catch(() => {});
  }

  return { ok: false, error: result.error, authFailure: result.authFailure, transient: result.transient };
}

const AUTH_FAILURES_BEFORE_DISABLE = 2;

/**
 * Switch sending off for a connection whose app-password stopped working, and
 * email the owner so they know their mail now goes out from our shared address
 * (replies still reaching them) until they reconnect. The guarded updateMany
 * makes this idempotent: only the call that actually flips the switch sends
 * the notification, so the agent is never nagged twice.
 */
async function disableSendingAndNotify(conn: ImapConnection): Promise<void> {
  const flipped = await prisma.imapConnection.updateMany({
    where: { id: conn.id, sendEnabled: true },
    data: {
      sendEnabled: false,
      smtpLastError: "The app-password no longer works, so sending from this inbox is off. Reconnect it to switch sending back on.",
    },
  });
  if (flipped.count === 0) return;

  const user = await prisma.user.findUnique({ where: { id: conn.userId }, select: { email: true } });
  const to = user?.email ?? conn.email;
  // Lazy import: lib/email.ts dynamically imports this module, so a static
  // import back would be a cycle. The notification goes out from our own
  // verified address (no from override), so it can never re-enter this path.
  const { sendEmail } = await import("@/lib/email");
  const notice = buildMailboxSendingStopped(conn.email);
  await sendEmail({
    to,
    subject: notice.subject,
    text: notice.text,
    emailType: "MAILBOX_SEND_DISABLED",
  });
}
