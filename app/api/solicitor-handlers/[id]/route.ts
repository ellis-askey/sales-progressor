// PATCH /api/solicitor-handlers/[id]
// Set the caller AGENCY's own assistant/secretary CC for a solicitor handler.
//
// Per-agency model (Fix 1): the CC an agency sets here is stored as that agency's
// OWN override (SolicitorContactAgencyOverride), private to them — it never
// changes another agency's CC, which closes the old shared-directory cross-agency
// issue by construction. The solicitor's own value (set in their portal) is
// gospel: when present it is used for every agency and this route refuses to let
// an agency override it. Send an empty string to clear the agency's override.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setAgencySolicitorCc, resolveSolicitorCc, SOLICITOR_CC_GOSPEL_SET } from "@/lib/services/solicitor-cc";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const { secondaryEmail, transactionId } = await req.json();

  const trimmed = typeof secondaryEmail === "string" ? secondaryEmail.trim().toLowerCase() : "";
  if (trimmed && !EMAIL_RE.test(trimmed)) {
    return NextResponse.json({ error: "That email address doesn't look right" }, { status: 400 });
  }

  const handler = await prisma.solicitorContact.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, email: true, secondaryEmail: true },
  });
  if (!handler) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The per-agency override belongs to a specific agency. Agency users
  // (director / negotiator) attach it to their own agency. Internal staff have no
  // agency of their own, so for them we key it to the OUTSOURCING agency of the
  // file they're working on — verified in-scope and outsourced.
  let agencyId = session.user.agencyId;
  if (!agencyId) {
    const forbidden = NextResponse.json(
      { error: "Only your agency's own team can set the assistant email here." },
      { status: 403 },
    );
    const scope = getAccessScope(session);
    if (scope.kind === "agency" || typeof transactionId !== "string" || !transactionId) return forbidden;
    const tx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, transactionId),
      select: { agencyId: true, serviceType: true },
    });
    if (!tx || tx.serviceType !== "outsourced" || !tx.agencyId) return forbidden;
    agencyId = tx.agencyId;
  }

  try {
    await setAgencySolicitorCc(handler, agencyId, trimmed || null);
  } catch (err) {
    if (err instanceof Error && err.message === SOLICITOR_CC_GOSPEL_SET) {
      return NextResponse.json(
        { error: "The solicitor has set this assistant email themselves, so it can't be changed here." },
        { status: 409 },
      );
    }
    throw err;
  }

  // Return the effective CC (the agency's override, since gospel was absent) so
  // the picker reflects what will actually be used.
  const effective = await resolveSolicitorCc(handler, agencyId);
  return NextResponse.json({
    id: handler.id,
    name: handler.name,
    phone: handler.phone,
    email: handler.email,
    secondaryEmail: effective,
  });
}
