// The invoice design/settings a progression business customises for the invoices
// it sends its client agencies — stored on ProgressionBusiness.invoiceDesign
// (Json?). This is the single source of truth for the shape, defaults, and a
// safe parser (the column is Json, so every read must validate + fall back,
// mirroring lib/agent/notification-prefs.ts). Consumed by the designer UI, the
// save action, the on-screen preview, and the PDF renderer.

export type InvoiceTemplate = "classic" | "modern" | "minimal";

export type InvoiceDesign = {
  template: InvoiceTemplate;
  brandColor: string; // hex, e.g. "#0E7490"
  font: "sans" | "serif";
  logoEnabled: boolean;
  showTagline: boolean;
  tagline: string;
  showSalePrice: boolean; // show the sale price on each line
  showExchangeDate: boolean; // show the exchange-date column
  showBank: boolean; // show bank-transfer details in the footer
  showTerms: boolean; // show payment terms in the footer
  title: string; // the big word, e.g. "INVOICE"
  message: string; // a note / thank-you under the total
  addressLines: string[]; // issuer postal address
  paymentTermsDays: number; // "due within N days"
  bankName: string;
  sortCode: string;
  accountNumber: string;
};

// Defaults approximate today's business invoice (coral wordmark, no bank block)
// so a business that hasn't opened the designer is essentially unchanged.
export const DEFAULT_INVOICE_DESIGN: InvoiceDesign = {
  template: "classic",
  brandColor: "#FF6B4A",
  font: "sans",
  logoEnabled: true,
  showTagline: true,
  tagline: "Property sales progression",
  showSalePrice: true,
  showExchangeDate: true,
  showBank: false,
  showTerms: true,
  title: "INVOICE",
  message: "",
  addressLines: [],
  paymentTermsDays: 14,
  bankName: "",
  sortCode: "",
  accountNumber: "",
};

const TEMPLATES: InvoiceTemplate[] = ["classic", "modern", "minimal"];
const HEX = /^#[0-9a-fA-F]{6}$/;

function str(v: unknown, fallback: string, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

// Validate + coerce an unknown JSON value into a complete InvoiceDesign, falling
// back to the defaults field-by-field. Never throws — a corrupt/partial value
// degrades to defaults, never a broken invoice.
export function parseInvoiceDesign(raw: unknown): InvoiceDesign {
  const d = DEFAULT_INVOICE_DESIGN;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  const template = TEMPLATES.includes(o.template as InvoiceTemplate) ? (o.template as InvoiceTemplate) : d.template;
  const brandColor = typeof o.brandColor === "string" && HEX.test(o.brandColor) ? o.brandColor : d.brandColor;
  const font = o.font === "serif" ? "serif" : "sans";
  const addressLines = Array.isArray(o.addressLines)
    ? o.addressLines.filter((l): l is string => typeof l === "string").slice(0, 6).map((l) => l.slice(0, 120))
    : d.addressLines;
  const termsRaw = typeof o.paymentTermsDays === "number" && Number.isFinite(o.paymentTermsDays) ? Math.round(o.paymentTermsDays) : d.paymentTermsDays;
  const paymentTermsDays = Math.min(120, Math.max(0, termsRaw));
  return {
    template,
    brandColor,
    font,
    logoEnabled: bool(o.logoEnabled, d.logoEnabled),
    showTagline: bool(o.showTagline, d.showTagline),
    tagline: str(o.tagline, d.tagline, 120),
    showSalePrice: bool(o.showSalePrice, d.showSalePrice),
    showExchangeDate: bool(o.showExchangeDate, d.showExchangeDate),
    showBank: bool(o.showBank, d.showBank),
    showTerms: bool(o.showTerms, d.showTerms),
    title: str(o.title, d.title, 24).trim() || d.title,
    message: str(o.message, d.message, 240),
    addressLines,
    paymentTermsDays,
    bankName: str(o.bankName, d.bankName, 120),
    sortCode: str(o.sortCode, d.sortCode, 16),
    accountNumber: str(o.accountNumber, d.accountNumber, 24),
  };
}

// Hex "#RRGGBB" → { r, g, b } in 0..1 for pdf-lib's rgb(). Falls back to the
// default brand on anything malformed.
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = HEX.test(hex) ? hex : DEFAULT_INVOICE_DESIGN.brandColor;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  return { r, g, b };
}
