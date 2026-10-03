// Owner-scoped sender status for the progression business's OWN default domain.
// This is the tier BENEATH a client agency's own verified sender: when a client
// hasn't had its own address set up, emails fall back to the business's verified
// sender (and then the neutral platform address). Reuses the same SendGrid +
// VerifiedDomain mechanism as agencies, keyed on progressionBusinessId.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { listVerifiedDomainsForBusiness } from "@/lib/services/verified-emails";

export async function GET(_req: NextRequest) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a business owner can do this." }, { status: 403 });

  const business = await prisma.progressionBusiness.findUnique({
    where: { id: owner.businessId },
    select: { name: true, senderEmail: true, senderVerified: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const domains = await listVerifiedDomainsForBusiness(owner.businessId);
  const domain = domains.find((d) => d.status !== "removed") ?? null;

  return NextResponse.json({
    agencyName: business.name,
    senderEmail: business.senderEmail,
    senderVerified: business.senderVerified,
    domain: domain
      ? {
          id: domain.id,
          domain: domain.domain,
          status: domain.status,
          dkimValid: domain.dkimValid,
          spfValid: domain.spfValid,
          cnameRecords: domain.cnameRecords,
        }
      : null,
  });
}
