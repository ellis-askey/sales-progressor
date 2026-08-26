import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { validateAuthenticatedDomain } from "@/lib/services/sendgrid";
import { adoptVerifiedDomainAsAgencySender } from "@/lib/services/verified-emails";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;

  const domain = await prisma.verifiedDomain.findFirst({
    where: { id, agencyId: session.user.agencyId },
  });
  if (!domain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await validateAuthenticatedDomain(domain.sendgridDomainId);

  const updated = await prisma.verifiedDomain.update({
    where: { id },
    data: {
      dkimValid: result.dkimValid,
      spfValid: result.spfValid,
      status: result.valid ? "verified" : "pending",
      verifiedAt: result.valid ? new Date() : null,
      lastCheckedAt: new Date(),
    },
  });

  // Newly verified → adopt it as the agency's sending address (if none yet), so
  // the agency's automated mail starts sending from their own domain.
  if (result.valid && domain.agencyId) {
    await adoptVerifiedDomainAsAgencySender(domain.agencyId, domain.domain);
  }

  return NextResponse.json({ domain: updated, valid: result.valid });
}
