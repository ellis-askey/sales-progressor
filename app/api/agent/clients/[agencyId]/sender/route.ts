// Owner-scoped sender status for a progression business's CLIENT agency.
// A progression-business owner sets up the client agency's OWN sending domain so
// emails for that client white-label fully as their brand. The client IS a real
// Agency row, so this reuses the exact agency domain-verification mechanism
// (VerifiedDomain + Agency.quoteSenderEmail/quoteSenderVerified) — the ONLY change
// is the owner-scoped authorization (assertOwnerOfClient) instead of the agency's
// own session. Nothing here touches the agency's own settings routes.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
import { listVerifiedDomainsForAgency, senderMethod } from "@/lib/services/verified-emails";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { agencyId } = await params;
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return NextResponse.json({ error: "That isn't one of your clients." }, { status: 403 });

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { name: true, logoPath: true },
  });
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The sender THIS company has set up for THIS agency, from the per-(company, agency)
  // link — not the shared Agency row, so two companies at one agency never see each
  // other's address.
  const linkRow = await prisma.progressionBusinessClient.findUnique({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
    select: { senderEmail: true, senderVerified: true },
  });

  // The latest domain the owner has started for this client (shown in the flow).
  const domains = await listVerifiedDomainsForAgency(agencyId);
  const domain = domains.find((d) => d.status !== "removed") ?? null;

  // How the current sending address is set up, so the card shows the right resting
  // state + replies wording. A verified domain matching the address → "domain"
  // (send-only, replies route to the progressor); any other set address → "single"
  // (a real mailbox, replies land in it). Null when nothing is set up yet.
  const method = senderMethod(linkRow?.senderEmail ?? null, domain);

  return NextResponse.json({
    agencyName: agency.name,
    // The agency's uploaded logo — the brand mark buyers/sellers actually see on the
    // emails (logo band). Shown in the preview avatar when set, else the initials.
    logoUrl: getAgencyLogoUrl(agency.logoPath),
    senderEmail: linkRow?.senderEmail ?? null,
    senderVerified: linkRow?.senderVerified ?? false,
    // Who the owner is — for the addressing preview: their name brands the "From"
    // display ("{first} at {Agency}") and their email is where replies fall back to
    // when no sender is set up.
    ownerName: session.user.name ?? null,
    ownerEmail: session.user.email ?? null,
    method,
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
