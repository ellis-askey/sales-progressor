// GET /api/agent/compose-signature-preview?transactionId=…
// Returns the sign-off that /api/agent/send-email will actually append to a
// manual "Compose email" from the Activity tab, so the composer can show the
// agent exactly how their email signs off — plus (for the personal signature)
// which pieces are still missing, for the "finish your signature" nudge.
//
// Mirrors the send route's branch EXACTLY so the preview never lies:
//   - internal staff (sales_progressor / admin) → the standardised in-house
//     sign-off (buildInHouseSignoff). Nothing to "complete", so no nudge.
//   - agent (director / negotiator) → their personal signature
//     (resolveEmailSignature: BASIC / IMAGE / CUSTOM), with missing pieces.
//
// Deliberately NOT the shared /api/chase/signature-preview endpoint: the chase
// send uses the personal signature for every role, so that endpoint is right
// for the chase drawer but would misrepresent an internal staffer's compose.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveEmailSignature } from "@/lib/email/signature";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";

const AGENCY_SIG_SELECT = { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, agency: { select: AGENCY_SIG_SELECT } },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const isInternalStaff = session.user.role === "sales_progressor" || session.user.role === "admin";

  if (isInternalStaff) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true, directMobile: true },
    });
    const sig = buildInHouseSignoff({
      name: me?.name ?? session.user.name ?? "",
      agency: tx.agency?.name ?? "",
      phone: me?.directMobile ?? me?.phone ?? null,
    });
    return NextResponse.json({ kind: "inhouse", html: sig.html, mode: null, missing: [] });
  }

  // Agent path: the personal signature resolved against the agent's OWN agency,
  // matching send-email's agent branch (senderAgency = user.agency).
  const senderAgency = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agency: { select: AGENCY_SIG_SELECT } },
  });
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency: senderAgency?.agency ?? null,
    fallbackName: session.user.name,
  });
  return NextResponse.json({ kind: "personal", html: sig.html, missing: sig.missing, mode: sig.mode });
}
