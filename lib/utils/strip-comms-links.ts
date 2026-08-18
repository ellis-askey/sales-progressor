// Strip portal deep-links + unsubscribe URLs from the plain-text version
// of an automated email BEFORE rendering it in the activity feed / portal
// updates tab. The raw record on OutboundMessage.content stays untouched —
// this only affects what's shown.
//
// Two link families we strip:
//   1. Portal deep-links   — /portal/<token>/... (respond page etc.)
//   2. Unsubscribe URLs    — /api/unsubscribe?t=...
//
// Each is prefaced in the source email by an intro sentence + a blank line
// (see lib/email/client-chase-digest.ts). To leave clean copy behind we
// strip both the URL AND the intro sentence + surrounding whitespace as
// one block.

/** Matches any URL whose path starts with /portal/<token>/, e.g. a respond link. */
const PORTAL_URL_RE = /^https?:\/\/\S+\/portal\/[^\s/]+\/\S+/gm;

/** Matches the unsubscribe URL (with signed token). */
const UNSUBSCRIBE_URL_RE = /^https?:\/\/\S+\/api\/unsubscribe\?[^\s]+/gm;

/** Removes the whole "If you'd rather we stop sending these" block including
 * the URL line and surrounding blank lines. */
const UNSUBSCRIBE_BLOCK_RE =
  /\n*If you'd rather we stop sending these[^\n]*\n+https?:\/\/\S+\/api\/unsubscribe\?[^\s\n]+\n?/g;

/** Removes the "open the page below" style URL that sits on its own line,
 * plus the blank line before it. Preserves the sentence above. */
const RESPOND_URL_LINE_RE = /\n+https?:\/\/\S+\/portal\/[^\s/]+\/\S+\n?/g;

/** Solicitor response links (/s/<token>) — the enquiries chase and
 * solicitor-confirm emails use these instead of /portal/ deep-links.
 * Host must be immediately followed by /s/ so a mid-path "/s/" segment
 * elsewhere can't false-match. Added 2026-08-18: these previously
 * rendered as raw URLs in the activity feed instead of the button. */
const SOLICITOR_URL_LINE_RE = /\n+https?:\/\/[^\s/]+\/s\/[^\s\n]+\n?/g;

export type StripResult = {
  /** Content with URLs stripped, safe to render as-is. */
  text: string;
  /** Extracted portal deep-links, for agent-side pill rendering. */
  portalLinks: string[];
};

/**
 * Portal-side / silent strip. Removes BOTH URL families completely,
 * including the surrounding intro sentence for the unsubscribe block.
 * Returns just the cleaned text.
 */
export function stripCommsLinksSilent(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  let out = raw;
  out = out.replace(UNSUBSCRIBE_BLOCK_RE, "\n");
  out = out.replace(RESPOND_URL_LINE_RE, "\n");
  out = out.replace(SOLICITOR_URL_LINE_RE, "\n");
  // Collapse any 3+ newlines left behind
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

/**
 * Agent-side strip. Removes the unsubscribe block silently (agent doesn't
 * use it), and pulls out the portal deep-links so the caller can render
 * clickable pills where the URL used to sit.
 */
export function stripCommsLinksForAgent(raw: string | null | undefined): StripResult {
  if (!raw) return { text: raw ?? "", portalLinks: [] };
  let out = raw;
  out = out.replace(UNSUBSCRIBE_BLOCK_RE, "\n");
  const portalLinks: string[] = [];
  const collect = (match: string) => {
    const url = match.match(/https?:\/\/\S+/)?.[0];
    if (url) portalLinks.push(url);
    return "\n";
  };
  out = out.replace(RESPOND_URL_LINE_RE, collect);
  out = out.replace(SOLICITOR_URL_LINE_RE, collect);
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return { text: out, portalLinks };
}

// Also exported so tests can hit the raw regexes directly if needed.
export const _internal = { PORTAL_URL_RE, UNSUBSCRIBE_URL_RE, UNSUBSCRIBE_BLOCK_RE, RESPOND_URL_LINE_RE, SOLICITOR_URL_LINE_RE };
