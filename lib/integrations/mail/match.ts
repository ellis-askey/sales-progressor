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

// ─── Address index (match an email to a file by the property it NAMES) ─────────
//
// The people-index above only links emails between known parties. But plenty of
// real emails name the property in the subject/body ("…re 26 The Copse, SG13 7TX")
// from a sender who isn't a contact yet. This index lets us match those to a file
// by ADDRESS, as a last resort — carefully (see matchByAddress).

export type AddressEntry = { txId: string; firstLine: string; postcodes: Set<string> };

// Every live file in scope, reduced to its first address line (house number +
// street) and postcode(s) — the two things an email reliably repeats.
export async function buildAddressIndex(scope: AccessScope): Promise<AddressEntry[]> {
  const txScope = { AND: [scopeTransactionWhere(scope), { status: { not: "draft" as const } }] };
  const rows = await prisma.propertyTransaction.findMany({
    where: txScope,
    select: { id: true, propertyAddress: true },
  });
  const out: AddressEntry[] = [];
  for (const r of rows) {
    const addr = (r.propertyAddress ?? "").trim();
    if (!addr) continue;
    const firstLine = addr.split(",")[0]!.trim().toLowerCase();
    // Require a house number in the first line — a street-name-only file
    // ("The Copse") is too loose to match on safely.
    if (!firstLine || !/\d/.test(firstLine)) continue;
    out.push({ txId: r.id, firstLine, postcodes: extractPostcodes(addr) });
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Does the file's first line appear in the text at a word boundary? The boundary
// is what stops "2 Evans Way" matching inside "12 Evans Way" (the digit-vs-digit
// join is not a boundary), the same house-number-substring trap the folder
// matcher guards against.
export function firstLineAppears(lowerText: string, firstLine: string): boolean {
  if (!firstLine) return false;
  return new RegExp(`\\b${escapeRegExp(firstLine)}\\b`).test(lowerText);
}

// Match an email's text to files by the property it names. HIGH-CONFIDENCE only:
//   - Strong match: a file's postcode AND its first line both appear → it's that
//     property. Returns strong matches if any.
//   - Otherwise: a first-line match with no postcode is trusted ONLY when exactly
//     one file has that first line (so "7 East Flint" with no postcode still
//     links, but never ambiguously).
// Returns the matching txIds (caller decides: one → file it, many → review).
export function matchByAddress(text: string, index: AddressEntry[]): string[] {
  if (!text || index.length === 0) return [];
  const lc = text.toLowerCase();
  const postcodes = extractPostcodes(text);
  const strong = new Set<string>();
  const firstLineHits = new Set<string>();
  for (const e of index) {
    if (!firstLineAppears(lc, e.firstLine)) continue;
    firstLineHits.add(e.txId);
    if ([...e.postcodes].some((pc) => postcodes.has(pc))) strong.add(e.txId);
  }
  if (strong.size) return [...strong];
  return firstLineHits.size === 1 ? [...firstLineHits] : [...firstLineHits];
}

// A sender that is really US, not an external party — our automated sender domain
// or the mailbox owner themselves. We never address-match these: their emails are
// already on the file (as outbound), so matching an inbox copy would duplicate.
function isOwnSender(from: string, mailboxLc: string): boolean {
  const f = (from ?? "").toLowerCase().trim();
  if (!f) return true;
  if (f === mailboxLc) return true;
  return f.endsWith("@thesalesprogressor.co.uk");
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
      select: { id: true, propertyAddress: true },
      take: 5,
    });
    // Tighten the DB `contains` prefilter: require the folder to be the address's
    // first line (before the first comma) or a start-of-address match at a word
    // boundary — so a "2 Evans Way" folder can't grab "12 Evans Way".
    const precise = rows.filter((r) => matchesAddressStart(core, r.propertyAddress ?? ""));
    if (precise.length === 1) map.set(name.toLowerCase(), precise[0].id);
  }
  return map;
}

// Does the folder name identify the START of this address (not a mid-string
// substring)? Kills the house-number-substring false match (2 vs 12).
export function matchesAddressStart(folder: string, address: string): boolean {
  const f = folder.trim().toLowerCase();
  const addr = address.trim().toLowerCase();
  if (!f || !addr) return false;
  const firstLine = addr.split(",")[0].trim();
  return firstLine === f || addr.startsWith(`${f},`) || addr.startsWith(`${f} `);
}

// ─── Match one message to a single file ───────────────────────────────────────

export function matchMessage(
  msg: IngestMessage,
  mailbox: string,
  index: Index,
  folderHints: Map<string, string>,
  addressIndex: AddressEntry[] = []
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

  // Folder is authoritative: filing an email into a property folder (e.g.
  // "8 Brambling Crescent") is a deliberate signal from the agent, so it wins
  // over participant/subject matching — even when the sender also appears on
  // another file (a solicitor acting on several sales, say).
  if (folderTx) return { txId: folderTx, candidates: candidates.length ? candidates : [folderTx] };

  // No property folder → fall back to who's on the email.
  if (candidateSet.size === 1) return { txId: candidates[0], candidates };

  if (candidateSet.size > 1) {
    // Several files share a participant and there's no folder to disambiguate —
    // try a postcode in the subject; otherwise send it to review, don't guess.
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

  // Nobody on the email matched a file. Last resort: does the email NAME a
  // property we hold? Match by address (postcode + first line), skipping our own
  // automated senders (their emails already exist on the file). One confident
  // match → file it; several → offer them for review. (Address matching.)
  if (!isOwnSender(msg.from, mailboxLc) && addressIndex.length) {
    const hits = matchByAddress(`${msg.subject}\n${msg.body}`, addressIndex);
    if (hits.length === 1) return { txId: hits[0], candidates: hits };
    if (hits.length > 1) return { txId: null, candidates: hits };
  }

  return { txId: null, candidates: [] };
}
