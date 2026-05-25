// GET /api/billing/invoice-pdf/preview
//
// Streams a PDF of the CURRENT building invoice for the authenticated
// director's agency. Computed live from PropertyTransaction rows (same
// source-of-truth as the running-total page), wrapped as a preview /
// proforma PDF — explicitly marked "Preview · building" in the status pill.
//
// Director-only. Negotiators get 404. Returns 503 if no agency on session.
//
// Streams as application/pdf with Content-Disposition: attachment so the
// browser downloads.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf, type PdfLine } from "@/lib/billing/invoice-pdf";
import { getCurrentMonthRunningTotal } from "@/lib/billing/running-total";
import { billingMonthRange } from "@/lib/billing/period";

// @react-pdf/renderer needs Node APIs (native deps for PDF rendering). Without
// this, Vercel can default to Edge runtime → silent failures. Same pattern as
// app/api/command/content/images/chart/route.tsx.
export const runtime = "nodejs";

function formatDateShort(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function formatMonth(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long", year: "numeric" }).format(d);
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Director only" }, { status: 403 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return NextResponse.json({ error: "No agency on session" }, { status: 400 });

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  const total = await getCurrentMonthRunningTotal(agencyId);
  const lines: PdfLine[] = total.lines.map((l) => ({
    date: formatDateShort(l.exchangedAt),
    description: l.propertyAddress,
    service: l.bandLabel,
    amountPence: l.totalPence,
    variant: "normal",
  }));

  // Trial exchanges this month — surfaced as £0 free-marked rows for visibility.
  const { start, end } = billingMonthRange(new Date());
  const trials = await prisma.propertyTransaction.findMany({
    where: { agencyId, freeOnExchange: true, exchangedAt: { gte: start, lt: end } },
    select: { propertyAddress: true, exchangedAt: true },
    orderBy: { exchangedAt: "asc" },
  });
  for (const t of trials) {
    lines.push({
      date: formatDateShort(t.exchangedAt!),
      description: t.propertyAddress,
      service: "Free — trial",
      amountPence: 0,
      variant: "trial",
    });
  }

  // Pending credit surfaced as a single line at the bottom (it'll apply next
  // month per accrual, but show it visibly on the preview).
  if (total.pendingCreditPence > 0) {
    lines.push({
      date: "",
      description: "Pending credit (applies next month)",
      service: "Credit",
      amountPence: -total.pendingCreditPence,
      variant: "credit",
    });
  }

  const pdf = await renderInvoicePdf({
    invoiceLabel: "Preview",
    periodLabel: formatMonth(total.monthStart),
    status: "building",
    agencyName: agency.name,
    lines,
    subtotalPence: total.subtotalPence,
    vatPence: total.vatPence,
    vatActive: total.vatActive,
    creditsAppliedPence: total.pendingCreditPence,
    totalPence: total.totalPence - total.pendingCreditPence,
    generatedAt: `Generated ${formatDateShort(new Date())}`,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-preview-${total.monthStart.toISOString().slice(0, 7)}.pdf"`,
    },
  });
}
