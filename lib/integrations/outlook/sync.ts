// lib/integrations/outlook/sync.ts
//
// Outlook connector: reads recent messages from a connected Microsoft mailbox
// and hands them to the shared, provider-neutral match + ingest core in
// lib/integrations/mail/*. Everything below the fetch (matching a message to a
// file, de-dup, storing it, the review shape) now lives in that shared core and
// is identical across Outlook, IMAP and Gmail. This file keeps only the parts
// that are genuinely Microsoft-specific: token refresh, listing mail folders,
// and fetching messages via Graph.
//
// Scope of the read (unchanged):
//   - Inbox + folders named after a property (they contain a house number)
//   - messages received in the last 90 days

import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/token-crypto";
import { getAccessScope } from "@/lib/security/access-scope";
import { buildFolderHints, looksLikePropertyFolder } from "@/lib/integrations/mail/match";
import { runMailboxSync, logSingleIngestMessage } from "@/lib/integrations/mail/ingest";
import type { IngestMessage, SyncSummary, LoggedItem } from "@/lib/integrations/mail/types";
import {
  refreshAccessToken,
  listMailFolders,
  fetchFolderMessagesSince,
  fetchMessageById,
} from "./config";

// Re-export the shared types so existing importers of this module keep working.
export type {
  IngestMessage,
  SyncMessageInfo,
  FileRef,
  LoggedItem,
  UnmatchedItem,
  SyncSummary,
} from "@/lib/integrations/mail/types";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before actual expiry
const BACKFILL_DAYS = 90;
const PER_FOLDER_CAP = 200;
const GLOBAL_CAP = 800;

export type ConnRow = {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
};

// ─── Access token (refresh if near expiry) ────────────────────────────────────

async function getValidAccessToken(conn: ConnRow): Promise<string> {
  if (conn.tokenExpiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return decryptSecret(conn.accessToken);
  }
  const tokens = await refreshAccessToken(decryptSecret(conn.refreshToken));
  await prisma.outlookConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope || conn.scope,
    },
  });
  return tokens.access_token;
}

// ─── Public: full mailbox sync ────────────────────────────────────────────────

export async function syncOutlookMailbox(conn: ConnRow, session: Session): Promise<SyncSummary> {
  const accessToken = await getValidAccessToken(conn);
  const scope = getAccessScope(session);

  const allFolders = await listMailFolders(accessToken);
  const folderHints = await buildFolderHints(
    allFolders
      .filter((f) => f.displayName.trim().toLowerCase() !== "inbox")
      .map((f) => f.displayName),
    scope
  );
  const folders = allFolders.filter((f) => {
    const n = f.displayName.trim().toLowerCase();
    if (n === "inbox") return true;
    if (folderHints.has(n)) return true; // name maps to a file
    return looksLikePropertyFolder(f.displayName); // address-style folder (has a house number)
  });

  const sinceIso = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const messages: IngestMessage[] = [];
  for (const folder of folders) {
    if (messages.length >= GLOBAL_CAP) break;
    const remaining = GLOBAL_CAP - messages.length;
    const msgs = await fetchFolderMessagesSince(
      accessToken,
      folder,
      sinceIso,
      Math.min(PER_FOLDER_CAP, remaining)
    );
    messages.push(...msgs);
  }

  return runMailboxSync({
    messages,
    mailboxEmail: conn.email,
    scope,
    source: "outlook",
    folderHints,
    scannedFolderNames: folders.map((f) => f.displayName),
    mailboxUserId: session.user.id,
    mailboxAgencyId: session.user.agencyId ?? null,
  });
}

// ─── Public: log one message to a chosen file (from the review UI) ────────────

export async function logSingleMessageToFile(
  conn: ConnRow,
  transactionId: string,
  messageId: string
): Promise<LoggedItem> {
  const accessToken = await getValidAccessToken(conn);
  const msg = await fetchMessageById(accessToken, messageId);
  return logSingleIngestMessage(transactionId, msg, "outlook");
}
