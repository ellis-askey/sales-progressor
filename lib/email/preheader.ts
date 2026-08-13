// Inbox preview line (audit #8 — "add a preview line to every email").
//
// The grey text an inbox shows under the subject is the single biggest driver
// of opens after the subject itself. Without this, inboxes grab whatever text
// comes first inside the email (our brand banner, or "Hi Sarah,"), which says
// nothing. `preheader(text)` returns a hidden block to drop in immediately
// after <body>: the inbox reads it for the preview, but the recipient never
// sees it once the email is open.
//
// The second hidden block is zero-width padding — it stops the real body copy
// from leaking in after our line and filling the rest of the preview slot.
//
// Usage:
//   const html = `<!DOCTYPE html><html>…<body …>${preheader("One quick thing needs you")}…`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const HIDDEN = "display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;";
// ~60 repeats of a zero-width joiner + non-breaking space: invisible, but
// enough characters to push the visible body text out of the preview window.
const PADDING = "&#847;&zwnj;&nbsp;".repeat(60);

export function preheader(text: string): string {
  return (
    `<div style="${HIDDEN}">${escapeHtml(text)}</div>` +
    `<div style="${HIDDEN}">${PADDING}</div>`
  );
}
