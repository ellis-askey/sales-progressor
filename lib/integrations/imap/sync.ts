// IMAP connector: fetches recent mail from a connected IMAP mailbox and hands it
// to the shared, provider-neutral match + ingest core (lib/integrations/mail/*) —
// the exact same brain Outlook uses. This file owns only the IMAP-specific parts
// (decrypt the app-password, fetch), then delegates matching + storage.

import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/token-crypto";
import { getAccessScope } from "@/lib/security/access-scope";
import { runMailboxSync } from "@/lib/integrations/mail/ingest";
import type { SyncSummary } from "@/lib/integrations/mail/types";
import { fetchImapMessages } from "./client";

const BACKFILL_DAYS = 90;
const PER_FOLDER_CAP = 200;
const GLOBAL_CAP = 800;

export type ImapConnRow = {
  id: string;
  email: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  encryptedPassword: string;
};

export async function syncImapMailbox(conn: ImapConnRow, session: Session): Promise<SyncSummary> {
  const scope = getAccessScope(session);
  const pass = decryptSecret(conn.encryptedPassword);

  try {
    const { messages, scannedFolders } = await fetchImapMessages(
      { host: conn.host, port: conn.port, secure: conn.secure, user: conn.email, pass },
      { sinceDays: BACKFILL_DAYS, perFolderCap: PER_FOLDER_CAP, globalCap: GLOBAL_CAP }
    );

    const summary = await runMailboxSync({
      messages,
      mailboxEmail: conn.email,
      scope,
      source: conn.provider || "imap",
      scannedFolderNames: scannedFolders,
      mailboxUserId: session.user.id,
      mailboxAgencyId: session.user.agencyId ?? null,
    });

    await prisma.imapConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return summary;
  } catch (err) {
    // Record a short reason so the UI can nudge a reconnect, then rethrow so the
    // caller (route/cron) can decide how to surface it.
    const reason = ((err as Error)?.message ?? "sync failed").slice(0, 300);
    await prisma.imapConnection
      .update({ where: { id: conn.id }, data: { lastError: reason } })
      .catch(() => {
        /* connection removed mid-sync — ignore */
      });
    throw err;
  }
}
