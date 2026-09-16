// Detects auto-replies / out-of-office / auto-acknowledgements so they can be
// tagged and hidden from the file's default activity feed (Phase A2). These
// carry no real update and otherwise clutter the timeline. Detection is
// conservative: it fires on the standard machine headers (RFC 3834
// Auto-Submitted, Microsoft's X-Auto-Response-Suppress, X-Autoreply, or a
// bulk/auto Precedence) or on the well-known subject lines. When in doubt it
// returns false — a false negative just shows one extra email; a false positive
// hides a real one.

import type { IngestMessage } from "./types";

// Header names we ask the connectors to populate (lowercased).
export const AUTO_REPLY_HEADER_KEYS = [
  "auto-submitted",
  "x-autoreply",
  "x-auto-response-suppress",
  "precedence",
] as const;

// Leading Re:/Fwd: are stripped first, then matched against the known openers.
const SUBJECT_RE =
  /^\s*(?:(?:re|fwd?)\s*:\s*)*(automatic reply|auto[-\s]?reply|autoreply|out of (?:the )?office|automatic response|auto[-\s]?response|away from (?:the |my )?office|on annual leave|annual leave|delivery status notification|undeliverable)\b/i;

export function detectAutoReply(msg: Pick<IngestMessage, "subject" | "headers">): boolean {
  if (msg.subject && SUBJECT_RE.test(msg.subject)) return true;

  const h = msg.headers ?? {};
  const autoSubmitted = (h["auto-submitted"] ?? "").toLowerCase().trim();
  // RFC 3834: anything other than "no" (e.g. "auto-replied", "auto-generated").
  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (h["x-autoreply"]) return true;
  if (h["x-auto-response-suppress"]) return true;
  const precedence = (h["precedence"] ?? "").toLowerCase().trim();
  if (["auto_reply", "bulk", "junk", "list"].includes(precedence)) return true;

  return false;
}
