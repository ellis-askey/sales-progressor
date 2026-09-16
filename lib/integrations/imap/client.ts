// Low-level IMAP reader built on imapflow + mailparser. Two jobs only:
//   1. verifyImapLogin — prove a host/user/app-password works (used at connect).
//   2. fetchImapMessages — pull recent INBOX + property-folder mail, newest-first,
//      mapped into the provider-neutral IngestMessage the shared engine consumes.
// Passive/read-only: we never send, flag, move or delete anything. Server-only;
// the app-password is passed in decrypted and never logged.

import "server-only";
import { ImapFlow, type ListResponse } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import { looksLikePropertyFolder } from "@/lib/integrations/mail/match";
import { findSentMailbox } from "./sent-mailbox";
import type { IngestMessage } from "@/lib/integrations/mail/types";

export type ImapCreds = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

function makeClient(creds: ImapCreds): ImapFlow {
  return new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.pass },
    logger: false, // never let imapflow log credentials/bodies
    // Keep a mailbox sync from hanging a serverless invocation forever.
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

// Turn an IMAP/auth error into a short, user-safe reason. imapflow marks auth
// failures with `authenticationFailed` and carries the server's response text, so
// we lead with those (a bare `.message` is often just "Command failed").
function classifyImapError(err: unknown): string {
  const e = err as { message?: string; authenticationFailed?: boolean; response?: string; responseText?: string };
  const text = `${e?.message ?? ""} ${e?.response ?? ""} ${e?.responseText ?? ""}`.toLowerCase();

  if (
    e?.authenticationFailed ||
    text.includes("invalid credentials") ||
    text.includes("authenticationfailed") ||
    text.includes("application-specific password") ||
    text.includes("app password") ||
    text.includes("login failed") ||
    text.includes("auth")
  )
    return "We couldn't sign in. Check the address and that you used an app-password, not your normal password.";
  if (text.includes("timeout") || text.includes("timed out")) return "The mail server didn't respond. Check the server details and try again.";
  if (text.includes("enotfound") || text.includes("getaddrinfo") || text.includes("econnrefused"))
    return "We couldn't reach that mail server. Check the server address and port.";
  if (text.includes("certificate") || text.includes("tls") || text.includes("ssl")) return "Secure connection to the mail server failed.";
  return "We couldn't connect to that mailbox. Please check the details and try again.";
}

/** Prove the credentials work. Never throws — returns a typed result. */
export async function verifyImapLogin(
  creds: ImapCreds
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = makeClient(creds);
  try {
    await client.connect();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: classifyImapError(err) };
  } finally {
    try {
      client.close();
    } catch {
      /* already down */
    }
  }
}

// ─── Mapping ────────────────────────────────────────────────────────────────

function addrList(a: AddressObject | AddressObject[] | undefined): string[] {
  if (!a) return [];
  const objs = Array.isArray(a) ? a : [a];
  const out: string[] = [];
  for (const o of objs) for (const v of o.value ?? []) if (v.address) out.push(v.address);
  return out;
}

// Strip HTML to readable text as a fallback when a message has no text/plain part.
function htmlToText(html: string | false | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// A folder's display name: INBOX shows as "Inbox"; nested folders as their leaf.
function displayFolder(path: string): string {
  if (/^inbox$/i.test(path)) return "Inbox";
  const leaf = path.split("/").pop() ?? path;
  return leaf;
}

async function mapMessage(
  source: Buffer,
  folderPath: string,
  uid: number,
  internalDate: Date | undefined,
  outbound = false
): Promise<IngestMessage> {
  const parsed = await simpleParser(source);
  const from = parsed.from?.value?.[0];
  const body = (parsed.text && parsed.text.trim()) || htmlToText(parsed.html) || "";
  const messageId = parsed.messageId || `imap:${folderPath}:${uid}`;
  const received = parsed.date ?? internalDate ?? new Date(0);
  const references = Array.isArray(parsed.references)
    ? parsed.references.join(" ")
    : parsed.references ?? null;

  return {
    id: messageId,
    subject: parsed.subject ?? "",
    from: from?.address ?? "",
    fromName: from?.name || null,
    to: addrList(parsed.to),
    cc: addrList(parsed.cc),
    receivedDateTime: received.toISOString(),
    bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 255),
    body,
    folder: displayFolder(folderPath),
    webLink: null,
    conversationId: null,
    internetMessageId: parsed.messageId ?? null,
    inReplyTo: parsed.inReplyTo ?? null,
    references,
    headers: pickAutoReplyHeaders(parsed.headers),
    // Attachments are already parsed out of the same RFC822 source — no extra
    // fetch needed. mailparser marks body images with `related`/inline
    // disposition; we pass that through so the ingest core can skip them (F1).
    attachments: (parsed.attachments ?? []).map((a) => ({
      filename: a.filename ?? "attachment",
      contentType: a.contentType ?? "application/octet-stream",
      content: a.content as Buffer,
      size: a.size ?? (a.content as Buffer)?.length ?? 0,
      isInline: a.related === true || a.contentDisposition === "inline",
      cid: a.contentId ?? a.cid ?? null,
    })),
    // Sent-folder messages are our side (Phase 2). Received mail leaves this false.
    outbound,
  };
}

// The auto-reply-relevant headers (lowercased) from mailparser's header Map,
// for detectAutoReply. mailparser lowercases header keys already.
function pickAutoReplyHeaders(headers: { get(key: string): unknown } | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const key of ["auto-submitted", "x-autoreply", "x-auto-response-suppress", "precedence"]) {
    const v = headers.get(key);
    if (v == null) continue;
    out[key] = String(typeof v === "object" ? ((v as { value?: unknown }).value ?? v) : v);
  }
  return out;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

// Which mailboxes to scan: INBOX plus any address-style folder (has a house
// number), skipping special-use folders (Sent/Trash/Junk/Drafts/All/etc.).
function chooseMailboxes(boxes: ListResponse[]): string[] {
  const paths: string[] = [];
  let hasInbox = false;
  for (const b of boxes) {
    if (/^inbox$/i.test(b.path)) {
      hasInbox = true;
      continue;
    }
    if (b.specialUse) continue; // \Sent \Drafts \Trash \Junk \All \Important \Flagged
    const leaf = b.path.split("/").pop() ?? b.path;
    if (looksLikePropertyFolder(leaf)) paths.push(b.path);
  }
  return hasInbox ? ["INBOX", ...paths] : paths;
}

export type ImapFetchResult = { messages: IngestMessage[]; scannedFolders: string[] };

export async function fetchImapMessages(
  creds: ImapCreds,
  opts: {
    sinceDays: number;
    perFolderCap: number;
    globalCap: number;
    // Sent-Items capture (Phase 2). When provided, ALSO scan the Sent mailbox on
    // its OWN bounded budget (from `sentSince`, capped at `sentCap`), tagging
    // those messages outbound. Omitted → inbound-only (today's behaviour).
    sent?: { sentSince: Date; sentCap: number };
  }
): Promise<ImapFetchResult> {
  const client = makeClient(creds);
  const messages: IngestMessage[] = [];
  const scannedFolders: string[] = [];
  try {
    await client.connect();
    const since = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000);
    const boxes = await client.list();
    const targets = chooseMailboxes(boxes);

    for (const path of targets) {
      if (messages.length >= opts.globalCap) break;
      const lock = await client.getMailboxLock(path);
      try {
        const found = (await client.search({ since }, { uid: true })) || [];
        const uids = Array.isArray(found) ? found : [];
        if (uids.length) {
          // Newest-first, bounded per folder and overall.
          const room = Math.min(opts.perFolderCap, opts.globalCap - messages.length);
          const chosen = uids.slice(-room);
          for await (const msg of client.fetch(
            chosen,
            { uid: true, source: true, internalDate: true },
            { uid: true }
          )) {
            if (!msg.source) continue;
            const internal = msg.internalDate ? new Date(msg.internalDate) : undefined;
            messages.push(await mapMessage(msg.source, path, msg.uid, internal));
            if (messages.length >= opts.globalCap) break;
          }
        }
        scannedFolders.push(displayFolder(path));
      } finally {
        lock.release();
      }
    }

    // Sent mailbox — separate budget so it can't starve inbound above.
    if (opts.sent) {
      const sentPath = findSentMailbox(boxes);
      if (sentPath) {
        const lock = await client.getMailboxLock(sentPath);
        try {
          const found = (await client.search({ since: opts.sent.sentSince }, { uid: true })) || [];
          const uids = Array.isArray(found) ? found : [];
          if (uids.length) {
            const chosen = uids.slice(-opts.sent.sentCap);
            for await (const msg of client.fetch(
              chosen,
              { uid: true, source: true, internalDate: true },
              { uid: true }
            )) {
              if (!msg.source) continue;
              const internal = msg.internalDate ? new Date(msg.internalDate) : undefined;
              messages.push(await mapMessage(msg.source, sentPath, msg.uid, internal, true));
            }
          }
          scannedFolders.push(displayFolder(sentPath));
        } finally {
          lock.release();
        }
      }
    }
  } finally {
    try {
      client.close();
    } catch {
      /* already down */
    }
  }
  return { messages, scannedFolders };
}
