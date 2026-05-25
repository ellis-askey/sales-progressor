// Temporary route to verify the PDF renderer through the actual Next.js
// production code path (with the bundler + serverless runtime applied).
// No auth. Delete before commit.

import { NextResponse } from "next/server";
import { renderInvoicePdf } from "@/lib/billing/invoice-pdf";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pdf = await renderInvoicePdf({
      invoiceLabel: "TEST-ROUTE",
      periodLabel: "May 2026",
      status: "building",
      agencyName: "Hartwell & Partners",
      lines: [
        { date: "8 May", description: "12 Oak Lane, London", service: "In-house", amountPence: 5900, variant: "normal" },
        { date: "12 May", description: "48 Elm Avenue, London", service: "In-house", amountPence: 5900, variant: "normal" },
        { date: "15 May", description: "5 Birch Mews, Hartwell", service: "Free — trial", amountPence: 0, variant: "trial" },
        { date: "", description: "Pending credit (applies next month)", service: "Credit", amountPence: -35000, variant: "credit" },
      ],
      subtotalPence: 11800,
      vatPence: 2360,
      vatActive: true,
      creditsAppliedPence: 35000,
      totalPence: -20840,
      generatedAt: "Generated 25 May 2026",
    });
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (err) {
    console.error("[test/pdf-debug] FAILED:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "render failed", stack: err instanceof Error ? err.stack : null },
      { status: 500 },
    );
  }
}
