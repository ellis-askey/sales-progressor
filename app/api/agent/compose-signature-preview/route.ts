// GET /api/agent/compose-signature-preview?transactionId=…&style=…
// Returns the signature + sign-off that a manual "New email" will carry, plus the
// per-message style options that apply to THIS file's signature, so the composer
// shows a picker of what actually exists (Basic / Logo / Signature image / Custom)
// and opens on the saved default.
//
// Three branches, mirroring the send path:
//   - internal staff (sales_progressor / admin) → the standardised in-house block
//     (Basic only — TSP signs off the same way everywhere).
//   - external progression business file → the per-client sign-off set on the
//     Clients page, with Basic/Logo/Image/Custom options for THAT client.
//   - agent (director / negotiator) → their own signature's options.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveEmailSignature } from "@/lib/email/signature";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";
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
    select: { id: true, agencyId: true, progressionBusinessId: true, agency: { select: AGENCY_SIG_SELECT } },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const isInternalStaff = session.user.role === "sales_progressor" || session.user.role === "admin";

  // Internal / TSP: one signature (Basic), no options.
  if (isInternalStaff) {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, phone: true, directMobile: true } });
    const sig = buildInHouseSignoff({
      name: me?.name ?? session.user.name ?? "",
      agency: tx.agency?.name ?? "",
      phone: me?.directMobile ?? me?.phone ?? null,
    });
    const signOff = await resolveSignOffPhrase({ userId: session.user.id });
    const { options, selected } = buildSignatureStyleOptions({ savedMode: "BASIC", hasImage: false, hasCustom: false, hasLogo: false });
    return NextResponse.json({ kind: "inhouse", html: sig.html, mode: null, missing: [], signOff, addSignOff: shouldAddSignOff(sig.html), styleOptions: options, selectedStyle: selected });
  }

  // External progression business file: the per-client sign-off, with options
  // (Basic / Logo / Image / Custom) resolved for THAT client's configured signature.
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
    return NextResponse.json({ kind: "inhouse", html: cs.html, mode: null, missing: [], signOff, addSignOff: shouldAddSignOff(cs.html), styleOptions: options, selectedStyle: selected });
  }

  // Agent path: the agent's own signature + its style options.
  const sigUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailSignatureMode: true, emailSignatureImagePath: true, emailSignatureHtml: true, agency: { select: AGENCY_SIG_SELECT } },
  });
  const { options, selected } = buildSignatureStyleOptions({
    savedMode: sigUser?.emailSignatureMode ?? "BASIC",
    hasImage: !!sigUser?.emailSignatureImagePath,
    hasCustom: !!sigUser?.emailSignatureHtml,
    hasLogo: !!sigUser?.agency?.logoPath,
  });
  const style = requested && options.some((o) => o.key === requested) ? requested : selected;
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency: sigUser?.agency ?? null,
    fallbackName: session.user.name,
    signatureStyle: style,
  });
  const signOff = await resolveSignOffPhrase({ userId: session.user.id });
  return NextResponse.json({ kind: "personal", html: sig.html, missing: sig.missing, mode: sig.mode, signOff, addSignOff: shouldAddSignOff(sig.html), styleOptions: options, selectedStyle: selected });
}
