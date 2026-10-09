// Agent-facing IMAP connection lifecycle, scoped to one user. Every function
// takes the caller's userId and only ever touches that user's own rows (Law 7).
// The connect UI drives these via /api/integrations/imap/*. App-passwords are
// verified before storage and kept encrypted; nothing here returns a secret.

import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/security/token-crypto";
import { resolveImapSettings, resolveSmtpSettings } from "./config";
import { verifyImapLogin } from "./client";
import { verifySmtpLogin } from "@/lib/integrations/smtp/client";
import { sendViaMailboxConnection } from "@/lib/integrations/smtp/send";
import { buildMailboxSendingTest } from "@/lib/email/mailbox-sending-notices";
import { isReplyCaptureEnabled } from "@/lib/email/reply-capture";

// What the send control on a connection row should truthfully be. Sending only
// ever applies to the mailbox matching the agent's SIGN-IN address (the sender
// resolver keys on it), so the UI must never offer a toggle that would do
// nothing (Law 13).
export type ConnectionSendState =
  | "sends" // sending on from this inbox → green chip + "Turn off sending"
  | "offer" // can send from this inbox, currently off → "Turn on sending"
  | "domain_covered" // this address's domain is DNS-verified, so it already sends
  | "unavailable"; // provider with no known sending server → reads only

// Where this agent's outgoing email actually comes from right now, computed
// from the same hierarchy the send path uses (verified domain > sign-in
// mailbox > our shared address). Surfaced verbatim in the card note so what
// the agent reads and what happens can never drift apart.
export type SendsFrom = { address: string; via: "domain" | "mailbox" | "platform" };

// Safe-to-expose view of a connection (never the password).
export type MyImapConnection = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  host: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  // Mailbox sending: on = emails from the app go out through this mailbox's
  // own SMTP server; available = we know the provider's sending server, so the
  // toggle can be offered at all.
  sendEnabled: boolean;
  sendAvailable: boolean;
  smtpLastError: string | null;
  sendState: ConnectionSendState;
};

export type MyImapStatus = {
  connections: MyImapConnection[];
  // The caller's sign-in address + whether its domain is SendGrid-verified —
  // the two facts the client needs to render truthful send controls.
  userEmail: string | null;
  userDomainVerified: boolean;
  sendsFrom: SendsFrom;
  // Whether reply-capture is switched on (REPLY_CAPTURE_DOMAIN set). When true and
  // the user sends via a connected mailbox, replies to their emails are captured +
  // forwarded regardless of whether we can read that inbox — so the UI can reassure
  // instead of showing a bare "reading limited" warning.
  replyCaptureOn: boolean;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

// The caller's sign-in address and whether its domain is DNS-verified for
// their agency — the facts that decide whether a mailbox may send at all.
async function senderContext(
  userId: string,
): Promise<{ email: string | null; login: string | null; agencyId: string | null; domainVerified: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, agencyId: true, preferredSenderEmail: true },
  });
  const login = user?.email?.trim().toLowerCase() || null;
  // The address we actually send from: the user's self-chosen sending address,
  // falling back to their login address when they haven't picked one (unchanged).
  const email = user?.preferredSenderEmail?.trim().toLowerCase() || login;
  const domain = email?.split("@")[1] ?? null;
  const agencyId = user?.agencyId ?? null;
  if (!email || !domain || !agencyId) return { email, login, agencyId, domainVerified: false };
  const verified = await prisma.verifiedDomain.findFirst({
    where: { agencyId, domain, status: "verified" },
    select: { id: true },
  });
  return { email, login, agencyId, domainVerified: !!verified };
}

export async function getMyImapStatus(userId: string): Promise<MyImapStatus> {
  const rows = await prisma.imapConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      provider: true,
      host: true,
      lastSyncedAt: true,
      lastError: true,
      sendEnabled: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpLastError: true,
    },
  });
  const ctx = await senderContext(userId);

  // Verified domains for the agency, so a connection whose OWN domain is
  // DNS-verified reads as "already sends via your domain" (the stronger route),
  // not as an offer to turn mailbox sending on.
  const verifiedDomainNames = ctx.agencyId
    ? new Set(
        (
          await prisma.verifiedDomain.findMany({
            where: { agencyId: ctx.agencyId, status: "verified" },
            select: { domain: true },
          })
        ).map((d) => d.domain.toLowerCase()),
      )
    : new Set<string>();

  const connections = rows.map((r) => {
    const sendAvailable = !!resolveSmtpSettings(r.email, {
      host: r.smtpHost,
      port: r.smtpHost ? r.smtpPort : null,
      secure: r.smtpHost ? r.smtpSecure : null,
    });
    const connDomain = r.email.split("@")[1]?.toLowerCase();
    const connDomainVerified = connDomain ? verifiedDomainNames.has(connDomain) : false;
    // Sending is now a free self-serve choice — ANY connected inbox we can send
    // through can be made the sending address (no "must be your sign-in" rule).
    // An enabled row always reads "sends" so "Turn off sending" stays reachable.
    const sendState: ConnectionSendState = r.sendEnabled
      ? "sends"
      : connDomainVerified
        ? "domain_covered"
        : !sendAvailable
          ? "unavailable"
          : "offer";
    return {
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      provider: r.provider,
      host: r.host,
      lastSyncedAt: iso(r.lastSyncedAt),
      lastError: r.lastError,
      sendEnabled: r.sendEnabled,
      sendAvailable,
      smtpLastError: r.smtpLastError,
      sendState,
    };
  });

  // Same hierarchy the send path uses: verified domain > sign-in mailbox >
  // our shared address. Only a SIGN-IN mailbox counts here — a stale enabled
  // row for a previous sign-in must not claim the current address sends.
  const mailboxSends = connections.some((c) => c.sendState === "sends" && !!ctx.email && c.email === ctx.email);
  const sendsFrom: SendsFrom =
    ctx.domainVerified && ctx.email
      ? { address: ctx.email, via: "domain" }
      : mailboxSends && ctx.email
        ? { address: ctx.email, via: "mailbox" }
        : { address: "updates@thesalesprogressor.co.uk", via: "platform" };

  return { connections, userEmail: ctx.email, userDomainVerified: ctx.domainVerified, sendsFrom, replyCaptureOn: isReplyCaptureEnabled() };
}

export type ConnectImapInput = {
  email: string;
  password: string;
  displayName?: string;
  // Optional manual server details for providers we don't recognise.
  host?: string;
  port?: number;
  secure?: boolean;
  // Also turn on mailbox SENDING (SMTP with the same app-password). Only
  // honoured when we can derive the provider's sending server. Inbound connect
  // never fails over a sending problem — the mailbox connects receive-only and
  // the send outcome is reported separately.
  enableSend?: boolean;
};

// Verify the credentials work, then store (or update) the connection. Idempotent
// per (user, mailbox): reconnecting the same address refreshes its password.
export async function connectImapMailbox(
  userId: string,
  input: ConnectImapInput
): Promise<{ ok: true; id: string; sendError?: string } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (!password) return { ok: false, error: "Enter your app-password." };

  const settings = resolveImapSettings(email, {
    host: input.host,
    port: input.port,
    secure: input.secure,
  });
  if (!settings) {
    return {
      ok: false,
      error: "We don't recognise that email provider. Add your mail server details (IMAP host and port).",
    };
  }

  const verify = await verifyImapLogin({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    user: email,
    pass: password,
  });
  if (!verify.ok) return { ok: false, error: verify.error };

  const encryptedPassword = encryptSecret(password);
  const data = {
    displayName: input.displayName?.trim() || null,
    provider: settings.provider,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    encryptedPassword,
    lastError: null,
  };

  const existing = await prisma.imapConnection.findUnique({
    where: { userId_email: { userId, email } },
    select: { id: true },
  });
  const row = existing
    ? await prisma.imapConnection.update({ where: { id: existing.id }, data })
    : await prisma.imapConnection.create({ data: { userId, email, ...data } });

  // Sending is opt-in and must never sink the inbound connect: the mailbox is
  // already connected receive-only by this point, whatever happens below.
  if (input.enableSend) {
    const send = await enableMailboxSending(userId, row.id);
    return { ok: true, id: row.id, sendError: send.ok ? undefined : send.error };
  }

  return { ok: true, id: row.id };
}

export async function disconnectImap(userId: string, id: string): Promise<{ ok: true }> {
  // id AND userId so a user can only ever remove their own connection.
  await prisma.imapConnection.deleteMany({ where: { id, userId } });
  return { ok: true };
}

// ─── Mailbox sending (SMTP) ──────────────────────────────────────────────────

/**
 * Turn on sending for a connection the caller owns: verify the app-password
 * against the provider's SMTP server, store the working settings, then send a
 * one-off confirmation email to the mailbox itself (best-effort) so the agent
 * sees it working in their own inbox. Never returns a secret.
 */
export async function enableMailboxSending(
  userId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const conn = await prisma.imapConnection.findFirst({ where: { id, userId } });
  if (!conn) return { ok: false, error: "We couldn't find that connection." };

  // Sending is a free self-serve choice (Law 13): any connected inbox we can send
  // through may become the user's sending address — no "must be your sign-in"
  // rule. Two things still make it pointless: this address's own domain is already
  // DNS-verified (it sends via SendGrid, the stronger route), or it's an agency's
  // approved outsourced sender (which we run on SendGrid, never via a mailbox —
  // mirrors the exclusion in lib/integrations/smtp/mailbox-lookup.ts).
  const connDomain = conn.email.split("@")[1]?.toLowerCase();
  if (connDomain) {
    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { agencyId: true } });
    if (owner?.agencyId) {
      const domainVerified = await prisma.verifiedDomain.findFirst({
        where: { agencyId: owner.agencyId, domain: connDomain, status: "verified" },
        select: { id: true },
      });
      if (domainVerified) {
        return { ok: false, error: "Your emails already send from this address through your verified domain." };
      }
    }
  }
  const approvedOutsourced = await prisma.agency.findFirst({
    where: { quoteSenderEmail: { equals: conn.email, mode: "insensitive" }, quoteSenderVerified: true },
    select: { id: true },
  });
  if (approvedOutsourced) {
    return {
      ok: false,
      error: "This is your agency's approved sending address, so we already send from it on your files. There's nothing to switch on.",
    };
  }

  const settings = resolveSmtpSettings(conn.email, {
    host: conn.smtpHost,
    port: conn.smtpHost ? conn.smtpPort : null,
    secure: conn.smtpHost ? conn.smtpSecure : null,
  });
  if (!settings) {
    return { ok: false, error: "We don't know this provider's sending server yet, so this inbox stays receive-only." };
  }

  let pass: string;
  try {
    pass = decryptSecret(conn.encryptedPassword);
  } catch {
    return { ok: false, error: "This mailbox's saved app-password is unreadable. Reconnect it and try again." };
  }

  const verify = await verifySmtpLogin({ ...settings, user: conn.email, pass });
  if (!verify.ok) return verify;

  const updated = await prisma.imapConnection.update({
    where: { id: conn.id },
    data: {
      sendEnabled: true,
      smtpHost: settings.host,
      smtpPort: settings.port,
      smtpSecure: settings.secure,
      smtpVerifiedAt: new Date(),
      smtpLastError: null,
      smtpFailCount: 0,
    },
  });

  // This inbox is now the user's single sending address: record the choice (the
  // sender resolver keys on preferredSenderEmail) and turn sending off on any
  // other mailbox, so there's exactly one sending address at a time.
  await prisma.user.update({ where: { id: userId }, data: { preferredSenderEmail: conn.email } });
  await prisma.imapConnection.updateMany({
    where: { userId, NOT: { id: conn.id } },
    data: { sendEnabled: false },
  });

  // One-off proof it works, addressed to the mailbox itself. Best-effort: the
  // enable already succeeded, and the send path stamps its own health state.
  const test = buildMailboxSendingTest();
  await sendViaMailboxConnection(updated, {
    from: updated.email,
    to: updated.email,
    subject: test.subject,
    text: test.text,
  }).catch(() => {});

  return { ok: true };
}

/** Turn sending off for a connection the caller owns. Receiving is untouched. */
export async function disableMailboxSending(userId: string, id: string): Promise<{ ok: true }> {
  const conn = await prisma.imapConnection.findFirst({ where: { id, userId }, select: { email: true } });
  await prisma.imapConnection.updateMany({
    where: { id, userId },
    data: { sendEnabled: false, smtpLastError: null, smtpFailCount: 0 },
  });
  // If this was the user's chosen sending address, clear it so they fall back to
  // their login address (today's default) rather than a now-disabled mailbox.
  if (conn) {
    await prisma.user.updateMany({
      where: { id: userId, preferredSenderEmail: { equals: conn.email, mode: "insensitive" } },
      data: { preferredSenderEmail: null },
    });
  }
  return { ok: true };
}
