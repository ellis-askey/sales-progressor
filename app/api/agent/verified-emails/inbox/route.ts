import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import {
  isPersonalDomain,
  extractDomain,
  getVerifiedDomainForAgency,
  startInboxVerification,
} from "@/lib/services/verified-emails";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (isPersonalDomain(email)) {
    return NextResponse.json(
      { error: "Personal email addresses are not supported." },
      { status: 400 }
    );
  }

  const domain = extractDomain(email);
  const verifiedDomain = await getVerifiedDomainForAgency(session.user.agencyId, domain);

  if (!verifiedDomain || verifiedDomain.status !== "verified") {
    return NextResponse.json(
      { error: "Domain not yet authenticated", requiresDomainAuth: true, domain },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const result = await startInboxVerification(
    session.user.id,
    email,
    verifiedDomain.id,
    baseUrl
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
