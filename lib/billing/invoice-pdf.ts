// lib/billing/invoice-pdf.ts
//
// Server-side invoice PDF rendering using pdf-lib. Pure JavaScript PDF
// construction — no React, no JSX, no reconciler. This avoids the entire
// class of React-version-mismatch bugs that broke @react-pdf/renderer
// under Next.js 16 (which vendors its own React 19 for RSC and substitutes
// any static `import "react"` in server code — the reconciler then rejected
// every element because Symbol.for("react.element") didn't match
// Symbol.for("react.transitional.element")).
//
// Layout mirrors the previous template visually: branded header with the
// coral wordmark + agency block on the right, "Invoice" title, period
// subtitle, meta row (reference / period / status pill), line table
// (Date / File / Service / Fee), totals block right-aligned, footer with
// brand + generation timestamp. Multi-page support: a new page is added
// with footer + repeated table header once rows would overflow.
//
// pdf-lib uses bottom-up coordinates (origin bottom-left, y grows up).
// Internally we track a top-down `cursor` measured from the top of the
// page and convert to pdf-lib's y at the point of drawing.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type PdfLine = {
  date: string;
  description: string;
  service: string;
  amountPence: number;
  variant?: "normal" | "trial" | "credit";
};

export type PdfInvoiceInput = {
  invoiceLabel: string;
  periodLabel: string;
  status: "building" | "issued" | "paid" | "failed" | "void";
  agencyName: string;
  lines: PdfLine[];
  subtotalPence: number;
  vatPence: number;
  vatActive: boolean;
  creditsAppliedPence: number;
  totalPence: number;
  generatedAt: string;
};

// A4 in PDF points (1 pt = 1/72 inch)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_LEFT = MARGIN_X;
const CONTENT_RIGHT = PAGE_W - MARGIN_X;

// Column geometry (table)
const COL_DATE_X = CONTENT_LEFT;
const COL_DATE_W = CONTENT_W * 0.16;
const COL_DESC_X = COL_DATE_X + COL_DATE_W;
const COL_DESC_W = CONTENT_W * 0.54;
const COL_SERVICE_X = COL_DESC_X + COL_DESC_W;
const COL_SERVICE_W = CONTENT_W * 0.18;
const COL_FEE_RIGHT = CONTENT_RIGHT;

// Colors (match previous styles object)
const COLOR_TEXT = rgb(0.067, 0.094, 0.153);          // #111827
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);             // #6b7280
const COLOR_BORDER = rgb(0.898, 0.906, 0.922);        // #e5e7eb
const COLOR_BORDER_DARK = rgb(0.067, 0.094, 0.153);   // #111827
const COLOR_CORAL = rgb(1.0, 0.42, 0.29);             // #FF6B4A
const COLOR_CREDIT_GREEN = rgb(0.024, 0.376, 0.275);  // #065f46
const COLOR_AMOUNT_MUTED = rgb(0.612, 0.639, 0.686);  // #9ca3af
const COLOR_ROW_TINT = rgb(0.976, 0.98, 0.984);       // #f9fafb

const STATUS_STYLES: Record<
  PdfInvoiceInput["status"],
  { bg: ReturnType<typeof rgb>; fg: ReturnType<typeof rgb>; label: string }
> = {
  building: { bg: rgb(0.996, 0.953, 0.78),  fg: rgb(0.573, 0.255, 0.055), label: "PREVIEW . BUILDING" },
  issued:   { bg: rgb(0.859, 0.918, 0.996), fg: rgb(0.118, 0.251, 0.686), label: "ISSUED" },
  paid:     { bg: rgb(0.82, 0.98, 0.9),     fg: rgb(0.024, 0.376, 0.275), label: "PAID" },
  failed:   { bg: rgb(0.996, 0.898, 0.898), fg: rgb(0.6, 0.106, 0.106),   label: "FAILED" },
  void:     { bg: rgb(0.898, 0.906, 0.922), fg: rgb(0.216, 0.255, 0.318), label: "VOID" },
};

// Format pence as £x.xx. Use ASCII hyphen for negatives — the Unicode minus
// (U+2212) used previously isn't in WinAnsi, which is the encoding the
// Standard 14 PDF fonts use, and would throw at draw time.
function fmtPence(p: number): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const pounds = (abs / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return neg ? `-£${pounds}` : `£${pounds}`;
}

// Truncate a string with "..." so its rendered width fits maxWidth.
function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "...";
  let s = text;
  while (s.length > 0 && font.widthOfTextAtSize(s + ellipsis, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + ellipsis;
}

type Fonts = { regular: PDFFont; bold: PDFFont };

// Convert top-down y (measured from top of page) to pdf-lib's bottom-up y.
function topY(cursorFromTop: number, textSize: number): number {
  // textSize approximates the ascent — placing baseline at cursor + textSize
  // gives text whose visual top aligns with the cursor.
  return PAGE_H - cursorFromTop - textSize;
}

function drawHeader(page: PDFPage, fonts: Fonts, agencyName: string, yTop: number): number {
  // Left brand block
  page.drawText("The Sales Progressor", {
    x: CONTENT_LEFT, y: topY(yTop, 14), size: 14, font: fonts.bold, color: COLOR_CORAL,
  });
  const line2Y = yTop + 14 + 4;
  page.drawText("Sales progression for UK estate agencies", {
    x: CONTENT_LEFT, y: topY(line2Y, 9), size: 9, font: fonts.regular, color: COLOR_MUTED,
  });
  const line3Y = line2Y + 9 + 2;
  page.drawText("updates@thesalesprogressor.co.uk", {
    x: CONTENT_LEFT, y: topY(line3Y, 9), size: 9, font: fonts.regular, color: COLOR_MUTED,
  });

  // Right agency block (right-aligned, aligned with top of brand block)
  const labelText = "BILLED TO";
  const labelW = fonts.regular.widthOfTextAtSize(labelText, 8);
  page.drawText(labelText, {
    x: CONTENT_RIGHT - labelW, y: topY(yTop + 2, 8), size: 8, font: fonts.regular, color: COLOR_MUTED,
  });
  const nameW = fonts.bold.widthOfTextAtSize(agencyName, 11);
  page.drawText(agencyName, {
    x: CONTENT_RIGHT - nameW, y: topY(yTop + 2 + 8 + 4, 11), size: 11, font: fonts.bold, color: COLOR_TEXT,
  });

  return line3Y + 9; // bottom of left block
}

function drawTitle(page: PDFPage, fonts: Fonts, periodLabel: string, yTop: number): number {
  page.drawText("Invoice", {
    x: CONTENT_LEFT, y: topY(yTop, 20), size: 20, font: fonts.bold, color: COLOR_TEXT,
  });
  const subY = yTop + 20 + 4;
  page.drawText(periodLabel, {
    x: CONTENT_LEFT, y: topY(subY, 11), size: 11, font: fonts.regular, color: COLOR_MUTED,
  });
  return subY + 11;
}

function drawMetaRow(page: PDFPage, fonts: Fonts, input: PdfInvoiceInput, yTop: number): number {
  const col1X = CONTENT_LEFT;
  const col2X = CONTENT_LEFT + CONTENT_W * 0.4;
  const col3Right = CONTENT_RIGHT;

  page.drawText("REFERENCE", { x: col1X, y: topY(yTop, 8), size: 8, font: fonts.regular, color: COLOR_MUTED });
  page.drawText("PERIOD", { x: col2X, y: topY(yTop, 8), size: 8, font: fonts.regular, color: COLOR_MUTED });
  const statusLabel = "STATUS";
  const slw = fonts.regular.widthOfTextAtSize(statusLabel, 8);
  page.drawText(statusLabel, {
    x: col3Right - slw, y: topY(yTop, 8), size: 8, font: fonts.regular, color: COLOR_MUTED,
  });

  const valTop = yTop + 8 + 4;
  page.drawText(input.invoiceLabel, {
    x: col1X, y: topY(valTop, 11), size: 11, font: fonts.regular, color: COLOR_TEXT,
  });
  page.drawText(input.periodLabel, {
    x: col2X, y: topY(valTop, 11), size: 11, font: fonts.regular, color: COLOR_TEXT,
  });

  // Status pill, right-aligned
  const status = STATUS_STYLES[input.status];
  const pillTextSize = 8;
  const pillTextW = fonts.bold.widthOfTextAtSize(status.label, pillTextSize);
  const pillPadX = 8;
  const pillPadY = 3;
  const pillW = pillTextW + pillPadX * 2;
  const pillH = pillTextSize + pillPadY * 2;
  const pillX = col3Right - pillW;
  const pillTopY = valTop;
  page.drawRectangle({
    x: pillX, y: PAGE_H - pillTopY - pillH, width: pillW, height: pillH,
    color: status.bg,
  });
  page.drawText(status.label, {
    x: pillX + pillPadX,
    y: PAGE_H - pillTopY - pillH + pillPadY,
    size: pillTextSize,
    font: fonts.bold,
    color: status.fg,
  });

  return valTop + 11;
}

function drawTableHeader(page: PDFPage, fonts: Fonts, yTop: number): number {
  const labelTopY = yTop;
  page.drawText("DATE", { x: COL_DATE_X, y: topY(labelTopY, 8), size: 8, font: fonts.bold, color: COLOR_MUTED });
  page.drawText("FILE", { x: COL_DESC_X, y: topY(labelTopY, 8), size: 8, font: fonts.bold, color: COLOR_MUTED });
  page.drawText("SERVICE", { x: COL_SERVICE_X, y: topY(labelTopY, 8), size: 8, font: fonts.bold, color: COLOR_MUTED });
  const feeText = "FEE";
  const feeW = fonts.bold.widthOfTextAtSize(feeText, 8);
  page.drawText(feeText, { x: COL_FEE_RIGHT - feeW, y: topY(labelTopY, 8), size: 8, font: fonts.bold, color: COLOR_MUTED });

  const lineY = PAGE_H - (yTop + 8 + 6);
  page.drawLine({
    start: { x: CONTENT_LEFT, y: lineY }, end: { x: CONTENT_RIGHT, y: lineY },
    color: COLOR_BORDER_DARK, thickness: 1,
  });
  return yTop + 8 + 6 + 6;
}

const ROW_HEIGHT = 24;

function drawRow(page: PDFPage, fonts: Fonts, line: PdfLine, yTop: number): number {
  const isCredit = line.variant === "credit";
  const isTrial = line.variant === "trial";

  if (isCredit || isTrial) {
    page.drawRectangle({
      x: CONTENT_LEFT,
      y: PAGE_H - yTop - ROW_HEIGHT,
      width: CONTENT_W,
      height: ROW_HEIGHT,
      color: COLOR_ROW_TINT,
    });
  }

  const textTopY = yTop + 8;
  page.drawText(line.date, {
    x: COL_DATE_X, y: topY(textTopY, 10), size: 10, font: fonts.regular, color: COLOR_TEXT,
  });
  const desc = fitText(line.description, fonts.regular, 10, COL_DESC_W - 6);
  page.drawText(desc, {
    x: COL_DESC_X, y: topY(textTopY, 10), size: 10, font: fonts.regular, color: COLOR_TEXT,
  });
  const svc = fitText(line.service, fonts.regular, 9, COL_SERVICE_W - 6);
  page.drawText(svc, {
    x: COL_SERVICE_X, y: topY(textTopY, 9), size: 9, font: fonts.regular, color: COLOR_MUTED,
  });

  const amountText = isTrial ? "Free" : fmtPence(line.amountPence);
  const amountColor = isTrial ? COLOR_AMOUNT_MUTED : isCredit ? COLOR_CREDIT_GREEN : COLOR_TEXT;
  const amountFont = isTrial ? fonts.regular : fonts.bold;
  const amountW = amountFont.widthOfTextAtSize(amountText, 10);
  page.drawText(amountText, {
    x: COL_FEE_RIGHT - amountW, y: topY(textTopY, 10), size: 10, font: amountFont, color: amountColor,
  });

  const borderY = PAGE_H - (yTop + ROW_HEIGHT);
  page.drawLine({
    start: { x: CONTENT_LEFT, y: borderY }, end: { x: CONTENT_RIGHT, y: borderY },
    color: COLOR_BORDER, thickness: 0.5,
  });

  return yTop + ROW_HEIGHT;
}

function drawTotals(page: PDFPage, fonts: Fonts, input: PdfInvoiceInput, yTop: number): number {
  const blockW = CONTENT_W * 0.45;
  const blockLeft = CONTENT_RIGHT - blockW;
  const valueRight = CONTENT_RIGHT;

  let y = yTop + 16;

  const drawTotalRow = (label: string, value: string, valueColor?: ReturnType<typeof rgb>) => {
    page.drawText(label, {
      x: blockLeft, y: topY(y + 4, 10), size: 10, font: fonts.regular, color: COLOR_MUTED,
    });
    const vw = fonts.regular.widthOfTextAtSize(value, 10);
    page.drawText(value, {
      x: valueRight - vw, y: topY(y + 4, 10), size: 10, font: fonts.regular, color: valueColor ?? COLOR_TEXT,
    });
    y += 10 + 8;
  };

  // Subtotal + Credits rows only render when credits apply (math has to read).
  // Otherwise the totals block collapses to just the grand Total. vatActive /
  // vatPence are intentionally not rendered: Sales Progressor is not
  // VAT-registered and the headline fee IS the price (no breakdown, no
  // disclaimer). The fields remain on PdfInvoiceInput so route handlers stay
  // unchanged; they are dormant until VAT registration ever happens.
  //
  // Subtotal here means "sum of gross line fees before credits" — computed
  // as totalPence + creditsAppliedPence rather than read from the dormant
  // input.subtotalPence (which on VAT-on agencies is the ex-VAT amount and
  // would visibly fail to add up with Credits to Total).
  if (input.creditsAppliedPence > 0) {
    const grossBeforeCredits = input.totalPence + input.creditsAppliedPence;
    drawTotalRow("Subtotal", fmtPence(grossBeforeCredits));
    drawTotalRow("Credits applied", `-${fmtPence(input.creditsAppliedPence)}`, COLOR_CREDIT_GREEN);
  }

  // Grand total with top border
  y += 6;
  const borderY = PAGE_H - y;
  page.drawLine({
    start: { x: blockLeft, y: borderY }, end: { x: CONTENT_RIGHT, y: borderY },
    color: COLOR_BORDER_DARK, thickness: 1,
  });
  y += 10;

  page.drawText("Total", {
    x: blockLeft, y: topY(y, 12), size: 12, font: fonts.bold, color: COLOR_TEXT,
  });
  const grandVal = fmtPence(input.totalPence);
  const gvw = fonts.bold.widthOfTextAtSize(grandVal, 14);
  page.drawText(grandVal, {
    x: valueRight - gvw, y: topY(y, 14), size: 14, font: fonts.bold, color: COLOR_TEXT,
  });

  return y + 14;
}

function drawFooter(page: PDFPage, fonts: Fonts, generatedAt: string): void {
  const baseY = MARGIN_BOTTOM - 16;
  // Divider above the footer text
  page.drawLine({
    start: { x: CONTENT_LEFT, y: baseY + 16 },
    end: { x: CONTENT_RIGHT, y: baseY + 16 },
    color: COLOR_BORDER,
    thickness: 0.5,
  });
  page.drawText("The Sales Progressor · thesalesprogressor.co.uk", {
    x: CONTENT_LEFT, y: baseY, size: 8, font: fonts.regular, color: COLOR_AMOUNT_MUTED,
  });
  const gw = fonts.regular.widthOfTextAtSize(generatedAt, 8);
  page.drawText(generatedAt, {
    x: CONTENT_RIGHT - gw, y: baseY, size: 8, font: fonts.regular, color: COLOR_AMOUNT_MUTED,
  });
}

export async function renderInvoicePdf(input: PdfInvoiceInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${input.invoiceLabel} - ${input.agencyName}`);
  doc.setAuthor("Sales Progressor");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular, bold };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawFooter(page, fonts, input.generatedAt);

  let cursor = MARGIN_TOP;
  cursor = drawHeader(page, fonts, input.agencyName, cursor);
  cursor += 32;
  cursor = drawTitle(page, fonts, input.periodLabel, cursor);
  cursor += 28;
  cursor = drawMetaRow(page, fonts, input, cursor);
  cursor += 20;
  cursor = drawTableHeader(page, fonts, cursor);

  // Reserve room above footer when paging.
  const ROW_BOTTOM_LIMIT = PAGE_H - MARGIN_BOTTOM - 16;

  for (const line of input.lines) {
    if (cursor + ROW_HEIGHT > ROW_BOTTOM_LIMIT) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawFooter(page, fonts, input.generatedAt);
      cursor = MARGIN_TOP;
      cursor = drawTableHeader(page, fonts, cursor);
    }
    cursor = drawRow(page, fonts, line, cursor);
  }

  // Totals need ~140pt; new page if no room.
  if (cursor + 140 > ROW_BOTTOM_LIMIT) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawFooter(page, fonts, input.generatedAt);
    cursor = MARGIN_TOP;
  }
  drawTotals(page, fonts, input, cursor);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
