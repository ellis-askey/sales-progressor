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
    console.log("Rendering test PDF...");
    const pdf = await renderInvoicePdf({
      invoiceLabel: "TEST-LOCAL",
      periodLabel: "May 2026",
      status: "building",
      agencyName: "Hartwell & Partners",
      lines: [
        { date: "8 May", description: "12 Oak Lane, London", service: "In-house", amountPence: 5900, variant: "normal" },
        { date: "12 May", description: "48 Elm Avenue, London", service: "In-house", amountPence: 5900, variant: "normal" },
        { date: "15 May", description: "5 Birch Mews, Hartwell", service: "Free — trial", amountPence: 0, variant: "trial" },
        { date: "", description: "Pending credit (applies next month)", service: "Credit", amountPence: -35000, variant: "credit" },
      ],
      subtotalPence: 9834,
      vatPence: 1966,
      vatActive: true,
      creditsAppliedPence: 35000,
      totalPence: -23200,
      generatedAt: "Generated 25 May 2026",
    });
    const outPath = "test-invoice-output.pdf";
    writeFileSync(outPath, pdf);
    console.log(`✓ PDF rendered ok, ${pdf.length} bytes, written to ${outPath}`);
  } catch (err) {
    console.error("✗ PDF render failed:");
    console.error(err);
    process.exit(1);
  }
}

void main();
