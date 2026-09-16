// Provider-neutral mail types shared by every inbox connector (Outlook today,
// IMAP + Gmail next). A connector's only job is to produce IngestMessage[] from a
// mailbox; the shared match + ingest core in ./match and ./ingest does the rest,
// identically regardless of provider. Extracted from lib/integrations/outlook/sync.ts
// (behaviour-preserving) so a new provider is a reader, not a re-implementation.

// One email in the normalised shape the matching engine understands. Outlook's
// OutlookMessage already satisfies this; IMAP/Gmail readers map into it.
export type IngestMessage = {
  id: string; // provider-stable id, used for dedup (Graph id / Message-ID / imap uid)
  subject: string;
  from: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  receivedDateTime: string; // ISO
  bodyPreview: string;
  body: string; // full body as plain text
  folder: string; // display name of the folder the message lives in ("" if none)
  webLink?: string | null; // provider deep-link, when available (Outlook only)
  // Threading metadata (capture-only; no consumer reads it yet). Null when absent.
  conversationId: string | null;
  internetMessageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  // Lowercased subset of raw headers used for auto-reply detection
  // (auto-submitted, x-autoreply, x-auto-response-suppress, precedence). Each
  // connector populates what it has; optional so older callers still type-check.
  headers?: Record<string, string>;
  // File attachments carried on the message (Phase F1). Populated by the
  // connector when it fetched them (Outlook via Graph, IMAP via mailparser).
  // Optional so callers that don't fetch attachments still type-check.
  attachments?: IngestAttachment[];
  // True when this message came from the mailbox's Sent folder — i.e. the agent
  // sent it (our side). Drives outbound direction on ingest. (Complete Email
  // History, Phase 2.) Undefined/false = received (inbound), the default.
  outbound?: boolean;
};

// One file attachment on an inbound email, with its bytes in hand. Filed into
// the property's Documents by the ingest core (Phase F1).
export type IngestAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
  isInline?: boolean; // signature logos / inline body images — skipped on filing
  cid?: string | null; // content-id, when inline
};

// A message as shown in the review UI (no full body — kept light).
export type SyncMessageInfo = {
  messageId: string;
  subject: string;
  from: string;
  fromName: string | null;
  folder: string;
  receivedDateTime: string;
  preview: string;
};
export type FileRef = { transactionId: string; address: string };
export type LoggedItem = SyncMessageInfo & FileRef;
export type UnmatchedItem = SyncMessageInfo & { candidates: FileRef[] };

export type SyncSummary = {
  checked: number;
  folders: number;
  folderNames: string[];
  logged: LoggedItem[];
  alreadyLogged: LoggedItem[];
  unmatched: UnmatchedItem[];
};
