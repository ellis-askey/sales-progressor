// Owner-scoped: validate DNS for the progression business's OWN domain and, when
// valid, adopt it as the business's sending address. Mirrors the agency check
// route, keyed on the owner's progressionBusinessId. senderVerified itself is
// stamped by the nightly check-domains cron (mirrors Agency.quoteSenderVerified).

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { validateAuthenticatedDomain } from "@/lib/services/sendgrid";
import { adoptVerifiedDomainAsBusinessSender } from "@/lib/services/verified-emails";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { id } = await params;
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a business owner can do this." }, { status: 403 });

  // The domain must belong to THIS business — never another business's.
  const domain = await prisma.verifiedDomain.findFirst({
    where: { id, progressionBusinessId: owner.businessId },
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

  if (result.valid) {
    await adoptVerifiedDomainAsBusinessSender(owner.businessId, domain.domain);
  }

  return NextResponse.json({ domain: updated, valid: result.valid });
}
