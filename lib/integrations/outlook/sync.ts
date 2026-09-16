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
// Sent-Items capture (Phase 2) — a SEPARATE, smaller budget so a busy Sent
// folder can't starve inbound property mail. Conservative 30-day first window;
// subsequent syncs move forward from lastSentSyncAt.
const SENT_BACKFILL_DAYS = 30;
const SENT_CAP = 200;

export type ConnRow = {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
  lastSentSyncAt?: Date | null;
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

  // Sent Items (Phase 2, behind SENT_ITEMS_ENABLED). Fetched from the Graph
  // well-known "sentitems" folder (locale-independent), on its OWN budget so it
  // never eats into the inbound allowance. Incremental: from lastSentSyncAt, else
  // a 30-day first window. Each is tagged outbound so ingest files it as our side.
  const sentEnabled = process.env.SENT_ITEMS_ENABLED === "true";
  let sentScanned = false;
  if (sentEnabled) {
    const sentSinceIso = (conn.lastSentSyncAt
      ? conn.lastSentSyncAt
      : new Date(Date.now() - SENT_BACKFILL_DAYS * 24 * 60 * 60 * 1000)
    ).toISOString();
    const sentMsgs = await fetchFolderMessagesSince(
      accessToken,
      { id: "sentitems", displayName: "Sent Items", totalItemCount: 0 },
      sentSinceIso,
      SENT_CAP
    );
    for (const m of sentMsgs) messages.push({ ...m, outbound: true });
    sentScanned = true;
  }

  const summary = await runMailboxSync({
    messages,
    mailboxEmail: conn.email,
    scope,
    source: "outlook",
    folderHints,
    scannedFolderNames: [...folders.map((f) => f.displayName), ...(sentScanned ? ["Sent Items"] : [])],
    mailboxUserId: session.user.id,
    mailboxAgencyId: session.user.agencyId ?? null,
    mailboxUserRole: session.user.role ?? null,
  });

  // Move the Sent cursor forward so the next sync only fetches newer sent mail.
  if (sentScanned) {
    await prisma.outlookConnection
      .update({ where: { id: conn.id }, data: { lastSentSyncAt: new Date() } })
      .catch(() => { /* connection removed mid-sync — ignore */ });
  }

  return summary;
}

// ─── Public: log one message to a chosen file (from the review UI) ────────────

export async function logSingleMessageToFile(
  conn: ConnRow,
  transactionId: string,
  messageId: string,
  opts?: { outbound?: boolean; mailboxUserId?: string | null; mailboxUserRole?: string | null }
): Promise<LoggedItem> {
  const accessToken = await getValidAccessToken(conn);
  const msg = await fetchMessageById(accessToken, messageId);
  // When filing an ambiguous SENT email from the tray, re-tag it outbound so the
  // shared ingest files it as our side and attributes it to the agent (Phase 2).
  const tagged: IngestMessage = opts?.outbound ? { ...msg, outbound: true } : msg;
  return logSingleIngestMessage(transactionId, tagged, "outlook", {
    mailboxUserId: opts?.mailboxUserId,
    mailboxUserRole: opts?.mailboxUserRole,
  });
}
