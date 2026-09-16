// Provider-neutral ingest + sync orchestration. Given normalised IngestMessage[]
// from any connector (Outlook / IMAP / Gmail), match each to a file and store the
// confident ones as inbound OutboundMessage rows. Extracted from
// lib/integrations/outlook/sync.ts (behaviour-preserving) — the only additions are
// a `source` tag on the stored record and folderHints being derived from the
// messages when a connector doesn't precompute them.

import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/security/access-scope";
import { touchLastActivity } from "@/lib/services/activity";
import { cleanIngestedEmail } from "@/lib/email/clean-inbound";
import { looksForwarded, extractInnerEmails } from "./forwarded";
import { buildIndex, buildFolderHints, matchMessage } from "./match";
import { detectAutoReply } from "./auto-reply";
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

async function logMessage(
  txId: string,
  msg: IngestMessage,
  source: string
): Promise<{ status: "logged" | "already"; address: string }> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { agencyId: true, propertyAddress: true },
  });
  const address = tx?.propertyAddress ?? "";

  const received = new Date(msg.receivedDateTime);
  // Dedup on the provider id AND on the real message (same file + sender +
  // subject + received time to the minute). The same email filed in both the
  // Inbox and a property folder has a different provider id per folder, so the id
  // check alone let it in twice; the second arm collapses those copies to one —
  // and also catches the same email arriving via two different connectors.
  const existing = await prisma.outboundMessage.findFirst({
    where: {
      transactionId: txId,
      OR: [
        { providerMessageId: msg.id },
        {
          method: "email",
          recipientEmail: msg.from,
          subject: msg.subject || "(no subject)",
          sentAt: { gte: new Date(received.getTime() - 60_000), lte: new Date(received.getTime() + 60_000) },
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
  let read: EmailReadResult | null = null;
  if (!autoReply && process.env.EMAIL_AI_READ_ENABLED === "true") {
    read = await readInboundEmail(txId, tx?.agencyId ?? null, {
      subject: msg.subject || "(no subject)",
      body: cleaned,
    }).catch(() => null);
  }

  await prisma.outboundMessage.create({
    data: {
      transactionId: txId,
      agencyId: tx?.agencyId ?? null,
      type: "inbound",
      method: "email",
      contactIds: [],
      subject: msg.subject || "(no subject)",
      content: cleaned,
      recipientName: msg.fromName,
      recipientEmail: msg.from,
      ccEmails: msg.cc.length ? msg.cc.join(", ") : null,
      providerMessageId: msg.id,
      // Threading metadata (capture-only; no consumer reads it yet). Null when
      // the source omits the field. Does not affect dedup above.
      conversationId: msg.conversationId,
      internetMessageId: msg.internetMessageId,
      inReplyTo: msg.inReplyTo,
      emailReferences: msg.references,
      providerWebhookData: {
        source,
        folder: msg.folder,
        from: msg.from,
        to: msg.to,
        cc: msg.cc,
        webLink: msg.webLink ?? null,
        receivedDateTime: msg.receivedDateTime,
        raw: rawBody,
        ...(autoReply ? { autoReply: true } : {}),
        ...(read && (read.summary || read.suggestions.length) ? { read } : {}),
      },
      createdByRole: "system",
      createdAt: received,
      sentAt: received,
    },
  });
  await touchLastActivity(txId);
  return { status: "logged", address };
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
  // agent-side "Needs filing" tray (Phase E2). Omitted → no tray persistence.
  mailboxUserId?: string;
  mailboxAgencyId?: string | null;
}): Promise<SyncSummary> {
  const { messages, mailboxEmail, scope, source, mailboxUserId, mailboxAgencyId } = opts;
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
    const { txId, candidates } = matchMessage(msg, mailboxEmail, index, folderHints);

    if (!txId) {
      const candidateRefs = candidates.map(fileRef);
      summary.unmatched.push({ ...info, candidates: candidateRefs });
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
              subject: msg.subject || "(no subject)",
              fromEmail: msg.from,
              fromName: msg.fromName,
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

    const { status, address } = await logMessage(txId, msg, source);
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
  source: string
): Promise<LoggedItem> {
  const { address } = await logMessage(txId, msg, source);
  return { ...toInfo(msg), transactionId: txId, address };
}
