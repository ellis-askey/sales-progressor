// Source-aware normalisation for pasted custom signatures.
//
// Signature generators produce very different HTML. Some (WiseStamp, Exclaimer)
// build fixed-width nested tables that cram each contact row, so once the tool's
// own CSS is gone the contact text wraps under its icon. We detect the source
// (from tell-tale markers in the pasted HTML) and apply a small per-source
// clean-up on top of the generic sanitiser. Auto-detected on paste; the user can
// override it from a small menu if detection is wrong.
//
// See docs/active/email-signature/00-audit-and-plan.md §6.

import { injectStyle } from "./sanitize-signature";

export type SignatureSource = "outlook" | "gmail" | "wisestamp" | "exclaimer" | "other";

export function detectSignatureSource(html: string): SignatureSource {
  if (!html) return "other";
  if (/wisestamp\.com/i.test(html)) return "wisestamp";
  if (/exclaimer/i.test(html)) return "exclaimer";
  if (/MsoNormal|mso-|urn:schemas-microsoft-com|WordSection/i.test(html)) return "outlook";
  if (/gmail_signature|data-smartmail\s*=/i.test(html)) return "gmail";
  return "other";
}

// Generator signatures (WiseStamp/Exclaimer) wrap contact rows in fixed-width
// cells that are too narrow once their stylesheet is gone, so the text drops
// under the icon. Un-cramp narrow content cells and keep contact lines
// (tel:/mailto:) on one line beside their icon.
function uncrampGeneratorTables(html: string): string {
  // Drop fixed widths <= 160px on <td> (both the style and the width="" forms).
  // Structural columns are wider than this, so they're kept; only the cramped
  // content cells lose their width and grow to fit.
  let out = html.replace(/<td\b[^>]*>/gi, (tag) => {
    let t = tag.replace(/width:\s*(\d+(?:\.\d+)?)px/gi, (m, n) => (parseFloat(n) <= 160 ? "" : m));
    t = t.replace(/\swidth="(\d+)"/gi, (m, n) => (Number(n) <= 160 ? "" : m));
    return t.replace(/;\s*;/g, ";");
  });
  // Keep a contact line on one line. <p> can't nest <p>, so this block match is
  // safe; only paragraphs that actually contain a tel:/mailto: link are touched.
  out = out.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (m, attrs, inner) =>
    /href=["'](?:tel:|mailto:)/i.test(inner) ? `<p${injectStyle(attrs, "white-space:nowrap")}>${inner}</p>` : m,
  );
  return out;
}

// Apply the per-source clean-up. Non-generator sources need nothing beyond the
// generic sanitiser, so they pass through unchanged.
export function normalizeBySource(html: string, source: SignatureSource): string {
  if (!html) return html;
  if (source === "wisestamp" || source === "exclaimer") return uncrampGeneratorTables(html);
  return html;
}
