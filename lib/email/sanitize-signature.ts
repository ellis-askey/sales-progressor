// Sanitiser for pasted "custom" email signatures.
//
// Agents paste a signature copied from Outlook / Gmail / Exclaimer / WiseStamp.
// We keep sensible formatting (text, links, images, tables, colours) but strip
// anything unsafe or email-breaking. Runs SERVER-SIDE only, on save AND on draft
// preview, so the agent only ever sees, and we only ever store, clean HTML.
//
// Uses xss (js-xss) — allowlist based, CommonJS, no browser/DOM needed. See
// docs/active/email-signature/00-audit-and-plan.md §6 / §11.

import { FilterXSS, safeAttrValue as defaultSafeAttrValue } from "xss";

// Gmail clips messages around ~102KB; keep the signature well under that.
export const MAX_SIGNATURE_HTML = 50_000;
// Inline base64 images bloat every email; allow small ones (icons) only.
const MAX_DATA_URI = 60_000;

const filter = new FilterXSS({
  whiteList: {
    a: ["href", "name", "style", "title"],
    b: [], strong: [], i: [], em: [], u: [], br: [], small: [], sub: [], sup: [],
    p: ["style", "align", "dir"],
    div: ["style", "align", "dir"],
    span: ["style"],
    font: ["color", "face", "size", "style"],
    h1: ["style", "align"], h2: ["style", "align"], h3: ["style", "align"], h4: ["style", "align"],
    hr: ["style"],
    img: ["src", "alt", "width", "height", "style", "title"],
    table: ["style", "width", "height", "cellpadding", "cellspacing", "border", "align", "bgcolor"],
    thead: [], tbody: [], tfoot: [],
    tr: ["style", "valign", "align", "bgcolor", "height"],
    td: ["style", "width", "height", "colspan", "rowspan", "valign", "align", "bgcolor"],
    th: ["style", "width", "height", "colspan", "rowspan", "valign", "align", "bgcolor"],
    ul: ["style"], ol: ["style"], li: ["style"],
  },
  // Remove disallowed tags (keep their text) …
  stripIgnoreTag: true,
  // … except these, which are removed WITH their content.
  stripIgnoreTagBody: [
    "script", "style", "svg", "iframe", "object", "embed", "noscript",
    "form", "input", "button", "textarea", "select", "link", "meta", "base",
  ],
  // Enforce safe schemes: https + mailto/tel for links; https + small base64 for
  // images. Everything else (http, javascript:, file:, oversized data:) is dropped.
  safeAttrValue(tag, name, value, cssFilter) {
    if (tag === "img" && name === "src") {
      if (/^https:\/\//i.test(value)) return defaultSafeAttrValue(tag, name, value, cssFilter);
      if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value) && value.length <= MAX_DATA_URI) {
        return value;
      }
      return "";
    }
    if (name === "href") {
      if (/^(?:https:|mailto:|tel:)/i.test(value)) return defaultSafeAttrValue(tag, name, value, cssFilter);
      return "";
    }
    // Default handling for everything else (this is what filters inline CSS via
    // the built-in cssfilter allowlist, and strips javascript: etc).
    return defaultSafeAttrValue(tag, name, value, cssFilter);
  },
});

/**
 * Sanitise a pasted signature. Returns clean HTML (may be empty). Only allowed
 * tags/attributes/styles/schemes survive; scripts, event handlers, <style>,
 * <svg>/<iframe>/<object>, tracking pixels and unsafe schemes are removed, and
 * links are hardened with target/rel. The caller enforces MAX_SIGNATURE_HTML.
 */
export function sanitizeSignatureHtml(dirty: string): string {
  if (!dirty || !dirty.trim()) return "";
  let clean = filter.process(dirty);
  // Drop tracking pixels (1x1 / 0-sized images). The value must be EXACTLY 0 or
  // 1 (quoted, or unquoted at a value boundary) so width="120" isn't caught.
  clean = clean.replace(
    /<img\b[^>]*\b(?:width|height)\s*=\s*(?:"0*[01]"|'0*[01]'|0*[01](?=[\s/>]))[^>]*>/gi,
    "",
  );
  // Harden every remaining link (target/rel are not whitelisted, so any pasted
  // ones were stripped — we add our own).
  clean = clean.replace(/<a\s+(?=[^>]*\bhref=)/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return clean.trim();
}
