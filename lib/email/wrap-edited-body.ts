// Wrap an agent's hand-edited chase body in a plain (unbranded) email frame.
//
// When an agent overrides a chase's body from the timeline, the send drops the
// branded template and sends their text verbatim in this plain frame (mirrors
// sendDigestForGroup). Both the autopilot "what we'll send" preview and the
// chase-timeline next-email preview render through this same helper so the
// preview matches the send exactly.
export function wrapEditedBody(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1d29;background:#fff;white-space:pre-wrap;line-height:1.55;font-size:14px">${esc}</body></html>`;
}
