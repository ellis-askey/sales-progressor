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
  // Per-file chain member addresses (claimed links + unclaimed stubs). Lets a
  // participant match be corroborated by the email naming this file's ONWARD /
  // related property, not only its own — so legitimate onward-purchase mail keeps
  // landing on the sale file while an unrelated deal a shared party is on stays out.
  txChainAddresses?: Map<string, string[]>;
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
  const txChainAddresses = new Map<string, string[]>();
  if (txIds.length) {
    const rows = await prisma.propertyTransaction.findMany({
      where: { id: { in: txIds } },
      select: { id: true, propertyAddress: true },
    });
    for (const r of rows) txAddress.set(r.id, r.propertyAddress ?? "");

    // Chain-aware corroboration: for each matched file, gather every property in
    // its chain (linked transactions' addresses + unclaimed stub addresses), so a
    // participant match can be confirmed by the email naming the file's onward /
    // related property, not only its own address.
    const myLinks = await prisma.chainLink.findMany({
      where: { transactionId: { in: txIds } },
      select: { transactionId: true, chainId: true },
    });
    const chainIds = [...new Set(myLinks.map((l) => l.chainId))];
    if (chainIds.length) {
      const links = await prisma.chainLink.findMany({
        where: { chainId: { in: chainIds } },
        select: { chainId: true, stubPropertyAddress: true, transaction: { select: { propertyAddress: true } } },
      });
      const byChain = new Map<string, string[]>();
      for (const l of links) {
        const addr = (l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "").trim();
        if (!addr) continue;
        if (!byChain.has(l.chainId)) byChain.set(l.chainId, []);
        byChain.get(l.chainId)!.push(addr);
      }
      for (const ml of myLinks) {
        if (ml.transactionId) txChainAddresses.set(ml.transactionId, byChain.get(ml.chainId) ?? []);
      }
    }

    // Related / onward property addresses captured on the lightweight tracker (no
    // chain required) — merged into the same per-file address list, so mail that
    // NAMES that property auto-files onto the sale file. Address match only, never
    // a shared-people guess, so it can't reintroduce the cross-file leak.
    const trackers = await prisma.onwardTracker.findMany({
      where: { transactionId: { in: txIds }, relatedPropertyAddress: { not: null } },
      select: { transactionId: true, relatedPropertyAddress: true },
    });
    for (const t of trackers) {
      const addr = (t.relatedPropertyAddress ?? "").trim();
      if (!addr) continue;
      const list = txChainAddresses.get(t.transactionId) ?? [];
      list.push(addr);
      txChainAddresses.set(t.transactionId, list);
    }
  }

  return { emailToTx, txAddress, txChainAddresses };
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

// Does the email text actually NAME this file's property — its street first line
// (which carries a house number) or its postcode? A participant match is trusted
// only when this holds, so a party shared across deals (a solicitor acting on this
// sale AND an unrelated one) can't drag their unrelated mail onto the wrong file.
export function mentionsFile(text: string, address: string | undefined | null): boolean {
  const addr = (address ?? "").trim();
  if (!addr) return false;
  const lc = text.toLowerCase();
  const firstLine = addr.split(",")[0]!.trim().toLowerCase();
  if (firstLine && /\d/.test(firstLine) && firstLineAppears(lc, firstLine)) return true;
  const filePcs = extractPostcodes(addr);
  const textPcs = extractPostcodes(text);
  for (const pc of filePcs) if (textPcs.has(pc)) return true;
  return false;
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

  // No property folder → fall back to who's on the email. A participant match is
  // trusted ONLY when the email actually names that property (its street or
  // postcode). Without this, a party who acts on several deals — a solicitor on
  // this sale and an unrelated one — drags their unrelated mail onto this file
  // (the 2026-09 cross-file leak: a shared vendor solicitor pulled a whole
  // unrelated commercial-lease thread onto a residential sale, because he was the
  // file's registered solicitor). Filing into a property folder is a deliberate
  // human signal and already returned above, so it stays exempt from this check.
  if (candidateSet.size >= 1) {
    const text = `${msg.subject}\n${msg.body}`;
    const named = candidates.filter(
      (txId) =>
        mentionsFile(text, index.txAddress.get(txId)) ||
        (index.txChainAddresses?.get(txId) ?? []).some((a) => mentionsFile(text, a)),
    );
    if (named.length === 1) return { txId: named[0], candidates };
    if (named.length > 1) {
      // More than one candidate file is named — disambiguate by a subject
      // postcode, else send to review rather than guess.
      const subjectPostcodes = extractPostcodes(msg.subject);
      if (subjectPostcodes.size > 0) {
        const byPostcode = named.filter((txId) => {
          const addrPostcodes = extractPostcodes(index.txAddress.get(txId) ?? "");
          for (const pc of addrPostcodes) if (subjectPostcodes.has(pc)) return true;
          return false;
        });
        if (byPostcode.length === 1) return { txId: byPostcode[0], candidates };
      }
      return { txId: null, candidates };
    }
    // A party matched but the email names none of their files → don't silently
    // file it (this was the cross-file leak). Offer the candidates for review.
    return { txId: null, candidates };
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
