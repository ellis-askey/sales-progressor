// lib/integrations/outlook/sync.ts
//
// Reads recent messages from a connected Outlook mailbox and logs the ones we
// can confidently match to a property file. Scope of the read:
//   - Inbox + the user's own folders (system folders like Junk/Deleted/Sent are skipped)
//   - messages received in the last 90 days
// Matching, in order of confidence:
//   1. the people on the email (from/to/cc) vs the people on a file (contacts + solicitors + broker)
//   2. the folder the email is filed in — a "118 Hadley Grange" folder points at that file
//   3. postcode in the subject, to break ties when one address touches several files
// A confident single match is stored as an inbound OutboundMessage row, which
// surfaces on the file's Activity tab. Scoped to the connection owner (Law 7).

import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/token-crypto";
import {
  getAccessScope,
  scopeTransactionWhere,
  type AccessScope,
} from "@/lib/security/access-scope";
import { touchLastActivity } from "@/lib/services/activity";
import {
  refreshAccessToken,
  listMailFolders,
  fetchFolderMessagesSince,
  type OutlookMessage,
} from "./config";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before actual expiry
const BACKFILL_DAYS = 90;
const PER_FOLDER_CAP = 200;
const GLOBAL_CAP = 800;

export type LoggedItem = { transactionId: string; address: string; subject: string };
export type SyncSummary = {
  checked: number; // messages read across folders
  folders: number; // folders scanned
  logged: number; // newly logged onto a file
  alreadyLogged: number; // matched but already stored (dedup)
  unmatched: number; // no confident single file
  items: LoggedItem[]; // the newly-logged emails, with the file they landed on
};

type ConnRow = {
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

// ─── Postcode helpers (disambiguation) ────────────────────────────────────────

const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;

function extractPostcodes(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(POSTCODE_RE)) {
    out.add((m[1] + m[2]).toUpperCase().replace(/\s+/g, ""));
  }
  return out;
}

// ─── Email → transaction index ────────────────────────────────────────────────

type Index = {
  emailToTx: Map<string, Set<string>>;
  txAddress: Map<string, string>;
};

async function buildIndex(emails: string[], scope: AccessScope): Promise<Index> {
  const emailToTx = new Map<string, Set<string>>();
  const txAddress = new Map<string, string>();
  if (emails.length === 0) return { emailToTx, txAddress };

  const add = (email: string | null | undefined, txId: string) => {
    if (!email) return;
    const k = email.toLowerCase();
    if (!emailToTx.has(k)) emailToTx.set(k, new Set());
    emailToTx.get(k)!.add(txId);
  };

  // Email-only, case-insensitive OR conditions. Structurally valid for the
  // Contact, SolicitorContact and BrokerContact where-inputs alike.
  const orConds: { email: { equals: string; mode: "insensitive" } }[] = emails.map((e) => ({
    email: { equals: e, mode: "insensitive" },
  }));
  const txScope = scopeTransactionWhere(scope);
  const lowerSet = new Set(emails.map((e) => e.toLowerCase()));

  const contacts = await prisma.contact.findMany({
    where: { AND: [{ OR: orConds }, { transaction: txScope }] },
    select: { email: true, propertyTransactionId: true },
  });
  for (const c of contacts) add(c.email, c.propertyTransactionId);

  const partyTx = await prisma.propertyTransaction.findMany({
    where: {
      AND: [
        txScope,
        {
          OR: [
            { vendorSolicitorContact: { OR: orConds } },
            { purchaserSolicitorContact: { OR: orConds } },
            { brokerContact: { OR: orConds } },
          ],
        },
      ],
    },
    select: {
      id: true,
      vendorSolicitorContact: { select: { email: true } },
      purchaserSolicitorContact: { select: { email: true } },
      brokerContact: { select: { email: true } },
    },
  });
  for (const t of partyTx) {
    for (const email of [
      t.vendorSolicitorContact?.email,
      t.purchaserSolicitorContact?.email,
      t.brokerContact?.email,
    ]) {
      if (email && lowerSet.has(email.toLowerCase())) add(email, t.id);
    }
  }

  const txIds = [...new Set([...emailToTx.values()].flatMap((s) => [...s]))];
  if (txIds.length) {
    const rows = await prisma.propertyTransaction.findMany({
      where: { id: { in: txIds } },
      select: { id: true, propertyAddress: true },
    });
    for (const r of rows) txAddress.set(r.id, r.propertyAddress ?? "");
  }

  return { emailToTx, txAddress };
}

// ─── Folder name → transaction (a property folder points at its file) ─────────

async function buildFolderHints(
  folderNames: string[],
  scope: AccessScope
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const txScope = scopeTransactionWhere(scope);
  for (const name of folderNames) {
    const core = name.trim();
    if (core.length < 5) continue; // too short to be a reliable address
    const rows = await prisma.propertyTransaction.findMany({
      where: { AND: [txScope, { propertyAddress: { contains: core, mode: "insensitive" } }] },
      select: { id: true },
      take: 2,
    });
    if (rows.length === 1) map.set(name.toLowerCase(), rows[0].id);
  }
  return map;
}

// ─── Match one message to a single file ───────────────────────────────────────

function matchMessage(
  msg: OutlookMessage,
  mailbox: string,
  index: Index,
  folderHints: Map<string, string>
): string | null {
  const mailboxLc = mailbox.toLowerCase();
  const participants = [msg.from, ...msg.to, ...msg.cc]
    .map((e) => e.toLowerCase())
    .filter((e) => e && e !== mailboxLc);

  const candidates = new Set<string>();
  for (const p of participants) {
    const txs = index.emailToTx.get(p);
    if (txs) for (const id of txs) candidates.add(id);
  }

  const folderTx = msg.folder ? folderHints.get(msg.folder.toLowerCase()) : undefined;

  if (candidates.size === 1) return [...candidates][0];

  if (candidates.size > 1) {
    // Prefer the file this email is filed under, if it's one of the candidates.
    if (folderTx && candidates.has(folderTx)) return folderTx;
    // Otherwise disambiguate by postcode in the subject.
    const subjectPostcodes = extractPostcodes(msg.subject);
    if (subjectPostcodes.size > 0) {
      const byPostcode = [...candidates].filter((txId) => {
        const addrPostcodes = extractPostcodes(index.txAddress.get(txId) ?? "");
        for (const pc of addrPostcodes) if (subjectPostcodes.has(pc)) return true;
        return false;
      });
      if (byPostcode.length === 1) return byPostcode[0];
    }
    return null; // still ambiguous — don't guess
  }

  // No participant match — but you filed it into a property folder, so trust that.
  if (folderTx) return folderTx;
  return null;
}

// ─── Ingest ───────────────────────────────────────────────────────────────────

async function logMessage(
  txId: string,
  msg: OutlookMessage
): Promise<{ status: "logged" | "already"; address: string }> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { agencyId: true, propertyAddress: true },
  });
  const address = tx?.propertyAddress ?? "";

  const existing = await prisma.outboundMessage.findFirst({
    where: { transactionId: txId, providerMessageId: msg.id },
    select: { id: true },
  });
  if (existing) return { status: "already", address };

  const received = new Date(msg.receivedDateTime);
  await prisma.outboundMessage.create({
    data: {
      transactionId: txId,
      agencyId: tx?.agencyId ?? null,
      type: "inbound",
      method: "email",
      contactIds: [],
      subject: msg.subject || "(no subject)",
      content: (msg.body || msg.bodyPreview || "").trim(),
      recipientName: msg.fromName,
      recipientEmail: msg.from,
      ccEmails: msg.cc.length ? msg.cc.join(", ") : null,
      providerMessageId: msg.id,
      providerWebhookData: {
        source: "outlook",
        folder: msg.folder,
        from: msg.from,
        to: msg.to,
        cc: msg.cc,
        webLink: msg.webLink,
        receivedDateTime: msg.receivedDateTime,
      },
      createdByRole: "system",
      createdAt: received,
      sentAt: received,
    },
  });
  await touchLastActivity(txId);
  return { status: "logged", address };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function syncOutlookMailbox(conn: ConnRow, session: Session): Promise<SyncSummary> {
  const accessToken = await getValidAccessToken(conn);
  const scope = getAccessScope(session);

  // Decide which folders to read: the Inbox, plus any folder whose name maps to
  // exactly one property file (your "118 Hadley Grange"-style folders). Every
  // other folder — Dev To-Do, Marketing, Archive, Sent, Deleted, system folders —
  // is skipped, because its name doesn't resolve to a file.
  const allFolders = await listMailFolders(accessToken);
  const folderHints = await buildFolderHints(
    allFolders
      .filter((f) => f.displayName.trim().toLowerCase() !== "inbox")
      .map((f) => f.displayName),
    scope
  );
  const folders = allFolders.filter((f) => {
    const n = f.displayName.trim().toLowerCase();
    return n === "inbox" || folderHints.has(n);
  });

  const sinceIso = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const messages: OutlookMessage[] = [];
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

  // Collect every distinct participant address (minus the mailbox itself).
  const mailboxLc = conn.email.toLowerCase();
  const allEmails = new Set<string>();
  for (const m of messages) {
    for (const e of [m.from, ...m.to, ...m.cc]) {
      const lc = e.toLowerCase();
      if (lc && lc !== mailboxLc) allEmails.add(lc);
    }
  }

  const index = await buildIndex([...allEmails], scope);

  const summary: SyncSummary = {
    checked: messages.length,
    folders: folders.length,
    logged: 0,
    alreadyLogged: 0,
    unmatched: 0,
    items: [],
  };

  for (const msg of messages) {
    const txId = matchMessage(msg, conn.email, index, folderHints);
    if (!txId) {
      summary.unmatched++;
      continue;
    }
    const { status, address } = await logMessage(txId, msg);
    if (status === "logged") {
      summary.logged++;
      summary.items.push({ transactionId: txId, address, subject: msg.subject || "(no subject)" });
    } else {
      summary.alreadyLogged++;
    }
  }

  return summary;
}
