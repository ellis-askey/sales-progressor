// Quick local test that the PDF renderer actually works in this Node env.
// Bypasses the route handler / Stripe / Prisma — just exercises
// renderInvoicePdf with a fake input. If this works locally but staging
// still 500s, the issue is serverless-specific.
//
// Run: npx ts-node --transpile-only --compiler-options '{"module":"CommonJS",
//   "moduleResolution":"node","baseUrl":".","paths":{"@/*":["./*"]}}'
//   --require tsconfig-paths/register scripts/test-pdf-render-locally.ts

import { writeFileSync } from "node:fs";
import { renderInvoicePdf } from "../lib/billing/invoice-pdf";

async function main() {
  try {
    console.log("Rendering test PDF (with credits)...");
    const pdfWithCredits = await renderInvoicePdf({
      invoiceLabel: "TEST-CREDITS",
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
      vatPence: 0,
      vatActive: false,
      creditsAppliedPence: 35000,
      totalPence: -23200,
      generatedAt: "Generated 25 May 2026",
    });
    writeFileSync("test-invoice-with-credits.pdf", pdfWithCredits);
    console.log(`✓ with-credits PDF: ${pdfWithCredits.length} bytes`);

    console.log("Rendering test PDF (no credits)...");
    const pdfNoCredits = await renderInvoicePdf({
      invoiceLabel: "TEST-NOCREDITS",
      periodLabel: "May 2026",
      status: "issued",
      agencyName: "Marlow & Co",
      lines: [
        { date: "8 May", description: "12 Oak Lane, London", service: "In-house", amountPence: 5900, variant: "normal" },
        { date: "12 May", description: "48 Elm Avenue, London", service: "In-house", amountPence: 5900, variant: "normal" },
      ],
      subtotalPence: 11800,
      vatPence: 0,
      vatActive: false,
      creditsAppliedPence: 0,
      totalPence: 11800,
      generatedAt: "Generated 25 May 2026",
    });
    writeFileSync("test-invoice-no-credits.pdf", pdfNoCredits);
    console.log(`✓ no-credits PDF: ${pdfNoCredits.length} bytes`);
  } catch (err) {
    console.error("✗ PDF render failed:");
    console.error(err);
    process.exit(1);
  }
}

void main();
