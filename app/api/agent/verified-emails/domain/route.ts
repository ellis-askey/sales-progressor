import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  isPersonalDomain,
  extractDomain,
  getVerifiedDomainForAgency,
} from "@/lib/services/verified-emails";
import { createAuthenticatedDomain } from "@/lib/services/sendgrid";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (isPersonalDomain(email)) {
    return NextResponse.json(
      { error: "Personal email addresses (Gmail, Outlook, etc.) are not supported. Please use a work email address." },
      { status: 400 }
    );
  }

  const domain = extractDomain(email);
  if (!domain) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  // Check if domain already exists for this agency
  const existing = await getVerifiedDomainForAgency(session.user.agencyId, domain);
  if (existing) {
    return NextResponse.json({ domain: existing, alreadyExists: true });
  }

  // Create authenticated domain in SendGrid (falls back to lookup if it already exists)
  const { id: sendgridDomainId, cnameRecords, alreadyValid } = await createAuthenticatedDomain(domain);

  const verifiedDomain = await prisma.verifiedDomain.create({
    data: {
      agencyId: session.user.agencyId,
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
