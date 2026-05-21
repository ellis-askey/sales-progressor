// lib/services/comms/parse-whatsapp.ts
//
// Pure parser for WhatsApp chat transcripts pasted by an agent.
// No DB I/O. Used by the Activity tab's "Paste chat" flow.
//
// Supports two export formats:
//   1. iOS "Share → Copy": `[10:30, 21/05/2026] Sender: message`
//   2. Android export:     `21/05/2026, 10:30 - Sender: message`
//
// Multi-line messages: any line that doesn't match the timestamp regex
// is appended to the previous message's content.
//
// Timezone: WhatsApp exports in the user's local device time. We treat all
// timestamps as UK local (the only locale we serve) and convert to UTC for
// storage via Intl.DateTimeFormat — handles BST/GMT per-date automatically.

export type ParsedMessage = {
  rawSender: string;       // exactly as it appeared, e.g. "+44 7962 041344"
  content: string;         // full content (multi-line preserved)
  whatsappTimestamp: Date; // UK local time, converted to UTC
  lineNumber: number;      // 1-based, for diagnostics
};

export type ParseResult = {
  messages: ParsedMessage[];
  uniqueSenders: string[];                       // distinct rawSender values, first-seen order
  skipped: { line: number; reason: string }[];   // system msgs, malformed, empties
};

export const MAX_PASTE_CHARS = 100_000;
export const MAX_PARSED_MESSAGES = 500;

const SYSTEM_LINE_PATTERNS: RegExp[] = [
  /^Messages and calls are end-to-end encrypted/i,
  /^You created this group/i,
  /^You changed the subject from/i,
  /^Missed voice call/i,
  /^Missed video call/i,
];

// iOS share-to-copy format:
//   [10:30, 21/05/2026] Sender Name: content
//   [10:30:15, 21/05/2026] Sender Name: content
// Optional invisible LRM ‎ (U+200E) prefix on iOS exports.
const IOS_RE =
  /^‎?\[(\d{1,2}):(\d{2})(?::\d{2})?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]\s+(.+?):\s?(.*)$/;

// Android export format (less common):
//   21/05/2026, 10:30 - Sender Name: content
//   21/05/2026, 10:30 am - Sender Name: content
const ANDROID_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})(?:\s*([ap]m))?\s+-\s+(.+?):\s?(.*)$/i;

type LineMatch = {
  hour: number;
  minute: number;
  day: number;
  month: number;
  year: number;
  sender: string;
  firstLineContent: string;
};

function normaliseYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function tryMatchIOS(line: string): LineMatch | null {
  const m = IOS_RE.exec(line);
  if (!m) return null;
  return {
    hour: Number(m[1]),
    minute: Number(m[2]),
    day: Number(m[3]),
    month: Number(m[4]),
    year: normaliseYear(Number(m[5])),
    sender: m[6].trim(),
    firstLineContent: m[7] ?? "",
  };
}

function tryMatchAndroid(line: string): LineMatch | null {
  const m = ANDROID_RE.exec(line);
  if (!m) return null;
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const ampm = m[6]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return {
    hour,
    minute,
    day: Number(m[1]),
    month: Number(m[2]),
    year: normaliseYear(Number(m[3])),
    sender: m[7].trim(),
    firstLineContent: m[8] ?? "",
  };
}

function isSystemLine(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return SYSTEM_LINE_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Compute UK timezone offset (in minutes east of UTC) for a given moment.
 * BST = +60, GMT = 0. Uses Intl, so DST transitions are correct without a table.
 */
function ukOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // tz looks like "GMT", "GMT+1", "GMT+01:00"
  const match = /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(tz);
  if (!match) return 0;
  const hours = Number(match[1]);
  const mins = match[2] ? Number(match[2]) : 0;
  return hours * 60 + (hours < 0 ? -mins : mins);
}

/**
 * Convert UK local YYYY-MM-DD HH:MM to a UTC Date.
 * Approach: build the time as if it were UTC, then shift backward by the
 * UK offset at that moment (so the resulting UTC Date represents the same
 * wall-clock time in London).
 */
function ukLocalToUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offsetMin = ukOffsetMinutes(naive);
  return new Date(naive.getTime() - offsetMin * 60_000);
}

/**
 * Parse a pasted WhatsApp transcript into discrete messages.
 *
 * Returns empty `messages` (and zero `skipped` line errors of the "format"
 * kind) when nothing recognisable is found — caller surfaces that to the user
 * as "couldn't recognise format".
 */
export function parseWhatsAppChat(raw: string): ParseResult {
  if (!raw || raw.trim().length === 0) {
    return { messages: [], uniqueSenders: [], skipped: [] };
  }
  if (raw.length > MAX_PASTE_CHARS) {
    return {
      messages: [],
      uniqueSenders: [],
      skipped: [{ line: 0, reason: `Paste exceeds ${MAX_PASTE_CHARS} characters — split it into smaller chunks.` }],
    };
  }

  const lines = raw.split(/\r?\n/);

  // Auto-detect format by trying both regexes on the first 20 non-empty lines.
  // Whichever yields more matches wins. (Single-line ambiguity → iOS preferred.)
  let format: "ios" | "android" = "ios";
  {
    let iosHits = 0;
    let androidHits = 0;
    let probed = 0;
    for (const line of lines) {
      if (probed >= 20) break;
      if (!line.trim()) continue;
      probed++;
      if (tryMatchIOS(line)) iosHits++;
      else if (tryMatchAndroid(line)) androidHits++;
    }
    if (androidHits > iosHits) format = "android";
  }

  const match = (line: string) => (format === "ios" ? tryMatchIOS(line) : tryMatchAndroid(line));

  const messages: ParsedMessage[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const uniqueSenders: string[] = [];
  const senderSet = new Set<string>();

  let current: ParsedMessage | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;
    const stripped = rawLine.replace(/^‎+/, ""); // strip leading LRMs

    if (!stripped.trim()) {
      // Blank line — if we're inside a multi-line message, preserve the break
      if (current) current.content += "\n";
      continue;
    }

    const m = match(stripped);
    if (m) {
      // Finalise the previous message (if any) and start a new one
      if (current) {
        if (current.content.trim()) messages.push(current);
        else skipped.push({ line: current.lineNumber, reason: "Empty content" });
        current = null;
      }

      if (isSystemLine(m.firstLineContent) || isSystemLine(m.sender)) {
        skipped.push({ line: lineNumber, reason: "System message" });
        continue;
      }

      const ts = ukLocalToUTC(m.year, m.month, m.day, m.hour, m.minute);
      current = {
        rawSender: m.sender,
        content: m.firstLineContent,
        whatsappTimestamp: ts,
        lineNumber,
      };

      if (!senderSet.has(m.sender)) {
        senderSet.add(m.sender);
        uniqueSenders.push(m.sender);
      }
    } else {
      // Continuation of the previous message — append
      if (current) {
        current.content += (current.content.endsWith("\n") ? "" : "\n") + stripped;
      } else {
        skipped.push({ line: lineNumber, reason: "Line precedes any recognised message" });
      }
    }
  }

  // Push the last in-flight message
  if (current) {
    if (current.content.trim()) messages.push(current);
    else skipped.push({ line: current.lineNumber, reason: "Empty content" });
  }

  // Trim content (collapse trailing whitespace from blank-line tolerance)
  for (const msg of messages) {
    msg.content = msg.content.replace(/\n{3,}/g, "\n\n").trim();
  }

  if (messages.length > MAX_PARSED_MESSAGES) {
    return {
      messages: [],
      uniqueSenders: [],
      skipped: [{ line: 0, reason: `Too many messages (${messages.length}). Maximum per import is ${MAX_PARSED_MESSAGES} — split into chunks.` }],
    };
  }

  return { messages, uniqueSenders, skipped };
}

/**
 * Compute a stable hash for dedupe: same content + same minute = same message.
 * Used to skip messages that already exist on the transaction.
 */
export function dedupeHash(content: string, timestamp: Date): string {
  const minuteBucket = Math.floor(timestamp.getTime() / 60_000);
  const normalisedContent = content.trim().replace(/\s+/g, " ");
  return `${minuteBucket}:${normalisedContent}`;
}
