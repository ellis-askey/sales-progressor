// Provider-neutral matching engine: given the people + folders on an email,
// decide which single property file it belongs to (or none). Extracted verbatim
// from lib/integrations/outlook/sync.ts (behaviour-preserving) so Outlook, IMAP
// and Gmail all match identically.
//
// Matching, in order of confidence:
//   1. the people on the email (from/to/cc) vs the people on a file
//      (contacts + both solicitors + broker)
//   2. the folder the email is filed in — a "118 Hadley Grange" folder points at that file
//   3. postcode in the subject, to break ties when one address touches several files

import { prisma } from "@/lib/prisma";
import {
  scopeTransactionWhere,
  type AccessScope,
} from "@/lib/security/access-scope";
import { extractInnerEmails } from "./forwarded";
import type { IngestMessage } from "./types";

// ─── Folder inclusion ─────────────────────────────────────────────────────────

// Folders we never scan even if they somehow contain a digit.
export const SYSTEM_FOLDERS = new Set([
  "deleted items",
  "junk email",
  "junk e-mail",
  "drafts",
  "outbox",
  "sent items",
  "conversation history",
  "sync issues",
  "rss feeds",
  "rss subscriptions",
]);

// A "property folder" is one you've named after an address — which always has a
// house number in it (e.g. "118 Hadley Grange", "8 Brambling Crescent"). Your
// admin folders (Dev To-Do, Marketing, Contractors, New Business) have none.
export function looksLikePropertyFolder(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || n === "inbox" || SYSTEM_FOLDERS.has(n)) return false;
  return /\d/.test(n);
}

// ─── Postcode helpers (disambiguation) ────────────────────────────────────────

const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;

export function extractPostcodes(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(POSTCODE_RE)) {
    out.add((m[1] + m[2]).toUpperCase().replace(/\s+/g, ""));
  }
  return out;
}

// ─── Email → transaction index ────────────────────────────────────────────────

export type Index = {
  emailToTx: Map<string, Set<string>>;
  txAddress: Map<string, string>;
};

export async function buildIndex(emails: string[], scope: AccessScope): Promise<Index> {
  const emailToTx = new Map<string, Set<string>>();
  const txAddress = new Map<string, string>();
  if (emails.length === 0) return { emailToTx, txAddress };

  const add = (email: string | null | undefined, txId: string) => {
    if (!email) return;
    const k = email.toLowerCase();
    if (!emailToTx.has(k)) emailToTx.set(k, new Set());
    emailToTx.get(k)!.add(txId);
  };

  const orConds: { email: { equals: string; mode: "insensitive" } }[] = emails.map((e) => ({
    email: { equals: e, mode: "insensitive" },
  }));
  // Only ever match emails to LIVE files — never a draft. A stray draft with the
  // same address as a real file would otherwise (a) show up as a second match and
  // make a property folder look ambiguous, switching folder-matching off, and
  // (b) risk pulling an email onto an empty stub. Drafts don't count. (Ellis, 2026-09-11)
  const txScope = { AND: [scopeTransactionWhere(scope), { status: { not: "draft" as const } }] };
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

export async function buildFolderHints(
  folderNames: string[],
  scope: AccessScope
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Only ever match emails to LIVE files — never a draft. A stray draft with the
  // same address as a real file would otherwise (a) show up as a second match and
  // make a property folder look ambiguous, switching folder-matching off, and
  // (b) risk pulling an email onto an empty stub. Drafts don't count. (Ellis, 2026-09-11)
  const txScope = { AND: [scopeTransactionWhere(scope), { status: { not: "draft" as const } }] };
  for (const name of folderNames) {
    const core = name.trim();
    if (core.length < 5) continue;
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

export function matchMessage(
  msg: IngestMessage,
  mailbox: string,
  index: Index,
  folderHints: Map<string, string>
): { txId: string | null; candidates: string[] } {
  const mailboxLc = mailbox.toLowerCase();
  const participants = [msg.from, ...msg.to, ...msg.cc]
    .map((e) => e.toLowerCase())
    .filter((e) => e && e !== mailboxLc);

  const candidateSet = new Set<string>();
  for (const p of participants) {
    const txs = index.emailToTx.get(p);
    if (txs) for (const id of txs) candidateSet.add(id);
  }
  // Forward fallback: nothing on the outer envelope matched (e.g. a forward from
  // the agent to you). Look at who's named INSIDE the forwarded/quoted text —
  // the real sender/recipients — and try those instead.
  if (candidateSet.size === 0) {
    for (const p of extractInnerEmails(msg.body)) {
      if (p === mailboxLc) continue;
      const txs = index.emailToTx.get(p);
      if (txs) for (const id of txs) candidateSet.add(id);
    }
  }
  const candidates = [...candidateSet];
  const folderTx = msg.folder ? folderHints.get(msg.folder.toLowerCase()) : undefined;

  if (candidateSet.size === 1) return { txId: candidates[0], candidates };

  if (candidateSet.size > 1) {
    if (folderTx && candidateSet.has(folderTx)) return { txId: folderTx, candidates };
    const subjectPostcodes = extractPostcodes(msg.subject);
    if (subjectPostcodes.size > 0) {
      const byPostcode = candidates.filter((txId) => {
        const addrPostcodes = extractPostcodes(index.txAddress.get(txId) ?? "");
        for (const pc of addrPostcodes) if (subjectPostcodes.has(pc)) return true;
        return false;
      });
      if (byPostcode.length === 1) return { txId: byPostcode[0], candidates };
    }
    return { txId: null, candidates }; // ambiguous — offer the candidates for review
  }

  if (folderTx) return { txId: folderTx, candidates: [folderTx] };
  return { txId: null, candidates: [] };
}
