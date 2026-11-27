// Branded PDF for the invoice a progression business sends its client agencies.
// Self-contained (does NOT touch lib/billing/invoice-pdf.ts, the live agency
// path) and DESIGN-DRIVEN: it applies the business's InvoiceDesign — logo, brand
// colour, typeface, template header treatment, line-detail toggles, custom title
// + message, and a footer (payment terms / bank details). pdf-lib, bottom-up
// coordinates; a top-down `cursor` is converted at draw time.
//
// Logo note: pdf-lib embeds PNG + JPG only. SVG/WebP logos are skipped (the
// monogram-free header still renders); the upload route restricts to PNG/JPG so
// a saved logo always embeds.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { type InvoiceDesign, hexToRgb01 } from "./invoice-design";

export type BusinessInvoiceLine = {
  date: string; // exchange (or completion) date, preformatted e.g. "12 Nov"
  description: string; // property address
  subNote?: string; // optional second line, e.g. "£425,000 · completed 28 Nov"
  amountPence: number;
};

export type BusinessInvoicePdfInput = {
  invoiceLabel: string; // e.g. "NOV-2026"
  periodLabel: string; // e.g. "November 2026"
  generatedAt: string; // e.g. "27/11/2026"
  dueLabel?: string; // e.g. "11 Dec 2026"
  issuerName: string; // the business
  issuerContact: string; // the business email (may be "")
  agencyName: string; // bill-to
  lines: BusinessInvoiceLine[];
  subtotalPence: number;
  vatPence: number;
  vatActive: boolean;
  totalPence: number;
  vatNumber?: string;
  design: InvoiceDesign;
  logo?: { bytes: Uint8Array; mime: string } | null;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 56;
const M_TOP = 48;
const M_BOT = 48;
const CW = PAGE_W - MX * 2;
const LEFT = MX;
const RIGHT = PAGE_W - MX;

const INK = rgb(0.059, 0.106, 0.176); // #0F1B2D
const MUTED = rgb(0.541, 0.576, 0.639); // #8A93A3
const LABEL = rgb(0.627, 0.659, 0.706); // #A0A8B4
const BORDER = rgb(0.933, 0.941, 0.953); // #EEF0F3
const WHITE = rgb(1, 1, 1);

type Fonts = { reg: PDFFont; bold: PDFFont };

function fmtPence(p: number): string {
  const pounds = (Math.abs(p) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${p < 0 ? "-" : ""}£${pounds}`;
}
function fit(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  while (s.length && font.widthOfTextAtSize(s + "…", size) > maxW) s = s.slice(0, -1);
  return s + "…";
}
function topY(cursor: number, size: number): number {
  return PAGE_H - cursor - size;
}
function drawRight(page: PDFPage, text: string, rightX: number, cursor: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y: topY(cursor, size), size, font, color });
}

export async function renderBusinessInvoicePdf(input: BusinessInvoicePdfInput): Promise<Buffer> {
  const { design } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${input.invoiceLabel} - ${input.agencyName}`);
  doc.setAuthor(input.issuerName);

  const serif = design.font === "serif";
  const reg = await doc.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const bold = await doc.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const fonts: Fonts = { reg, bold };
  const { r, g, b } = hexToRgb01(design.brandColor);
  const brand = rgb(r, g, b);

  // Embed the logo if PNG/JPG (pdf-lib can't do SVG/WebP).
  let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (design.logoEnabled && input.logo) {
    try {
      if (input.logo.mime === "image/png") logoImg = await doc.embedPng(input.logo.bytes);
      else if (input.logo.mime === "image/jpeg" || input.logo.mime === "image/jpg") logoImg = await doc.embedJpg(input.logo.bytes);
    } catch { logoImg = null; }
  }
  const logoDims = logoImg ? logoImg.scale(Math.min(46 / logoImg.height, 170 / logoImg.width)) : null;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let cursor = M_TOP;

  // ── Header (per template) ──────────────────────────────────────────────────
  const modern = design.template === "modern";
  const minimal = design.template === "minimal";

  if (modern) {
    const bandH = 92;
    page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: brand });
    const hy = 30;
    if (logoDims) {
      // White plate behind the logo so a dark logo reads on the brand band.
      page.drawRectangle({ x: LEFT - 6, y: PAGE_H - hy - logoDims.height - 6, width: logoDims.width + 12, height: logoDims.height + 12, color: WHITE });
      page.drawImage(logoImg!, { x: LEFT, y: PAGE_H - hy - logoDims.height, width: logoDims.width, height: logoDims.height });
    } else {
      page.drawText(input.issuerName, { x: LEFT, y: topY(hy, 16), size: 16, font: fonts.bold, color: WHITE });
      if (design.showTagline && design.tagline) page.drawText(design.tagline, { x: LEFT, y: topY(hy + 22, 10), size: 10, font: fonts.reg, color: rgb(1, 1, 1) });
    }
    drawRight(page, design.title, RIGHT, hy, 20, fonts.bold, WHITE);
    drawRight(page, input.invoiceLabel, RIGHT, hy + 26, 11, fonts.reg, rgb(1, 1, 1));
    cursor = bandH + 26;
  } else {
    if (!minimal) {
      page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: brand });
      cursor = 28;
    }
    if (logoDims) {
      page.drawImage(logoImg!, { x: LEFT, y: PAGE_H - cursor - logoDims.height, width: logoDims.width, height: logoDims.height });
    } else {
      page.drawText(input.issuerName, { x: LEFT, y: topY(cursor, 15), size: 15, font: fonts.bold, color: INK });
      if (design.showTagline && design.tagline) page.drawText(design.tagline, { x: LEFT, y: topY(cursor + 20, 9), size: 9, font: fonts.reg, color: MUTED });
    }
    // Right: title + number
    drawRight(page, design.title, RIGHT, cursor, minimal ? 13 : 18, fonts.bold, minimal ? MUTED : brand);
    drawRight(page, input.invoiceLabel, RIGHT, cursor + (minimal ? 18 : 24), 11, fonts.reg, INK);
    cursor += 52;
    if (minimal) {
      page.drawLine({ start: { x: LEFT, y: PAGE_H - cursor }, end: { x: RIGHT, y: PAGE_H - cursor }, color: BORDER, thickness: 1 });
      cursor += 18;
    }
  }

  // ── From / Bill to ─────────────────────────────────────────────────────────
  const colR = LEFT + CW * 0.52;
  const block = (x: number, label: string, lines: string[]) => {
    page.drawText(label.toUpperCase(), { x, y: topY(cursor, 8), size: 8, font: fonts.bold, color: LABEL });
    let yy = cursor + 14;
    lines.forEach((l, i) => {
      page.drawText(fit(l, i === 0 ? fonts.bold : fonts.reg, i === 0 ? 11 : 10, CW * 0.46), { x, y: topY(yy, i === 0 ? 11 : 10), size: i === 0 ? 11 : 10, font: i === 0 ? fonts.bold : fonts.reg, color: i === 0 ? INK : rgb(0.33, 0.38, 0.49) });
      yy += i === 0 ? 15 : 13;
    });
    return yy;
  };
  const fromLines = [input.issuerName, ...design.addressLines];
  if (input.issuerContact) fromLines.push(input.issuerContact);
  if (input.vatNumber) fromLines.push(`VAT ${input.vatNumber}`);
  const yFrom = block(LEFT, "From", fromLines);
  const yTo = block(colR, "Bill to", [input.agencyName]);
  cursor = Math.max(yFrom, yTo) + 10;

  // ── Meta row ───────────────────────────────────────────────────────────────
  const metas: [string, string][] = [["Period", input.periodLabel], ["Issued", input.generatedAt]];
  if (input.dueLabel) metas.push(["Due", input.dueLabel]);
  let mx = LEFT;
  for (const [k, v] of metas) {
    page.drawText(k.toUpperCase(), { x: mx, y: topY(cursor, 8), size: 8, font: fonts.bold, color: LABEL });
    page.drawText(v, { x: mx, y: topY(cursor + 12, 10), size: 10, font: fonts.reg, color: INK });
    mx += 150;
  }
  cursor += 34;

  // ── Table ──────────────────────────────────────────────────────────────────
  const showDate = design.showExchangeDate;
  const descX = LEFT;
  const dateX = showDate ? RIGHT - 190 : 0;
  const drawTableHead = () => {
    page.drawText("SALE PROGRESSED", { x: descX, y: topY(cursor, 8), size: 8, font: fonts.bold, color: LABEL });
    if (showDate) page.drawText("EXCHANGED", { x: dateX, y: topY(cursor, 8), size: 8, font: fonts.bold, color: LABEL });
    drawRight(page, "FEE", RIGHT, cursor, 8, fonts.bold, LABEL);
    cursor += 14;
    page.drawLine({ start: { x: LEFT, y: PAGE_H - cursor }, end: { x: RIGHT, y: PAGE_H - cursor }, color: minimal ? BORDER : brand, thickness: minimal ? 1 : 1.5 });
    cursor += 10;
  };
  drawTableHead();

  const ROW_LIMIT = PAGE_H - M_BOT - 170; // leave room for totals/footer
  for (const line of input.lines) {
    const rowH = line.subNote ? 30 : 22;
    if (cursor + rowH > ROW_LIMIT) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      cursor = M_TOP;
      drawTableHead();
    }
    page.drawText(fit(line.description, fonts.bold, 10.5, (showDate ? dateX - descX : RIGHT - 70 - descX) - 8), { x: descX, y: topY(cursor, 10.5), size: 10.5, font: fonts.bold, color: INK });
    if (line.subNote) page.drawText(fit(line.subNote, fonts.reg, 9, CW * 0.5), { x: descX, y: topY(cursor + 13, 9), size: 9, font: fonts.reg, color: MUTED });
    if (showDate) page.drawText(line.date, { x: dateX, y: topY(cursor, 10), size: 10, font: fonts.reg, color: rgb(0.33, 0.38, 0.49) });
    drawRight(page, fmtPence(line.amountPence), RIGHT, cursor, 10.5, fonts.bold, INK);
    cursor += rowH;
    page.drawLine({ start: { x: LEFT, y: PAGE_H - cursor + 6 }, end: { x: RIGHT, y: PAGE_H - cursor + 6 }, color: BORDER, thickness: 0.5 });
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  cursor += 10;
  const totalsLeft = RIGHT - 230;
  const row = (label: string, value: string, strong = false) => {
    page.drawText(label, { x: totalsLeft, y: topY(cursor, strong ? 12 : 10), size: strong ? 12 : 10, font: strong ? fonts.bold : fonts.reg, color: strong ? INK : MUTED });
    drawRight(page, value, RIGHT, cursor, strong ? 14 : 10, strong ? fonts.bold : fonts.reg, strong ? brand : INK);
    cursor += strong ? 20 : 16;
  };
  row("Subtotal", fmtPence(input.subtotalPence));
  if (input.vatActive) row(`VAT (${((input.vatPence / Math.max(1, input.subtotalPence)) * 100).toFixed(0)}%)`, fmtPence(input.vatPence));
  cursor += 2;
  page.drawLine({ start: { x: totalsLeft, y: PAGE_H - cursor }, end: { x: RIGHT, y: PAGE_H - cursor }, color: INK, thickness: 1 });
  cursor += 10;
  row("Total due", fmtPence(input.totalPence), true);

  // ── Message ────────────────────────────────────────────────────────────────
  if (design.message.trim()) {
    cursor += 8;
    page.drawText(fit(design.message.trim(), fonts.reg, 10.5, CW), { x: LEFT, y: topY(cursor, 10.5), size: 10.5, font: fonts.reg, color: rgb(0.33, 0.38, 0.49) });
    cursor += 18;
  }

  // ── Footer (terms / bank) ──────────────────────────────────────────────────
  const hasTerms = design.showTerms;
  const hasBank = design.showBank && (design.bankName || design.accountNumber);
  if (hasTerms || hasBank) {
    cursor += 10;
    page.drawLine({ start: { x: LEFT, y: PAGE_H - cursor }, end: { x: RIGHT, y: PAGE_H - cursor }, color: BORDER, thickness: 0.5 });
    cursor += 14;
    const startCursor = cursor;
    if (hasTerms) {
      page.drawText("PAYMENT TERMS", { x: LEFT, y: topY(cursor, 8), size: 8, font: fonts.bold, color: rgb(0.33, 0.38, 0.49) });
      page.drawText(`Due within ${design.paymentTermsDays} days of issue.`, { x: LEFT, y: topY(cursor + 13, 9.5), size: 9.5, font: fonts.reg, color: MUTED });
    }
    if (hasBank) {
      const bx = LEFT + CW * 0.52;
      page.drawText("BANK TRANSFER", { x: bx, y: topY(startCursor, 8), size: 8, font: fonts.bold, color: rgb(0.33, 0.38, 0.49) });
      if (design.bankName) page.drawText(fit(design.bankName, fonts.reg, 9.5, CW * 0.46), { x: bx, y: topY(startCursor + 13, 9.5), size: 9.5, font: fonts.reg, color: MUTED });
      const acc = [design.sortCode && `Sort ${design.sortCode}`, design.accountNumber && `Acc ${design.accountNumber}`].filter(Boolean).join(" · ");
      if (acc) page.drawText(acc, { x: bx, y: topY(startCursor + 26, 9.5), size: 9.5, font: fonts.reg, color: MUTED });
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
