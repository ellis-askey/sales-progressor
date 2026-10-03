// Owner-scoped: start domain authentication for a progression business's CLIENT
// agency. Mirrors app/api/agent/verified-emails/domain/route.ts exactly, but the
// target agency is the progressor's client (authorized via assertOwnerOfClient)
// rather than the caller's own agency. Same SendGrid + VerifiedDomain mechanism.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
import { isPersonalDomain, extractDomain, getVerifiedDomainForAgency } from "@/lib/services/verified-emails";
import { createAuthenticatedDomain } from "@/lib/services/sendgrid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { agencyId } = await params;
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return NextResponse.json({ error: "That isn't one of your clients." }, { status: 403 });

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (isPersonalDomain(email)) {
    return NextResponse.json(
      { error: "Personal email addresses (Gmail, Outlook, etc.) are not supported. Please use a work email address." },
      { status: 400 },
    );
  }
  const domain = extractDomain(email);
  if (!domain) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const existing = await getVerifiedDomainForAgency(agencyId, domain);
  if (existing) return NextResponse.json({ domain: existing, alreadyExists: true });

  const { id: sendgridDomainId, cnameRecords, alreadyValid } = await createAuthenticatedDomain(domain);

  const verifiedDomain = await prisma.verifiedDomain.create({
    data: {
      agencyId,
      domain,
      sendgridDomainId,
      status: alreadyValid ? "verified" : "pending",
      dkimValid: alreadyValid ? true : false,
      spfValid: alreadyValid ? true : false,
      cnameRecords: cnameRecords as object[],
      createdByUserId: session.user.id,
      verifiedAt: alreadyValid ? new Date() : null,
    },
  });

  return NextResponse.json({ domain: verifiedDomain, alreadyVerified: alreadyValid === true });
}
