// GET /api/chase/signature-preview?transactionId=…
// Returns the white-label signature that /api/chase/send-email will append, so
// the chase drawer can show the agent exactly how their email signs off, plus
// which pieces are still missing (for the "finish your signature" nudge).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { getAgencyLogoUrl } from "@/lib/supabase-storage";
import { buildChaseSignatureHtml, chaseSignatureMissing } from "@/lib/email/chase-signature";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } } },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, image: true, jobTitle: true, directMobile: true, phone: true },
  });

  const agencyLogoBandHtml = agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(tx.agency?.logoPath),
    tileColor: tx.agency?.logoTileColor,
    scale: (tx.agency?.logoScale ?? null) as LogoScale | null,
    align: (tx.agency?.logoAlign ?? null) as LogoAlign | null,
  });
  const sigInput = {
    agentName: sender?.name ?? session.user.name ?? "",
    agentImageUrl: sender?.image ?? null,
    jobTitle: sender?.jobTitle ?? null,
    directMobile: sender?.directMobile ?? null,
    phone: sender?.phone ?? null,
    agencyName: tx.agency?.name ?? "",
    agencyLogoBandHtml,
  };

  return NextResponse.json({
    html: buildChaseSignatureHtml(sigInput),
    missing: chaseSignatureMissing(sigInput),
  });
}
