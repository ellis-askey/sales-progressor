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
import { renderBusinessInvoicePdf } from "@/lib/progression/business-invoice-pdf";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";

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
    if (res.reason === "needs_completion_date") {
      const list = res.addresses.join(", ");
      const one = res.addresses.length === 1;
      return NextResponse.json(
        { error: `Add a completion date to ${list} before generating this invoice. ${one ? "That sale is" : "Those sales are"} billed at completion, so ${one ? "it" : "they"} can't be invoiced without the date.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const input = res.input;
  // Load the logo bytes (public bucket URL) so the PDF can embed them. Best-effort
  // — a fetch failure just drops to the no-logo header rather than failing the file.
  if (res.logoPath) {
    try {
      const url = getAgencyLogoUrl(res.logoPath);
      if (url) {
        const r = await fetch(url);
        if (r.ok) input.logo = { bytes: new Uint8Array(await r.arrayBuffer()), mime: "image/png" };
      }
    } catch { /* no logo on the invoice */ }
  }
  const pdf = await renderBusinessInvoicePdf(input);
  const filename = `invoice-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
