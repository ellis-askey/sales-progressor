// Part B of the business billing: the invoice a progression business sends to ONE
// of its client agencies for the sales it progressed. Off-Stripe — the business
// collects outside the platform; this just produces the PDF (reusing the agency
// invoice renderer, re-headed to the business as the issuer). The line fee comes
// from the per-client rate card (ProgressionBusinessClient.feeModel), not TSP's.

import { prisma } from "@/lib/prisma";
import { billingMonthRange } from "@/lib/billing/period";
import { parseFeeModel, calculateClientFee } from "./client-fees";
import type { PdfInvoiceInput, PdfLine } from "@/lib/billing/invoice-pdf";

/**
 * Build the current-month invoice from a progression business to a client agency:
 * one line per sale that exchanged this month × the rate-card fee. Returns null if
 * the business/agency/link is missing (the caller has already authorised the pair).
 */
export async function buildBusinessClientInvoice(
  businessId: string,
  agencyId: string,
  now: Date = new Date(),
): Promise<PdfInvoiceInput | null> {
  const { start, end } = billingMonthRange(now);
  const [business, agency, link, sales] = await Promise.all([
    prisma.progressionBusiness.findUnique({ where: { id: businessId }, select: { name: true, senderEmail: true } }),
    prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
    prisma.progressionBusinessClient.findUnique({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: businessId, agencyId } },
      select: { feeModel: true },
    }),
    prisma.propertyTransaction.findMany({
      where: { progressionBusinessId: businessId, agencyId, exchangedAt: { gte: start, lt: end }, isDemo: false },
      select: { propertyAddress: true, priceAtExchange: true, purchasePrice: true, exchangedAt: true },
      orderBy: { exchangedAt: "asc" },
    }),
  ]);
  if (!business || !agency || !link) return null;

  const feeModel = parseFeeModel(link.feeModel);
  const lines: PdfLine[] = [];
  let subtotal = 0;
  for (const s of sales) {
    const price = s.priceAtExchange ?? s.purchasePrice;
    const fee = calculateClientFee(feeModel, price) ?? 0;
    subtotal += fee;
    lines.push({
      date: s.exchangedAt ? s.exchangedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
      description: s.propertyAddress,
      service: "Progression",
      amountPence: fee,
    });
  }

  const monthLabel = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const ref = `${start.toLocaleDateString("en-GB", { month: "short", year: "numeric" }).replace(" ", "-").toUpperCase()}`;
  return {
    invoiceLabel: ref,
    periodLabel: monthLabel,
    status: "issued",
    agencyName: agency.name,
    lines,
    subtotalPence: subtotal,
    vatPence: 0,
    vatActive: false,
    creditsAppliedPence: 0,
    totalPence: subtotal,
    generatedAt: now.toLocaleDateString("en-GB"),
    issuerName: business.name,
    // The business's own strapline + contact, so a client invoice never shows TSP's.
    // No published contact email → the contact line is dropped (handled downstream).
    issuerTagline: "Property sales progression",
    issuerContact: business.senderEmail ?? "",
  };
}
