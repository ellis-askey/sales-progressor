// GET /api/chase/signature-preview?transactionId=…
// Returns the white-label signature that /api/chase/send-email will append, so
// the chase drawer can show the agent exactly how their email signs off, plus
// which pieces are still missing (for the "finish your signature" nudge).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveEmailSignature } from "@/lib/email/signature";
import { resolveClientSignoff } from "@/lib/email/client-signoff";
import { resolveSignOffPhrase } from "@/lib/email/resolve-sign-off";
import { shouldAddSignOff } from "@/lib/email/sign-off";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { agencyId: true, progressionBusinessId: true, agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } } },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // Per-message style toggle from the drawer (basic / logo / default). The
  // sign-off phrase itself is rendered client-side above this signature, so it
  // isn't a param here.
  const styleParam = req.nextUrl.searchParams.get("style");
  const signatureStyle = styleParam === "basic" || styleParam === "logo" ? styleParam : "default";

  // External progression business's file: mirror chase/send-email — the sender's
  // per-client sign-off for this client agency (falling back to the generic
  // in-house block).
  if (tx.progressionBusinessId) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true, directMobile: true },
    });
    const cs = await resolveClientSignoff({
      businessId: tx.progressionBusinessId,
      agencyId: tx.agencyId,
      identity: {
        name: me?.name ?? session.user.name ?? "",
        company: tx.agency?.name ?? "",
        phone: me?.directMobile ?? me?.phone ?? null,
      },
    });
    const signOff = await resolveSignOffPhrase({ userId: session.user.id, progressionBusinessId: tx.progressionBusinessId, agencyId: tx.agencyId });
    // Per-client sign-off is fixed — Basic/Logo/Default don't apply, hide the picker.
    return NextResponse.json({ html: cs.html, missing: [], mode: null, name: session.user.name ?? null, signOff, addSignOff: shouldAddSignOff(cs.html), styleApplies: false });
  }

  // Same resolver the real send uses, so the drawer preview matches the send
  // exactly (BASIC / IMAGE / CUSTOM).
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency: tx.agency,
    fallbackName: session.user.name,
    signatureStyle,
  });

  const signOff = await resolveSignOffPhrase({ userId: session.user.id });
  // Agent's own signature has Basic/Logo/Default variants, so the picker applies.
  return NextResponse.json({ html: sig.html, missing: sig.missing, mode: sig.mode, name: session.user.name ?? null, signOff, addSignOff: shouldAddSignOff(sig.html), styleApplies: true });
}
