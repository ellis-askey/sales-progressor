/* eslint-disable react/no-unknown-property */
// lib/billing/invoice-pdf.tsx
//
// Server-side invoice PDF rendering using @react-pdf/renderer. A standalone
// React component tree (no DOM, no agent-system.css) that produces a clean
// branded PDF: header (agency + Sales Progressor), invoice metadata, line
// rows (date, property, service, fee), credits, totals, status.
//
// Two render modes: a "preview/proforma" for the current building invoice
// (computed live from PropertyTransaction rows via running-total), and a
// "final invoice" for issued/paid months (computed from durable
// InvoiceLine rows).
//
// Called by app/api/billing/invoice-pdf/[invoiceId]/route.ts (final) and
// app/api/billing/invoice-pdf/preview/route.ts (building). Both stream the
// PDF as application/pdf with a Content-Disposition that downloads.

import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";
import type { ReactElement } from "react";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  // Header
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

  // Title + meta
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#111827" },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 28 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaItem: { flexDirection: "column" },
  metaLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 11, fontWeight: 500, marginTop: 2 },

  // Status pill
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

  // Table
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

  // Totals
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

  // Footer
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
  date: string;             // "8 May 2026"
  description: string;      // "12 Oak Lane, London"
  service: string;          // "In-house" / "Outsourced — £350k–£499k" / "Trial — free" / "Credit applied"
  amountPence: number;      // gross. Negative for credits. Zero for trial.
  variant?: "normal" | "trial" | "credit";
};

export type PdfInvoiceInput = {
  /** "Preview / Proforma" for building invoices, otherwise the proper id. */
  invoiceLabel: string;
  /** "May 2026" (London month). */
  periodLabel: string;
  /** "building" | "issued" | "paid" | "failed" | "void". */
  status: "building" | "issued" | "paid" | "failed" | "void";
  agencyName: string;
  lines: PdfLine[];
  /** When VAT-registered, subtotal = sum of ex-VAT amounts. Otherwise = totalPence. */
  subtotalPence: number;
  vatPence: number;
  vatActive: boolean;
  /** Sum of negative credit lines (positive number representing absolute value). 0 if none. */
  creditsAppliedPence: number;
  totalPence: number;
  /** Footer-only timestamp ("Generated 25 May 2026 14:32"). */
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

export function InvoicePdf(input: PdfInvoiceInput): ReactElement {
  return (
    <Document title={`Invoice ${input.invoiceLabel} — ${input.agencyName}`} author="Sales Progressor">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>The Sales Progressor</Text>
            <Text style={styles.brandSub}>Sales progression for UK estate agencies</Text>
            <Text style={styles.brandSub}>updates@thesalesprogressor.co.uk</Text>
          </View>
          <View style={styles.agencyBlock}>
            <Text style={styles.agencyLabel}>Billed to</Text>
            <Text style={styles.agencyName}>{input.agencyName}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Invoice</Text>
        <Text style={styles.subtitle}>{input.periodLabel}</Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Reference</Text>
            <Text style={styles.metaValue}>{input.invoiceLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>{input.periodLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <View style={[styles.statusPill, statusStyle(input.status)]}>
              <Text>{statusLabel(input.status)}</Text>
            </View>
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colDesc]}>File</Text>
          <Text style={[styles.th, styles.colService]}>Service</Text>
          <Text style={[styles.th, styles.colAmount]}>Fee</Text>
        </View>

        {/* Rows */}
        {input.lines.map((line, i) => {
          const isTrial = line.variant === "trial";
          const isCredit = line.variant === "credit";
          const rowStyle = isCredit ? [styles.tr, styles.trCredit] : isTrial ? [styles.tr, styles.trTrial] : styles.tr;
          const amountStyle = [
            styles.td,
            styles.colAmount,
            ...(isTrial ? [styles.amountMuted] : []),
            ...(isCredit ? [styles.amountCredit] : []),
          ];
          return (
            <View key={i} style={rowStyle}>
              <Text style={[styles.td, styles.colDate]}>{line.date}</Text>
              <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.td, styles.colService]}>{line.service}</Text>
              <Text style={amountStyle}>
                {isTrial ? "Free" : fmtPence(line.amountPence)}
              </Text>
            </View>
          );
        })}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsInner}>
            {/* react-pdf reconciler doesn't accept React Fragments in
                production builds (error #31). Each row rendered conditionally
                as its own element instead. */}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{input.vatActive ? "Subtotal (ex-VAT)" : "Subtotal"}</Text>
              <Text style={styles.totalsValue}>{fmtPence(input.subtotalPence)}</Text>
            </View>
            {input.vatActive && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>VAT (20%)</Text>
                <Text style={styles.totalsValue}>{fmtPence(input.vatPence)}</Text>
              </View>
            )}
            {input.creditsAppliedPence > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Credits applied</Text>
                <Text style={[styles.totalsValue, styles.amountCredit]}>−{fmtPence(input.creditsAppliedPence)}</Text>
              </View>
            )}
            <View style={styles.totalsGrand}>
              <Text style={styles.totalsGrandLabel}>Total</Text>
              <Text style={styles.totalsGrandValue}>{fmtPence(input.totalPence)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>The Sales Progressor · thesalesprogressor.co.uk</Text>
          <Text>{input.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Render the React PDF tree to a Node Buffer for the route handler to stream.
 * Passes a JSX ELEMENT (not a pre-rendered tree) so react-pdf's reconciler
 * mounts the component through its proper render lifecycle. Calling
 * `InvoicePdf(input)` directly returns a Document element which can confuse
 * the reconciler in production (minified React error #31).
 */
export async function renderInvoicePdf(input: PdfInvoiceInput): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf {...input} />);
}
