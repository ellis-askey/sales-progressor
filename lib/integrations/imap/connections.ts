// Agent-facing IMAP connection lifecycle, scoped to one user. Every function
// takes the caller's userId and only ever touches that user's own rows (Law 7).
// The connect UI drives these via /api/integrations/imap/*. App-passwords are
// verified before storage and kept encrypted; nothing here returns a secret.

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/token-crypto";
import { resolveImapSettings } from "./config";
import { verifyImapLogin } from "./client";

// Safe-to-expose view of a connection (never the password).
export type MyImapConnection = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  host: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type MyImapStatus = { connections: MyImapConnection[] };

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

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
    },
  });
  return {
    connections: rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      provider: r.provider,
      host: r.host,
      lastSyncedAt: iso(r.lastSyncedAt),
      lastError: r.lastError,
    })),
  };
}

export type ConnectImapInput = {
  email: string;
  password: string;
  displayName?: string;
  // Optional manual server details for providers we don't recognise.
  host?: string;
  port?: number;
  secure?: boolean;
};

// Verify the credentials work, then store (or update) the connection. Idempotent
// per (user, mailbox): reconnecting the same address refreshes its password.
export async function connectImapMailbox(
  userId: string,
  input: ConnectImapInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
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

  return { ok: true, id: row.id };
}

export async function disconnectImap(userId: string, id: string): Promise<{ ok: true }> {
  // id AND userId so a user can only ever remove their own connection.
  await prisma.imapConnection.deleteMany({ where: { id, userId } });
  return { ok: true };
}
