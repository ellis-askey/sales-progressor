// Low-level SMTP sender built on nodemailer. Mailbox sending: the same
// app-password an ImapConnection reads with, pointed at the provider's own
// submission server, so the email genuinely leaves the agent's account — the
// route for domains that can never be SendGrid-verified (e.g. eXp UK, where IT
// won't touch DNS). Two jobs only:
//   1. verifySmtpLogin — prove the app-password can SEND (used at enable-time).
//   2. sendSmtpMessage — compose the MIME once, send those exact bytes, and
//      hand the same bytes back so the caller can append them to the mailbox's
//      Sent folder (byte-identical copy, like a mail app would).
// Server-only; the app-password is passed in decrypted and never logged.

import "server-only";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { classifySmtpError, isSmtpAuthFailure, isTransientSmtpError } from "./errors";

export type SmtpCreds = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

function makeTransport(creds: SmtpCreds) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.pass },
    logger: false, // never let nodemailer log credentials/bodies
    // Keep a send from hanging a serverless invocation forever.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

/** Prove the credentials can send. Never throws — returns a typed result. */
export async function verifySmtpLogin(
  creds: SmtpCreds
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = makeTransport(creds);
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: classifySmtpError(err) };
  } finally {
    transport.close();
  }
}

// Matches EmailAttachment in lib/email.ts: base64 content + filename + MIME type.
export type SmtpAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition?: string;
};

export type SmtpMessage = {
  // "Display <address>" — the address MUST be the mailbox's own, or the
  // provider will reject or rewrite it.
  from: string;
  to: string;
  cc?: string[];
  bcc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  // Deterministic RFC Message-ID (see buildOutboundMessageId in lib/email.ts)
  // so inbound replies match this send exactly as they do for SendGrid sends.
  messageId?: string;
  attachments?: SmtpAttachment[];
};

/** The bare address out of a "Display <address>" from-string. */
export function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

function toMailOptions(msg: SmtpMessage): Mail.Options {
  return {
    from: msg.from,
    to: msg.to,
    ...(msg.cc && msg.cc.length ? { cc: msg.cc } : {}),
    ...(msg.bcc ? { bcc: msg.bcc } : {}),
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    subject: msg.subject,
    text: msg.text,
    html: msg.html ?? msg.text.replace(/\n/g, "<br>"),
    // ALWAYS one of ours, never nodemailer's random default. The Sent-folder
    // copy this send files carries this id, and Sent-Items ingestion skips
    // anything with an @thesalesprogressor.co.uk Message-ID as app-sent —
    // that's what stops a mailbox send being logged on the file twice (once at
    // send time, once when Sent capture scans it back in).
    messageId: msg.messageId ?? `<sp-mbx-${randomUUID()}@thesalesprogressor.co.uk>`,
    ...(msg.attachments && msg.attachments.length
      ? {
          attachments: msg.attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, "base64"),
            contentType: a.type,
            ...(a.disposition ? { contentDisposition: a.disposition as "attachment" | "inline" } : {}),
          })),
        }
      : {}),
  };
}

/** Compose the full MIME message once, so send + Sent-copy share exact bytes. */
export async function buildRawMessage(msg: SmtpMessage): Promise<Buffer> {
  return new MailComposer(toMailOptions(msg)).compile().build();
}

export type SmtpSendResult =
  | { ok: true; raw: Buffer }
  | { ok: false; error: string; authFailure: boolean; transient: boolean };

/**
 * Send through the mailbox's SMTP server. Never throws — returns a typed
 * result carrying the raw MIME on success (for the Sent-folder append) and
 * failure classification on error (for health stamping + queue retry).
 */
export async function sendSmtpMessage(creds: SmtpCreds, msg: SmtpMessage): Promise<SmtpSendResult> {
  const transport = makeTransport(creds);
  try {
    const raw = await buildRawMessage(msg);
    // Explicit envelope: BCC lives only here, never in the visible headers
    // (MailComposer already omits the Bcc header from the built MIME).
    const envelopeTo = [msg.to, ...(msg.cc ?? []), ...(msg.bcc ? [msg.bcc] : [])];
    await transport.sendMail({
      envelope: { from: bareAddress(msg.from), to: envelopeTo },
      raw,
    });
    return { ok: true, raw };
  } catch (err) {
    console.error(`[smtp] send failed via ${creds.host} for ${creds.user}: ${classifySmtpError(err)}`);
    return {
      ok: false,
      error: classifySmtpError(err),
      authFailure: isSmtpAuthFailure(err),
      transient: isTransientSmtpError(err),
    };
  } finally {
    transport.close();
  }
}
