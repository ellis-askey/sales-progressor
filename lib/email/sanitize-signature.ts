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
      // http + https for links: a link is navigated on click, not loaded as a
      // sub-resource, so http is not a mixed-content risk (unlike img src). This
      // keeps agency websites on http from becoming dead links.
      if (/^(?:https?:|mailto:|tel:)/i.test(value)) return defaultSafeAttrValue(tag, name, value, cssFilter);
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
// Add an inline style declaration to a tag's attributes (appended so it wins).
function injectStyle(attrs: string, decl: string): string {
  if (/style\s*=\s*(["'])/i.test(attrs)) {
    return attrs.replace(/style\s*=\s*(["'])([\s\S]*?)\1/i, (_m, q, val) => {
      const trimmed = val.replace(/;\s*$/, "");
      return `style=${q}${trimmed ? `${trimmed};` : ""}${decl}${q}`;
    });
  }
  return `${attrs} style="${decl}"`;
}

// Make a real inbox match the in-app preview. The app renders with a CSS reset
// (block margins zeroed); email clients don't, so pasted <p>-per-line signatures
// (Outlook) get each client's default ~1em paragraph margin, adding big gaps
// that aren't in the preview. Bake margin:0 into block elements to match, and
// keep images responsive on mobile. Intentional <br> line breaks are untouched.
function normalizeBlockSpacing(html: string): string {
  let out = html.replace(
    /<(p|h[1-4]|ul|ol|blockquote)\b([^>]*)>/gi,
    (_m, tag, attrs) => `<${tag}${injectStyle(attrs, "margin:0")}>`,
  );
  // max-width:100% keeps images inside the column; height:auto MUST come with it
  // (overriding any fixed pixel/point height) or the image squashes on mobile —
  // the width shrinks to fit while the fixed height stays, distorting it.
  out = out.replace(/<img\b([^>]*)>/gi, (_m, attrs) => `<img${injectStyle(attrs, "max-width:100%;height:auto")}>`);
  return out;
}

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
  clean = normalizeBlockSpacing(clean);
  return clean.trim();
}
