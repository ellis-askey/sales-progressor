// GET /api/agent/business/invoices/[id]/pdf
//
// Re-download a previously-issued client invoice from the ledger. Owner-scoped.
// Re-renders the branded PDF from the stored snapshot (so it's byte-stable even
// as the underlying sales change), re-fetching the logo bytes from its path.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { renderBusinessInvoicePdf, type BusinessInvoicePdfInput } from "@/lib/progression/business-invoice-pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { id } = await params;
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a progression-business owner can do this." }, { status: 403 });

  const inv = await prisma.clientInvoice.findUnique({ where: { id }, select: { progressionBusinessId: true, snapshot: true, periodKey: true } });
  if (!inv || inv.progressionBusinessId !== owner.businessId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = inv.snapshot as unknown as { input: BusinessInvoicePdfInput; logoPath: string | null } | null;
  if (!snap?.input) return NextResponse.json({ error: "This invoice can't be re-rendered." }, { status: 409 });
  const input = snap.input;
  input.logo = null;
  if (snap.logoPath) {
    try {
      const url = getAgencyLogoUrl(snap.logoPath);
      if (url) {
        const r = await fetch(url);
        if (r.ok) input.logo = { bytes: new Uint8Array(await r.arrayBuffer()), mime: "image/png" };
      }
    } catch { /* no logo */ }
  }

  const pdf = await renderBusinessInvoicePdf(input);
  const filename = `invoice-${(input.periodLabel ?? inv.periodKey).replace(/\s+/g, "-").toLowerCase()}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
