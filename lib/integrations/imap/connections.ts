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

// What the send control on a connection row should truthfully be. Sending only
// ever applies to the mailbox matching the agent's SIGN-IN address (the sender
// resolver keys on it), so the UI must never offer a toggle that would do
// nothing (Law 13).
export type ConnectionSendState =
  | "sends" // sign-in mailbox, sending on → green chip + "Turn off sending"
  | "offer" // sign-in mailbox, can send, currently off → "Turn on sending"
  | "domain_covered" // sign-in mailbox but a DNS-verified domain already sends
  | "not_sign_in" // a secondary inbox → reads only, with the explainer line
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
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

// The caller's sign-in address and whether its domain is DNS-verified for
// their agency — the facts that decide whether a mailbox may send at all.
async function senderContext(userId: string): Promise<{ email: string | null; domainVerified: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, agencyId: true },
  });
  const email = user?.email?.trim().toLowerCase() || null;
  const domain = email?.split("@")[1] ?? null;
  if (!email || !domain || !user?.agencyId) return { email, domainVerified: false };
  const verified = await prisma.verifiedDomain.findFirst({
    where: { agencyId: user.agencyId, domain, status: "verified" },
    select: { id: true },
  });
  return { email, domainVerified: !!verified };
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

  const connections = rows.map((r) => {
    const sendAvailable = !!resolveSmtpSettings(r.email, {
      host: r.smtpHost,
      port: r.smtpHost ? r.smtpPort : null,
      secure: r.smtpHost ? r.smtpSecure : null,
    });
    const isSignIn = !!ctx.email && r.email === ctx.email;
    const sendState: ConnectionSendState = !isSignIn
      ? "not_sign_in"
      : ctx.domainVerified
        ? "domain_covered"
        : !sendAvailable
          ? "unavailable"
          : r.sendEnabled
            ? "sends"
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
  // our shared address.
  const mailboxSends = connections.some((c) => c.sendState === "sends");
  const sendsFrom: SendsFrom =
    ctx.domainVerified && ctx.email
      ? { address: ctx.email, via: "domain" }
      : mailboxSends && ctx.email
        ? { address: ctx.email, via: "mailbox" }
        : { address: "updates@thesalesprogressor.co.uk", via: "platform" };

  return { connections, userEmail: ctx.email, userDomainVerified: ctx.domainVerified, sendsFrom };
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

  // Truth guards, mirrored in the UI (Law 13): sending only ever applies to
  // the sign-in mailbox, and a DNS-verified domain already outranks it.
  const ctx = await senderContext(userId);
  if (!ctx.email || conn.email !== ctx.email) {
    return {
      ok: false,
      error: `Your emails send from your sign-in address${ctx.email ? ` (${ctx.email})` : ""}. To send from this inbox instead, it needs to become your sign-in email. Contact us and we'll switch it.`,
    };
  }
  if (ctx.domainVerified) {
    return { ok: false, error: "Your emails already send from this address through your verified domain." };
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

  // One-off proof it works, addressed to the mailbox itself. Best-effort: the
  // enable already succeeded, and the send path stamps its own health state.
  await sendViaMailboxConnection(updated, {
    from: updated.email,
    to: updated.email,
    subject: "Sending is set up",
    text:
      "Emails you send from Sales Progressor on your files will now come from this address. " +
      "A copy of each one is filed in this mailbox's Sent folder, and replies land straight back here. " +
      "This is a one-off confirmation that sending works. There's nothing you need to do.",
  }).catch(() => {});

  return { ok: true };
}

/** Turn sending off for a connection the caller owns. Receiving is untouched. */
export async function disableMailboxSending(userId: string, id: string): Promise<{ ok: true }> {
  await prisma.imapConnection.updateMany({
    where: { id, userId },
    data: { sendEnabled: false, smtpLastError: null, smtpFailCount: 0 },
  });
  return { ok: true };
}
