// Plain-text <-> HTML bridges for the chase composer.
//
// The composer edits HTML (bold/italic/lists/links). But several paths need
// plain text: the text/plain email part, the "Open in my email" mailto handoff,
// the comms history log, and the character count. The AI generator returns plain
// text, so we lift it into HTML when it lands in the editor. Server-side the HTML
// is authoritatively re-sanitised (lib/email/sanitize-signature.ts) — these are
// only presentation/transport bridges, not a security boundary.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain text -> simple HTML: blank-line-separated paragraphs, single newlines as
// <br>. Used when an AI draft (plain text) is loaded into the editor.
export function textToHtml(text: string): string {
  if (!text || !text.trim()) return "";
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// HTML -> plain text: unwrap the tags the editor produces, turning block ends
// and <br> into newlines and list items into "- " lines.
export function htmlToText(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/\s*(p|div|h[1-6]|tr)\s*>/gi, "\n");
  s = s.replace(/<\s*li[^>]*>/gi, "- ");
  s = s.replace(/<\/\s*li\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// True when the editor's HTML holds no visible text (empty <p>, stray <br>, etc).
export function isHtmlEmpty(html: string): boolean {
  return htmlToText(html).length === 0;
}
