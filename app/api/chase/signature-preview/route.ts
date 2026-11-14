// GET /api/chase/signature-preview?transactionId=…&style=…
// Returns the signature /api/chase/send-email will append, plus the per-message
// style options that apply to THIS file's signature (Basic / Logo / Signature
// image / Custom), so the chase drawer shows a picker of what actually exists and
// opens on the saved default. The sign-off phrase lives in the message body.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveEmailSignature } from "@/lib/email/signature";
import { renderClientSignoff } from "@/lib/email/client-signoff";
import { resolveSignOffPhrase } from "@/lib/email/resolve-sign-off";
import { shouldAddSignOff } from "@/lib/email/sign-off";
import { buildSignatureStyleOptions, type SignatureStyleKey } from "@/lib/email/signature-options";
import { agencyLogoHeaderHtml } from "@/lib/email/logo-header";
import { getAgencyLogoUrl, getSignatureImageUrl } from "@/lib/supabase-storage";
import type { LogoScale, LogoAlign } from "@/lib/image/logo";

const AGENCY_SIG_SELECT = { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } as const;
type AgencySig = { name: string | null; logoPath: string | null; logoTileColor: string | null; logoScale: string | null; logoAlign: string | null };

function logoBandFor(agency: AgencySig | null | undefined): string {
  return agencyLogoHeaderHtml({
    logoUrl: getAgencyLogoUrl(agency?.logoPath),
    tileColor: agency?.logoTileColor,
    scale: (agency?.logoScale ?? null) as LogoScale | null,
    align: (agency?.logoAlign ?? null) as LogoAlign | null,
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const styleParam = req.nextUrl.searchParams.get("style");
  const requested: SignatureStyleKey | null =
    styleParam === "basic" || styleParam === "logo" || styleParam === "image" || styleParam === "custom" ? styleParam : null;

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { agencyId: true, progressionBusinessId: true, agency: { select: AGENCY_SIG_SELECT } },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // External progression business file: per-client sign-off with its own options.
  if (tx.progressionBusinessId) {
    const [me, link] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, phone: true, directMobile: true } }),
      prisma.progressionBusinessClient.findUnique({
        where: { progressionBusinessId_agencyId: { progressionBusinessId: tx.progressionBusinessId, agencyId: tx.agencyId } },
        select: { signatureMode: true, signatureImagePath: true, signatureHtml: true },
      }),
    ]);
    const savedMode = link?.signatureMode ?? "BASIC";
    const { options, selected } = buildSignatureStyleOptions({
      savedMode,
      hasImage: !!link?.signatureImagePath,
      hasCustom: !!link?.signatureHtml,
      hasLogo: !!tx.agency?.logoPath,
    });
    const style = requested && options.some((o) => o.key === requested) ? requested : selected;
    const cs = renderClientSignoff({
      mode: savedMode,
      imageUrl: getSignatureImageUrl(link?.signatureImagePath),
      customHtml: link?.signatureHtml ?? null,
      identity: { name: me?.name ?? session.user.name ?? "", company: tx.agency?.name ?? "", phone: me?.directMobile ?? me?.phone ?? null },
      style,
      logoBandHtml: logoBandFor(tx.agency),
    });
    const signOff = await resolveSignOffPhrase({ userId: session.user.id, progressionBusinessId: tx.progressionBusinessId, agencyId: tx.agencyId });
    return NextResponse.json({ html: cs.html, missing: [], mode: null, name: session.user.name ?? null, signOff, addSignOff: shouldAddSignOff(cs.html), styleOptions: options, selectedStyle: selected });
  }

  // Agent's own signature + its style options (the resolver the real send uses, so
  // the preview matches the send exactly).
  const sigUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailSignatureMode: true, emailSignatureImagePath: true, emailSignatureHtml: true },
  });
  const { options, selected } = buildSignatureStyleOptions({
    savedMode: sigUser?.emailSignatureMode ?? "BASIC",
    hasImage: !!sigUser?.emailSignatureImagePath,
    hasCustom: !!sigUser?.emailSignatureHtml,
    hasLogo: !!tx.agency?.logoPath,
  });
  const style = requested && options.some((o) => o.key === requested) ? requested : selected;
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency: tx.agency,
    fallbackName: session.user.name,
    signatureStyle: style,
  });
  const signOff = await resolveSignOffPhrase({ userId: session.user.id });
  return NextResponse.json({ html: sig.html, missing: sig.missing, mode: sig.mode, name: session.user.name ?? null, signOff, addSignOff: shouldAddSignOff(sig.html), styleOptions: options, selectedStyle: selected });
}
