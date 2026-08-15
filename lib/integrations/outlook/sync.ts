// lib/integrations/outlook/sync.ts
//
// Reads recent Inbox messages from a connected Outlook mailbox and logs the
// ones we can confidently match to a property file. Matching is by the people
// on the email (from/to/cc) vs the people on each file (contacts + solicitors +
// broker), disambiguated by the property postcode in the subject when one email
// address touches several files. A confident match is stored as an inbound
// OutboundMessage row, which surfaces on the file's Activity tab.
//
// Scoped to the connection owner's access scope (Law 7): a mailbox can only log
// against files its owner is allowed to see.

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
  fetchInboxMessages,
  type OutlookMessage,
} from "./config";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before actual expiry

export type SyncSummary = {
  checked: number; // messages read from the mailbox
  logged: number; // newly logged onto a file
  alreadyLogged: number; // matched but already stored (dedup)
  unmatched: number; // no confident single file
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
      // Microsoft rotates the refresh token on some responses; keep the old one if absent.
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

  // Buyer/seller/other contacts attached to a file
  const contacts = await prisma.contact.findMany({
    where: { AND: [{ OR: orConds }, { transaction: txScope }] },
    select: { email: true, propertyTransactionId: true },
  });
  for (const c of contacts) add(c.email, c.propertyTransactionId);

  // Solicitor + broker contacts, reached via the transaction's FKs
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

  // Property addresses for every candidate file (for postcode disambiguation)
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

// ─── Match one message to a single file ───────────────────────────────────────

function matchMessage(msg: OutlookMessage, mailbox: string, index: Index): string | null {
  const mailboxLc = mailbox.toLowerCase();
  const participants = [msg.from, ...msg.to, ...msg.cc]
    .map((e) => e.toLowerCase())
    .filter((e) => e && e !== mailboxLc);

  const candidates = new Set<string>();
  for (const p of participants) {
    const txs = index.emailToTx.get(p);
    if (txs) for (const id of txs) candidates.add(id);
  }

  if (candidates.size === 0) return null;
  if (candidates.size === 1) return [...candidates][0];

  // Several candidate files share a participant — disambiguate by postcode in subject.
  const subjectPostcodes = extractPostcodes(msg.subject);
  if (subjectPostcodes.size > 0) {
    const byPostcode = [...candidates].filter((txId) => {
      const addrPostcodes = extractPostcodes(index.txAddress.get(txId) ?? "");
      for (const pc of addrPostcodes) if (subjectPostcodes.has(pc)) return true;
      return false;
    });
    if (byPostcode.length === 1) return byPostcode[0];
  }

  // Still ambiguous — don't guess.
  return null;
}

// ─── Ingest ───────────────────────────────────────────────────────────────────

async function logMessage(txId: string, msg: OutlookMessage): Promise<"logged" | "already"> {
  const existing = await prisma.outboundMessage.findFirst({
    where: { transactionId: txId, providerMessageId: msg.id },
    select: { id: true },
  });
  if (existing) return "already";

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { agencyId: true },
  });

  const received = new Date(msg.receivedDateTime);
  await prisma.outboundMessage.create({
    data: {
      transactionId: txId,
      agencyId: tx?.agencyId ?? null,
      type: "inbound",
      method: "email",
      contactIds: [],
      subject: msg.subject || "(no subject)",
      content: msg.bodyPreview || "",
      recipientName: msg.fromName,
      recipientEmail: msg.from,
      ccEmails: msg.cc.length ? msg.cc.join(", ") : null,
      providerMessageId: msg.id,
      providerWebhookData: {
        source: "outlook",
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
  return "logged";
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function syncOutlookMailbox(conn: ConnRow, session: Session): Promise<SyncSummary> {
  const accessToken = await getValidAccessToken(conn);
  const messages = await fetchInboxMessages(accessToken, 25);

  // Collect every distinct participant address across the batch (minus the mailbox itself).
  const mailboxLc = conn.email.toLowerCase();
  const allEmails = new Set<string>();
  for (const m of messages) {
    for (const e of [m.from, ...m.to, ...m.cc]) {
      const lc = e.toLowerCase();
      if (lc && lc !== mailboxLc) allEmails.add(lc);
    }
  }

  const scope = getAccessScope(session);
  const index = await buildIndex([...allEmails], scope);

  const summary: SyncSummary = { checked: messages.length, logged: 0, alreadyLogged: 0, unmatched: 0 };
  for (const msg of messages) {
    const txId = matchMessage(msg, conn.email, index);
    if (!txId) {
      summary.unmatched++;
      continue;
    }
    const result = await logMessage(txId, msg);
    if (result === "logged") summary.logged++;
    else summary.alreadyLogged++;
  }

  return summary;
}
