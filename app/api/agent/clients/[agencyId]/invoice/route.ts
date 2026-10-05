// GET /api/agent/clients/[agencyId]/invoice
//
// The invoice a progression business sends a client agency for the sales it
// progressed this month (Part B — off-Stripe, the business collects outside the
// platform). Owner-scoped. Streams a PDF, re-headed to the business as the issuer,
// with the rate-card fee per sale.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
import { buildBusinessClientInvoice } from "@/lib/progression/business-client-invoice";
import { renderInvoicePdf } from "@/lib/billing/invoice-pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { agencyId } = await params;
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return NextResponse.json({ error: "That isn't one of your clients." }, { status: 403 });

  const res = await buildBusinessClientInvoice(owner.businessId, agencyId);
  if (!res.ok) {
    if (res.reason === "fee_not_set") {
      return NextResponse.json({ error: "Set your fee for this client before generating an invoice." }, { status: 409 });
    }
    if (res.reason === "needs_price") {
      const list = res.addresses.join(", ");
      const one = res.addresses.length === 1;
      return NextResponse.json(
        { error: `Add a sale price to ${list} before generating this invoice. ${one ? "That sale" : "Those sales"} can't be priced without it.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const input = res.input;
  const pdf = await renderInvoicePdf(input);
  const filename = `invoice-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
