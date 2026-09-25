// Provider-neutral ingest + sync orchestration. Given normalised IngestMessage[]
// from any connector (Outlook / IMAP / Gmail), match each to a file and store the
// confident ones as inbound OutboundMessage rows. Extracted from
// lib/integrations/outlook/sync.ts (behaviour-preserving) — the only additions are
// a `source` tag on the stored record and folderHints being derived from the
// messages when a connector doesn't precompute them.

import "server-only";
import { prisma } from "@/lib/prisma";
import { scopeTransactionWhere, type AccessScope } from "@/lib/security/access-scope";
import { touchLastActivity } from "@/lib/services/activity";
import { cleanIngestedEmail } from "@/lib/email/clean-inbound";
import { looksForwarded, extractInnerEmails } from "./forwarded";
import { buildIndex, buildFolderHints, buildAddressIndex, matchMessage } from "./match";
import { detectAutoReply } from "./auto-reply";
import { filterStorableAttachments } from "./attachments";
import { extractSignaturePhone } from "./signature";
import { uploadToStorage } from "@/lib/supabase-storage";
import { buildDocumentStoragePath } from "@/lib/upload/document-upload";

// A "this contact is missing a phone we found in their signature" suggestion,
// stored on the email and surfaced in the feed for the agent to confirm (F2).
export type ContactPhoneSuggestion = { contactId: string; contactName: string; phone: string };
import { readInboundEmail } from "@/lib/services/email-read-context";
import type { EmailReadResult } from "@/lib/services/email-read";
import type {
  IngestMessage,
  SyncMessageInfo,
  FileRef,
  LoggedItem,
  SyncSummary,
} from "./types";

// ─── Ingest one matched message ────────────────────────────────────────────────

// Attribution + direction for a logged message. mailboxUserId/Role identify the
// agent whose connected mailbox produced a SENT (outbound) email, so it renders
// as "<agent> · <agency> · Your team". (Complete Email History, Phase 2.)
type LogOpts = { mailboxUserId?: string | null; mailboxUserRole?: string | null };

async function logMessage(
  txId: string,
  msg: IngestMessage,
  source: string,
  opts: LogOpts = {}
): Promise<{ status: "logged" | "already"; address: string }> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { agencyId: true, propertyAddress: true },
  });
  const address = tx?.propertyAddress ?? "";
  const outbound = msg.outbound === true;

  // A Sent-folder message carrying OUR Message-ID is one the app itself sent
  // through the agent's mailbox (mailbox-SMTP sends file a copy to Sent, and
  // every one is stamped <sp-...@thesalesprogressor.co.uk> — see
  // lib/integrations/smtp/client.ts). It was already recorded on the file at
  // send time, so re-ingesting it would double-log; skip outright. The
  // Message-ID dedup arm below can't be relied on for this: not every send
  // path records its id on the OutboundMessage row.
  if (outbound && msg.internetMessageId?.toLowerCase().endsWith("@thesalesprogressor.co.uk>")) {
    return { status: "already", address };
  }

  const received = new Date(msg.receivedDateTime);
  // Dedup on the provider id, the RFC Message-ID, AND the real message (same file
  // + counterparty + subject + time). The same email filed in both the Inbox and
  // a property folder has a different provider id per folder, so the id check
  // alone let it in twice; the extra arms collapse those copies to one — and
  // catch the same email arriving via two connectors. The internetMessageId arm
  // is null-safe (only added when the incoming id is set, and it can never match
  // a stored NULL), giving cheap defence-in-depth without relying on the fuzzy arm.
  //
  // The fuzzy arm is side-aware. Both send-time rows and ingested rows store the
  // COUNTERPARTY in recipientEmail — the sender for inbound, the recipient for
  // outbound (see the create below, line ~137). So for an ingested outbound copy
  // we must match on who we sent TO (msg.to[0]), not the mailbox owner (msg.from).
  // This is what collapses an app-sent chase against its Sent-folder re-ingest
  // even when the mailbox provider rewrote our Message-ID (so the id arms miss).
  // The window is wider for outbound: send-click time and the provider's Sent
  // timestamp can drift by minutes.
  const fuzzyCounterparty = outbound ? (msg.to[0] ?? msg.from) : msg.from;
  const fuzzyWindowMs = outbound ? 15 * 60_000 : 60_000;
  const existing = await prisma.outboundMessage.findFirst({
    where: {
      transactionId: txId,
      OR: [
        { providerMessageId: msg.id },
        ...(msg.internetMessageId ? [{ internetMessageId: msg.internetMessageId }] : []),
        {
          method: "email",
          type: outbound ? "outbound" : "inbound",
          recipientEmail: fuzzyCounterparty,
          subject: msg.subject || "(no subject)",
          sentAt: { gte: new Date(received.getTime() - fuzzyWindowMs), lte: new Date(received.getTime() + fuzzyWindowMs) },
        },
      ],
    },
    select: { id: true },
  });
  if (existing) return { status: "already", address };

  // Store just the new message (signature + confidentiality footer + quoted
  // chain trimmed); keep the untouched original in providerWebhookData.raw so a
  // "show original" is always possible and the cleaning is reversible. Fall back
  // to the raw if trimming leaves nothing (e.g. an email that is only a quote).
  const rawBody = (msg.body || msg.bodyPreview || "").trim();
  const cleaned = cleanIngestedEmail(rawBody) || rawBody;
  // Auto-reply / out-of-office / bounce: still stored (recoverable) but tagged so
  // the activity feed hides it by default — it carries no real update. (Phase A2.)
  const autoReply = detectAutoReply(msg);

  // AI read (Phase D2): summarise + suggest milestone/chain-step confirms or a
  // to-do. Gated behind EMAIL_AI_READ_ENABLED (ships dark — no spend until the
  // accept/dismiss UI is live and the prompt is tuned). Skips auto-replies.
  // Best-effort: a failed read never blocks the email being stored.
  // AI read + signature suggestion are INBOUND-only concepts (they read the
  // sender's message/signature). Never run for our own sent mail.
  let read: EmailReadResult | null = null;
  if (!outbound && !autoReply && process.env.EMAIL_AI_READ_ENABLED === "true") {
    read = await readInboundEmail(txId, tx?.agencyId ?? null, {
      subject: msg.subject || "(no subject)",
      body: cleaned,
    }).catch(() => null);
  }

  // Signature → contact phone (Phase F2). If the sender is a known contact on
  // this file with no phone, and their signature carries one, stash a suggestion
  // for the agent to confirm. Suggest-only — never written silently. Skips
  // auto-replies (their "signature" is a system footer) and our own sent mail.
  const contactSuggestion = outbound || autoReply
    ? null
    : await buildContactPhoneSuggestion(txId, msg.from, rawBody).catch(() => null);

  await prisma.outboundMessage.create({
    data: {
      transactionId: txId,
      agencyId: tx?.agencyId ?? null,
      // A Sent-Items email is our side (outbound); received mail is inbound.
      type: outbound ? "outbound" : "inbound",
      method: "email",
      contactIds: [],
      subject: msg.subject || "(no subject)",
      content: cleaned,
      // Inbound: recipientEmail carries the SENDER (feed convention). Outbound:
      // it carries the primary recipient (who we sent to); the author is the
      // mailbox owner, attributed via createdById below.
      recipientName: outbound ? null : msg.fromName,
      recipientEmail: outbound ? (msg.to[0] ?? null) : msg.from,
      ccEmails: msg.cc.length ? msg.cc.join(", ") : null,
      providerMessageId: msg.id,
      // Threading metadata — shared across inbound + outbound so a sent email and
      // its reply group into one conversation.
      conversationId: msg.conversationId,
      internetMessageId: msg.internetMessageId,
      inReplyTo: msg.inReplyTo,
      emailReferences: msg.references,
      providerWebhookData: {
        source,
        folder: msg.folder,
        direction: outbound ? "outbound" : "inbound",
        from: msg.from,
        to: msg.to,
        cc: msg.cc,
        webLink: msg.webLink ?? null,
        receivedDateTime: msg.receivedDateTime,
        raw: rawBody,
        ...(autoReply ? { autoReply: true } : {}),
        ...(read && (read.summary || read.suggestions.length) ? { read } : {}),
        ...(contactSuggestion ? { contactSuggestion } : {}),
      },
      // Outbound sent mail is attributed to the mailbox owner (the agent) so it
      // renders as "<agent> · Your team"; inbound stays a system-logged row.
      createdById: outbound ? (opts.mailboxUserId ?? null) : null,
      createdByRole: outbound ? (opts.mailboxUserRole ?? null) : "system",
      createdAt: received,
      sentAt: received,
    },
  });
  // File any real attachments into the property's Documents (Phase F1). Runs only
  // on the "logged" path (a de-duped re-sync returns early above, so files aren't
  // stored twice). Best-effort per attachment — a single bad upload never blocks
  // the email being logged or the other attachments.
  await storeInboundAttachments(txId, msg);
  await touchLastActivity(txId);
  return { status: "logged", address };
}

// Looks for a phone number in the message's signature that belongs on a known
// contact who's currently missing one. Returns a suggestion (never writes) or
// null. Only fires when: the sender matches exactly one contact on this file by
// email, that contact has no phone, and a valid UK number is found — and the
// found number isn't already on another contact here (that'd be a dedupe clash).
async function buildContactPhoneSuggestion(
  txId: string,
  fromEmail: string,
  rawBody: string
): Promise<ContactPhoneSuggestion | null> {
  const email = fromEmail.trim();
  if (!email) return null;

  const contact = await prisma.contact.findFirst({
    where: { propertyTransactionId: txId, email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, phone: true },
  });
  if (!contact || (contact.phone && contact.phone.trim())) return null;

  const phone = extractSignaturePhone(rawBody);
  if (!phone) return null;

  // Don't suggest a number already held by someone else on this file.
  const clash = await prisma.contact.findFirst({
    where: { propertyTransactionId: txId, phone, NOT: { id: contact.id } },
    select: { id: true },
  });
  if (clash) return null;

  return { contactId: contact.id, contactName: contact.name, phone };
}

// Uploads the storable attachments on a message to the file's document bucket and
// creates a TransactionDocument row for each (source "email"). Inline logos,
// disallowed types, oversized and tiny-image parts are filtered upstream.
async function storeInboundAttachments(txId: string, msg: IngestMessage): Promise<void> {
  const files = filterStorableAttachments(msg.attachments);
  if (files.length === 0) return;
  for (const file of files) {
    try {
      // Document dedup (Phase 2, §8): skip if the same file (name + size) is
      // already on this property — whether from a prior sync or the app's own
      // sending workflow. Prevents a sent email re-filing a document TSP already
      // holds.
      const dupe = await prisma.transactionDocument.findFirst({
        where: { transactionId: txId, filename: file.filename, fileSize: file.size },
        select: { id: true },
      });
      if (dupe) continue;
      const storagePath = buildDocumentStoragePath(txId, file.filename);
      await uploadToStorage(storagePath, file.content, file.contentType);
      await prisma.transactionDocument.create({
        data: {
          transactionId: txId,
          filename: file.filename,
          storagePath,
          fileSize: file.size,
          mimeType: file.contentType,
          source: "email",
          uploadedById: null,
          contactId: null,
        },
      });
    } catch (err) {
      console.error(
        `[mail] attachment store failed (${file.filename}) on ${txId}:`,
        (err as Error).message
      );
    }
  }
}

function toInfo(msg: IngestMessage): SyncMessageInfo {
  return {
    messageId: msg.id,
    subject: msg.subject || "(no subject)",
    from: msg.from,
    fromName: msg.fromName,
    folder: msg.folder,
    receivedDateTime: msg.receivedDateTime,
    preview: msg.bodyPreview,
  };
}

// Thread continuity (critique #16): if an email couldn't be placed by party /
// folder / address, but its conversation is ALREADY filed to exactly one property
// in scope, follow the thread there. Keyed on the specific conversation (one
// matter/thread), so a party shared across files can't leak — a different matter
// is a different thread. Returns the file id, or null when the thread is on zero
// or more than one file (then it stays in the tray rather than guessing).
async function conversationFile(conversationId: string, scope: AccessScope): Promise<string | null> {
  const rows = await prisma.outboundMessage.findMany({
    where: {
      conversationId,
      transactionId: { not: null },
      transaction: { is: { AND: [scopeTransactionWhere(scope), { status: { not: "draft" } }] } },
    },
    select: { transactionId: true },
    distinct: ["transactionId"],
    take: 3,
  });
  const ids = [...new Set(rows.map((r) => r.transactionId).filter((x): x is string => !!x))];
  return ids.length === 1 ? ids[0] : null;
}

// ─── Shared: match + ingest a batch of already-fetched messages ────────────────

// The provider-agnostic heart of a mailbox sync. A connector fetches messages
// (deciding which folders to read — that part is provider-specific) and hands the
// normalised batch here. Optionally passes precomputed folderHints; when it
// doesn't, we derive them from the folders present in the batch.
export async function runMailboxSync(opts: {
  messages: IngestMessage[];
  mailboxEmail: string;
  scope: AccessScope;
  source: string;
  folderHints?: Map<string, string>;
  // Folders that were actually scanned (for the summary count/names). When a
  // connector passes this, the summary reflects everything scanned — including
  // folders that had no messages in the window. When omitted, it's derived from
  // the folders present in the batch.
  scannedFolderNames?: string[];
  // Whose connected mailbox this is — used to persist unmatched emails into the
  // agent-side "Needs filing" tray (Phase E2), and to attribute SENT mail to the
  // agent (Phase 2). Omitted → no tray persistence / no outbound attribution.
  mailboxUserId?: string;
  mailboxAgencyId?: string | null;
  mailboxUserRole?: string | null;
}): Promise<SyncSummary> {
  const { messages, mailboxEmail, scope, source, mailboxUserId, mailboxAgencyId, mailboxUserRole } = opts;
  const mailboxLc = mailboxEmail.toLowerCase();

  const folderHints =
    opts.folderHints ??
    (await buildFolderHints(
      [...new Set(messages.map((m) => m.folder).filter((f) => f && f.toLowerCase() !== "inbox"))],
      scope
    ));

  const allEmails = new Set<string>();
  for (const m of messages) {
    for (const e of [m.from, ...m.to, ...m.cc]) {
      const lc = e.toLowerCase();
      if (lc && lc !== mailboxLc) allEmails.add(lc);
    }
    // Index the parties named inside forwarded/quoted text too, so the forward
    // fallback in matchMessage can resolve them to a file.
    if (looksForwarded(m)) {
      for (const e of extractInnerEmails(m.body)) {
        if (e !== mailboxLc) allEmails.add(e);
      }
    }
  }
  const index = await buildIndex([...allEmails], scope);
  // Address fallback index: every live file's address, so an email that NAMES a
  // property (but is from someone not yet on the file) can still be matched.
  const addressIndex = await buildAddressIndex(scope);

  const summaryFolders =
    opts.scannedFolderNames ?? [...new Set(messages.map((m) => m.folder).filter(Boolean))];
  const summary: SyncSummary = {
    checked: messages.length,
    folders: summaryFolders.length,
    folderNames: summaryFolders,
    logged: [],
    alreadyLogged: [],
    unmatched: [],
  };

  const fileRef = (txId: string): FileRef => ({
    transactionId: txId,
    address: index.txAddress.get(txId) ?? "",
  });

  for (const msg of messages) {
    const info = toInfo(msg);
    const matched = matchMessage(msg, mailboxEmail, index, folderHints, addressIndex);
    const candidates = matched.candidates;
    let txId = matched.txId;

    // Thread continuity (#16): couldn't place it, but this conversation is already
    // on exactly one file → follow the thread there. Catches replies whose address
    // is only in a mistyped subject / a body with no postcode.
    if (!txId && msg.conversationId) {
      const threadTx = await conversationFile(msg.conversationId, scope);
      if (threadTx) txId = threadTx;
    }

    if (!txId) {
      const candidateRefs = candidates.map(fileRef);
      summary.unmatched.push({ ...info, candidates: candidateRefs });
      // Only surface an email in the "Needs filing" tray when it has at least one
      // CANDIDATE file — i.e. a real party on it maps to a live file, we just
      // couldn't pick which. An email with NO candidate has no evidence of
      // belonging to any property (newsletters, billing, build alerts, a stranger
      // emailing the mailbox) — drop it entirely, no tray row, no trace. Applies
      // to inbound and outbound alike. (Before this, inbound dumped every
      // unmatched inbox email into the tray — the noise this fixes.)
      if (candidateRefs.length === 0) continue;
      // Persist to the agent-side "Needs filing" tray (Phase E2). Skip auto-replies
      // (noise), and only when we know whose mailbox it is. Unique (userId,
      // providerMessageId) via skipDuplicates → a filed/dismissed email won't
      // re-queue on the next sync. Best-effort; never breaks the sync.
      if (mailboxUserId && !detectAutoReply(msg)) {
        const raw = (msg.body || msg.bodyPreview || "").trim();
        await prisma.pendingInboundEmail
          .createMany({
            data: [{
              userId: mailboxUserId,
              agencyId: mailboxAgencyId ?? null,
              providerMessageId: msg.id,
              source,
              folder: msg.folder,
              direction: msg.outbound ? "outbound" : "inbound",
              subject: msg.subject || "(no subject)",
              // Inbound → From: the sender. Outbound → To: the recipient.
              fromEmail: msg.from,
              fromName: msg.fromName,
              toEmail: msg.outbound ? (msg.to[0] ?? null) : null,
              toName: null,
              body: cleanIngestedEmail(raw) || raw,
              rawBody: raw,
              receivedAt: new Date(msg.receivedDateTime),
              candidates: candidateRefs,
            }],
            skipDuplicates: true,
          })
          .catch(() => {});
      }
      continue;
    }

    const { status, address } = await logMessage(txId, msg, source, { mailboxUserId, mailboxUserRole });
    const item: LoggedItem = { ...info, transactionId: txId, address };
    if (status === "logged") summary.logged.push(item);
    else summary.alreadyLogged.push(item);
  }

  return summary;
}

// ─── Shared: log one chosen message to a file (from the review UI) ─────────────

export async function logSingleIngestMessage(
  txId: string,
  msg: IngestMessage,
  source: string,
  opts: LogOpts = {}
): Promise<LoggedItem> {
  const { address } = await logMessage(txId, msg, source, opts);
  return { ...toInfo(msg), transactionId: txId, address };
}
