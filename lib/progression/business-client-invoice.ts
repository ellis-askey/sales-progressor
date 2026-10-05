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
export type BusinessInvoiceResult =
  | { ok: true; input: PdfInvoiceInput }
  | { ok: false; reason: "not_found" | "fee_not_set" }
  | { ok: false; reason: "needs_price"; addresses: string[] };

export async function buildBusinessClientInvoice(
  businessId: string,
  agencyId: string,
  now: Date = new Date(),
): Promise<BusinessInvoiceResult> {
  const { start, end } = billingMonthRange(now);
  const [business, agency, link, sales] = await Promise.all([
    prisma.progressionBusiness.findUnique({ where: { id: businessId }, select: { name: true, senderEmail: true, vatRegisteredAt: true, vatRateBps: true, vatNumber: true } }),
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
  if (!business || !agency || !link) return { ok: false, reason: "not_found" };

  // No rate set for this client — never invoice £0. The owner is prompted to set
  // their fee first (the invoice route surfaces this).
  const feeModel = parseFeeModel(link.feeModel);
  if (!feeModel) return { ok: false, reason: "fee_not_set" };

  const lines: PdfLine[] = [];
  const unpriceable: string[] = [];
  let subtotal = 0;
  for (const s of sales) {
    const price = s.priceAtExchange ?? s.purchasePrice;
    const fee = calculateClientFee(feeModel, price);
    // A price-based fee (percent/tiered) can't be worked out without a sale price.
    // Never bill it at £0 — collect it so the owner is told to add the price rather
    // than it silently vanishing or billing zero (audit SP-5).
    if (fee == null) { unpriceable.push(s.propertyAddress); continue; }
    subtotal += fee;
    lines.push({
      date: s.exchangedAt ? s.exchangedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
      description: s.propertyAddress,
      service: "Progression",
      amountPence: fee,
    });
  }
  if (unpriceable.length) return { ok: false, reason: "needs_price", addresses: unpriceable };

  // VAT: added on top of the rate-card fees when the business is VAT registered
  // (audit C2b). Off → the fee IS the total, unchanged.
  const vatActive = business.vatRegisteredAt != null && (business.vatRateBps ?? 0) > 0;
  const vatPence = vatActive ? Math.round(subtotal * (business.vatRateBps! / 10000)) : 0;

  const monthLabel = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const ref = `${start.toLocaleDateString("en-GB", { month: "short", year: "numeric" }).replace(" ", "-").toUpperCase()}`;
  return {
    ok: true,
    input: {
      invoiceLabel: ref,
      periodLabel: monthLabel,
      status: "issued",
      agencyName: agency.name,
      lines,
      subtotalPence: subtotal,
      vatPence,
      vatActive,
      creditsAppliedPence: 0,
      totalPence: subtotal + vatPence,
      generatedAt: now.toLocaleDateString("en-GB"),
      issuerName: business.name,
      // The business's own strapline + contact, so a client invoice never shows TSP's.
      // No published contact email → the contact line is dropped (handled downstream).
      issuerTagline: "Property sales progression",
      issuerContact: business.senderEmail ?? "",
      issuerVatNumber: vatActive ? business.vatNumber ?? undefined : undefined,
    },
  };
}
