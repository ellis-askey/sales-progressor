// Owner-scoped: validate DNS for a CLIENT agency's domain and, when valid, adopt
// it as that client's sending address. Mirrors
// app/api/agent/verified-emails/domain/[id]/check/route.ts, but the domain must
// belong to the progressor's client (authorized via assertOwnerOfClient). Once
// adopted + stamped by the nightly check-domains cron, the sender resolver sends
// this client's emails from their own domain (top tier of the two-tier model).

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
import { validateAuthenticatedDomain } from "@/lib/services/sendgrid";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ agencyId: string; id: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { agencyId, id } = await params;
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return NextResponse.json({ error: "That isn't one of your clients." }, { status: 403 });

  // The domain must belong to THIS client agency — never another agency's.
  const domain = await prisma.verifiedDomain.findFirst({ where: { id, agencyId } });
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
    // Stamp THIS company's per-link sender verified now the domain is authenticated,
    // if their chosen address is on this domain — so each company on the domain goes
    // live with its OWN address, never the shared agency field. (The nightly
    // check-domains cron is the backstop for the same per-link stamping.)
    const link = await prisma.progressionBusinessClient.findUnique({
      where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
      select: { senderEmail: true },
    });
    if (link?.senderEmail && link.senderEmail.toLowerCase().endsWith(`@${domain.domain.toLowerCase()}`)) {
      await prisma.progressionBusinessClient.update({
        where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
        data: { senderVerified: true, senderVerifiedAt: new Date() },
      });
    }
  }

  return NextResponse.json({ domain: updated, valid: result.valid });
}
