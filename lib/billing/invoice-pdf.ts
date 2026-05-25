// lib/billing/invoice-pdf.ts
//
// Server-side invoice PDF rendering using @react-pdf/renderer. Same template
// shape as before; difference is that React is loaded via runtime
// `eval("require")("react")` and the JSX is rewritten as explicit
// `h(...)` (= React.createElement) calls.
//
// Why: Next.js 16 swaps every static `react` import for its vendored
// React 19 RSC build in server contexts. That React produces elements with
// `Symbol.for("react.transitional.element")` as $$typeof. But
// @react-pdf/reconciler (loaded externally from node_modules) uses
// react-reconciler-23 which checks for `Symbol.for("react.element")` —
// the project's actual React 18 symbol. The two don't match, and every
// element gets rejected with React error #31. Verified locally with a
// diagnostic route that printed both symbols side-by-side.
//
// Runtime `eval("require")("react")` is opaque to Next.js's bundler so the
// import isn't substituted; Node's module loader resolves "react" from
// node_modules at runtime — the same React @react-pdf/reconciler uses.
// $$typeof Symbol matches; elements are recognised; PDF renders.
//
// Two render modes: a "preview/proforma" for the current building invoice
// (computed live from PropertyTransaction rows via running-total), and a
// "final invoice" for issued/paid months (computed from durable InvoiceLine
// rows).

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

// Bypass Next.js bundler substitution; load Node's React 18 directly.
// See file header comment for the full why.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeReact = (eval("require") as (id: string) => unknown)("react") as {
  createElement: (
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ReactElement;
};
const h = NodeReact.createElement;

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  brandBlock: { flexDirection: "column" },
  brandName: { fontSize: 14, fontWeight: 600, color: "#FF6B4A", letterSpacing: 0.5 },
  brandSub: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  agencyBlock: { flexDirection: "column", alignItems: "flex-end" },
  agencyName: { fontSize: 11, fontWeight: 600 },
  agencyLabel: { fontSize: 8, color: "#6b7280", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },

  title: { fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#111827" },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 28 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaItem: { flexDirection: "column" },
  metaLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 11, fontWeight: 500, marginTop: 2 },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: 600,
  },
  statusBuilding: { backgroundColor: "#fef3c7", color: "#92400e" },
  statusIssued:   { backgroundColor: "#dbeafe", color: "#1e40af" },
  statusPaid:     { backgroundColor: "#d1fae5", color: "#065f46" },
  statusFailed:   { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusVoid:     { backgroundColor: "#e5e7eb", color: "#374151" },

  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 6,
    marginBottom: 6,
  },
  th: { fontSize: 8, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  td: { fontSize: 10 },
  trCredit: { backgroundColor: "#f9fafb" },
  trTrial: { backgroundColor: "#f9fafb" },
  colDate:    { width: "16%" },
  colDesc:    { width: "54%" },
  colService: { width: "18%", textAlign: "left" as const, color: "#6b7280", fontSize: 9 },
  colAmount:  { width: "12%", textAlign: "right" as const, fontWeight: 500 },
  amountMuted: { color: "#9ca3af" },
  amountCredit: { color: "#065f46" },

  totalsBlock: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end" },
  totalsInner: { width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalsLabel: { fontSize: 10, color: "#6b7280" },
  totalsValue: { fontSize: 10 },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  totalsGrandLabel: { fontSize: 12, fontWeight: 700 },
  totalsGrandValue: { fontSize: 14, fontWeight: 700 },

  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
});

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

function fmtPence(p: number): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const s = `£${(abs / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return neg ? `−${s}` : s;
}

function statusStyle(status: PdfInvoiceInput["status"]) {
  switch (status) {
    case "building": return styles.statusBuilding;
    case "issued":   return styles.statusIssued;
    case "paid":     return styles.statusPaid;
    case "failed":   return styles.statusFailed;
    case "void":     return styles.statusVoid;
  }
}

function statusLabel(status: PdfInvoiceInput["status"]): string {
  return status === "building" ? "Preview · building" : status;
}

function buildInvoiceTree(input: PdfInvoiceInput): ReactElement {
  // Rows
  const rows = input.lines.map((line, i) => {
    const isTrial = line.variant === "trial";
    const isCredit = line.variant === "credit";
    const rowStyle = isCredit
      ? [styles.tr, styles.trCredit]
      : isTrial
      ? [styles.tr, styles.trTrial]
      : styles.tr;
    const amountStyle = [
      styles.td,
      styles.colAmount,
      ...(isTrial ? [styles.amountMuted] : []),
      ...(isCredit ? [styles.amountCredit] : []),
    ];
    return h(
      View,
      { key: i, style: rowStyle },
      h(Text, { style: [styles.td, styles.colDate] }, line.date),
      h(Text, { style: [styles.td, styles.colDesc] }, line.description),
      h(Text, { style: [styles.td, styles.colService] }, line.service),
      h(Text, { style: amountStyle }, isTrial ? "Free" : fmtPence(line.amountPence)),
    );
  });

  // Totals children (conditional rows assembled as an array so no fragments)
  const totalsChildren: ReactElement[] = [
    h(
      View,
      { key: "subtotal", style: styles.totalsRow },
      h(Text, { style: styles.totalsLabel }, input.vatActive ? "Subtotal (ex-VAT)" : "Subtotal"),
      h(Text, { style: styles.totalsValue }, fmtPence(input.subtotalPence)),
    ),
  ];
  if (input.vatActive) {
    totalsChildren.push(
      h(
        View,
        { key: "vat", style: styles.totalsRow },
        h(Text, { style: styles.totalsLabel }, "VAT (20%)"),
        h(Text, { style: styles.totalsValue }, fmtPence(input.vatPence)),
      ),
    );
  }
  if (input.creditsAppliedPence > 0) {
    totalsChildren.push(
      h(
        View,
        { key: "credits", style: styles.totalsRow },
        h(Text, { style: styles.totalsLabel }, "Credits applied"),
        h(
          Text,
          { style: [styles.totalsValue, styles.amountCredit] },
          `−${fmtPence(input.creditsAppliedPence)}`,
        ),
      ),
    );
  }
  totalsChildren.push(
    h(
      View,
      { key: "grand", style: styles.totalsGrand },
      h(Text, { style: styles.totalsGrandLabel }, "Total"),
      h(Text, { style: styles.totalsGrandValue }, fmtPence(input.totalPence)),
    ),
  );

  return h(
    Document,
    { title: `Invoice ${input.invoiceLabel} — ${input.agencyName}`, author: "Sales Progressor" },
    h(
      Page,
      { size: "A4", style: styles.page },
      // Header
      h(
        View,
        { style: styles.header },
        h(
          View,
          { style: styles.brandBlock },
          h(Text, { style: styles.brandName }, "The Sales Progressor"),
          h(Text, { style: styles.brandSub }, "Sales progression for UK estate agencies"),
          h(Text, { style: styles.brandSub }, "updates@thesalesprogressor.co.uk"),
        ),
        h(
          View,
          { style: styles.agencyBlock },
          h(Text, { style: styles.agencyLabel }, "Billed to"),
          h(Text, { style: styles.agencyName }, input.agencyName),
        ),
      ),
      // Title
      h(Text, { style: styles.title }, "Invoice"),
      h(Text, { style: styles.subtitle }, input.periodLabel),
      // Meta row
      h(
        View,
        { style: styles.metaRow },
        h(
          View,
          { style: styles.metaItem },
          h(Text, { style: styles.metaLabel }, "Reference"),
          h(Text, { style: styles.metaValue }, input.invoiceLabel),
        ),
        h(
          View,
          { style: styles.metaItem },
          h(Text, { style: styles.metaLabel }, "Period"),
          h(Text, { style: styles.metaValue }, input.periodLabel),
        ),
        h(
          View,
          { style: styles.metaItem },
          h(Text, { style: styles.metaLabel }, "Status"),
          h(
            View,
            { style: [styles.statusPill, statusStyle(input.status)] },
            h(Text, null, statusLabel(input.status)),
          ),
        ),
      ),
      // Table header
      h(
        View,
        { style: styles.tableHeader },
        h(Text, { style: [styles.th, styles.colDate] }, "Date"),
        h(Text, { style: [styles.th, styles.colDesc] }, "File"),
        h(Text, { style: [styles.th, styles.colService] }, "Service"),
        h(Text, { style: [styles.th, styles.colAmount] }, "Fee"),
      ),
      // Rows
      ...rows,
      // Totals
      h(View, { style: styles.totalsBlock }, h(View, { style: styles.totalsInner }, ...totalsChildren)),
      // Footer
      h(
        View,
        { style: styles.footer, fixed: true },
        h(Text, null, "The Sales Progressor · thesalesprogressor.co.uk"),
        h(Text, null, input.generatedAt),
      ),
    ),
  );
}

/**
 * Render the invoice tree to a Node Buffer for the route handler to stream.
 */
export async function renderInvoicePdf(input: PdfInvoiceInput): Promise<Buffer> {
  return renderToBuffer(buildInvoiceTree(input));
}
