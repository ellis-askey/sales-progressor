// Owner-scoped: start domain authentication for the progression business's OWN
// default sending domain. Mirrors the agency domain route, keyed on the owner's
// progressionBusinessId. Same SendGrid + VerifiedDomain mechanism.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { isPersonalDomain, extractDomain, getVerifiedDomainForBusiness } from "@/lib/services/verified-emails";
import { createAuthenticatedDomain } from "@/lib/services/sendgrid";

export async function POST(req: NextRequest) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a business owner can do this." }, { status: 403 });

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

  const existing = await getVerifiedDomainForBusiness(owner.businessId, domain);
  if (existing) return NextResponse.json({ domain: existing, alreadyExists: true });

  const { id: sendgridDomainId, cnameRecords, alreadyValid } = await createAuthenticatedDomain(domain);

  const verifiedDomain = await prisma.verifiedDomain.create({
    data: {
      progressionBusinessId: owner.businessId,
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
