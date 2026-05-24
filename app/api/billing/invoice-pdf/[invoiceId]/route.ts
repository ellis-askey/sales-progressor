// GET /api/billing/invoice-pdf/[invoiceId]
//
// Streams a PDF of a CLOSED invoice (status != "building"). Computed from
// the durable InvoiceLine rows + the associated CreditNote rows applied to
// this invoice — the historical record matching what was actually charged.
//
// Authorisation: the invoice must belong to the authenticated director's
// agency. Negotiators get 404.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf, type PdfLine } from "@/lib/billing/invoice-pdf";

function formatDateShort(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function formatMonth(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long", year: "numeric" }).format(d);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Director only" }, { status: 403 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return NextResponse.json({ error: "No agency on session" }, { status: 400 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, agencyId },
    select: {
      id: true,
      monthStart: true,
      status: true,
      issuedAt: true,
      paidAt: true,
      agency: { select: { name: true, vatRegisteredAt: true } },
      lines: {
        select: {
          kind: true,
          description: true,
          amountPence: true,
          vatPence: true,
          totalPence: true,
          transaction: { select: { exchangedAt: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const vatActive = invoice.agency.vatRegisteredAt !== null;
  const lines: PdfLine[] = invoice.lines.map((l) => {
    const isCredit = l.kind === "credit_applied";
    return {
      date: l.transaction?.exchangedAt ? formatDateShort(l.transaction.exchangedAt) : "",
      description: l.description,
      service: l.kind === "in_house_fee" ? "In-house" : l.kind === "outsourced_fee" ? "Outsourced" : "Credit",
      amountPence: l.totalPence,
      variant: isCredit ? "credit" : "normal",
    };
  });

  const subtotalPence = invoice.lines
    .filter((l) => l.kind !== "credit_applied")
    .reduce((s, l) => s + l.amountPence, 0);
  const vatPence = invoice.lines.reduce((s, l) => s + l.vatPence, 0);
  const creditsAppliedPence = -invoice.lines
    .filter((l) => l.kind === "credit_applied")
    .reduce((s, l) => s + l.totalPence, 0); // sum of negatives → flip sign for display
  const totalPence = invoice.lines.reduce((s, l) => s + l.totalPence, 0);

  const pdf = await renderInvoicePdf({
    invoiceLabel: invoice.id.slice(-12).toUpperCase(),
    periodLabel: formatMonth(invoice.monthStart),
    status: invoice.status,
    agencyName: invoice.agency.name,
    lines,
    subtotalPence,
    vatPence,
    vatActive,
    creditsAppliedPence,
    totalPence,
    generatedAt: `Generated ${formatDateShort(new Date())}`,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.monthStart.toISOString().slice(0, 7)}.pdf"`,
    },
  });
}
