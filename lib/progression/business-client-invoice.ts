// Part B of the business billing: the invoice a progression business sends to ONE
// of its client agencies for the sales it progressed. Off-Stripe — the business
// collects outside the platform; this produces the data for the DESIGNED invoice
// PDF (business-invoice-pdf.ts), re-headed to the business as the issuer and
// styled per the business's saved invoice design. The line fee comes from the
// per-client rate card (ProgressionBusinessClient.feeModel), not TSP's.

import { prisma } from "@/lib/prisma";
import { billingMonthRange } from "@/lib/billing/period";
import { parseFeeModel, calculateClientFee } from "./client-fees";
import type { BusinessInvoicePdfInput, BusinessInvoiceLine } from "./business-invoice-pdf";
import { parseInvoiceDesign } from "./invoice-design";

export type BusinessInvoiceResult =
  | { ok: true; input: BusinessInvoicePdfInput; logoPath: string | null }
  | { ok: false; reason: "not_found" | "fee_not_set" }
  | { ok: false; reason: "needs_price"; addresses: string[] }
  | { ok: false; reason: "needs_completion_date"; addresses: string[] };

function fmtMoney0(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Build the current-month invoice from a progression business to a client agency:
 * one line per sale that exchanged (or completed) this month × the rate-card fee,
 * styled with the business's saved invoice design. Returns null if the
 * business/agency/link is missing (the caller has already authorised the pair).
 */
export async function buildBusinessClientInvoice(
  businessId: string,
  agencyId: string,
  now: Date = new Date(),
): Promise<BusinessInvoiceResult> {
  const { start, end } = billingMonthRange(now);
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: {
      name: true, senderEmail: true, vatRegisteredAt: true, vatRateBps: true, vatNumber: true,
      billAtCompletion: true, invoiceDesign: true, invoiceLogoPath: true,
    },
  });
  const billAtCompletion = business?.billAtCompletion ?? false;
  const [agency, link, sales] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
    prisma.progressionBusinessClient.findUnique({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: businessId, agencyId } },
      select: { feeModel: true },
    }),
    prisma.propertyTransaction.findMany({
      where: {
        progressionBusinessId: businessId,
        agencyId,
        isDemo: false,
        ...(billAtCompletion
          ? { status: "completed", completionDate: { gte: start, lt: end } }
          : { exchangedAt: { gte: start, lt: end } }),
      },
      select: { propertyAddress: true, priceAtExchange: true, purchasePrice: true, exchangedAt: true, completionDate: true, tenure: true },
      orderBy: billAtCompletion ? { completionDate: "asc" } : { exchangedAt: "asc" },
    }),
  ]);
  if (!business || !agency || !link) return { ok: false, reason: "not_found" };

  const feeModel = parseFeeModel(link.feeModel);
  if (!feeModel) return { ok: false, reason: "fee_not_set" };

  if (billAtCompletion) {
    const undated = await prisma.propertyTransaction.findMany({
      where: { progressionBusinessId: businessId, agencyId, isDemo: false, status: "completed", completionDate: null },
      select: { propertyAddress: true },
    });
    if (undated.length > 0) {
      return { ok: false, reason: "needs_completion_date", addresses: undated.map((s) => s.propertyAddress) };
    }
  }

  const design = parseInvoiceDesign(business.invoiceDesign);

  const lines: BusinessInvoiceLine[] = [];
  const unpriceable: string[] = [];
  let subtotal = 0;
  for (const s of sales) {
    const price = s.priceAtExchange ?? s.purchasePrice;
    const fee = calculateClientFee(feeModel, price, s.tenure);
    if (fee == null) { unpriceable.push(s.propertyAddress); continue; }
    subtotal += fee;
    const lineDate = billAtCompletion ? s.completionDate : s.exchangedAt;
    // Sub-note content honours the design toggle; the exchange-date COLUMN is
    // gated in the renderer by design.showExchangeDate.
    const sub: string[] = [];
    if (design.showSalePrice && price != null) sub.push(fmtMoney0(price));
    if (s.completionDate) sub.push(`completed ${fmtShort(s.completionDate)}`);
    lines.push({
      date: lineDate ? fmtShort(lineDate) : "",
      description: s.propertyAddress,
      subNote: sub.length ? sub.join(" · ") : undefined,
      amountPence: fee,
    });
  }
  if (unpriceable.length) return { ok: false, reason: "needs_price", addresses: unpriceable };

  const vatActive = business.vatRegisteredAt != null && (business.vatRateBps ?? 0) > 0;
  const vatPence = vatActive ? Math.round(subtotal * (business.vatRateBps! / 10000)) : 0;

  const monthLabel = start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
  const ref = start.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "Europe/London" }).replace(" ", "-").toUpperCase();
  const due = new Date(now.getTime() + design.paymentTermsDays * 86_400_000);

  return {
    ok: true,
    logoPath: business.invoiceLogoPath,
    input: {
      invoiceLabel: ref,
      periodLabel: monthLabel,
      generatedAt: now.toLocaleDateString("en-GB"),
      dueLabel: due.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      issuerName: business.name,
      issuerContact: business.senderEmail ?? "",
      agencyName: agency.name,
      lines,
      subtotalPence: subtotal,
      vatPence,
      vatActive,
      totalPence: subtotal + vatPence,
      vatNumber: vatActive ? business.vatNumber ?? undefined : undefined,
      design,
      logo: null, // the route loads the bytes from logoPath and sets this
    },
  };
}
