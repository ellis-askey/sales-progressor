// PATCH /api/solicitor-handlers/[id]
// Update a solicitor case handler's assistant/secretary email (the address
// CC'd on comms to that handler). Lets an existing handler already on files
// gain an assistant without re-creating them. Send an empty string to clear.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const { secondaryEmail } = await req.json();

  const trimmed = typeof secondaryEmail === "string" ? secondaryEmail.trim().toLowerCase() : "";
  if (trimmed && !EMAIL_RE.test(trimmed)) {
    return NextResponse.json({ error: "That email address doesn't look right" }, { status: 400 });
  }

  const existing = await prisma.solicitorContact.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Multi-tenant safety (Law 7). SolicitorContact is a shared GLOBAL directory row
  // with no agencyId, and secondaryEmail is CC'd on every email we send this handler
  // across every file they're on. A caller must therefore not be able to edit a
  // handler that only appears on OTHER agencies' files. Authority rule: the handler
  // must be on a transaction within the caller's access scope — OR not yet attached
  // to any transaction at all (the create-handler-then-set-assistant flow in
  // SolicitorPicker, before the file is saved). Internal staff (scope "all") are
  // unrestricted. Returns 404 (not 403) so a cross-agency caller can't confirm the
  // handler exists.
  const scope = getAccessScope(session);
  if (scope.kind !== "all") {
    const onHandlerWhere = {
      OR: [{ vendorSolicitorContactId: id }, { purchaserSolicitorContactId: id }],
    };
    const inScopeCount = await prisma.propertyTransaction.count({
      where: { ...scopeTransactionWhere(scope), ...onHandlerWhere },
    });
    if (inScopeCount === 0) {
      const anyCount = await prisma.propertyTransaction.count({ where: onHandlerWhere });
      if (anyCount > 0) {
        // Handler is used only by files outside the caller's scope.
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      // anyCount === 0 → brand-new, unattached handler. Safe to edit (not yet
      // CC'ing anyone and not discoverable via another agency's file).
    }
  }

  const handler = await prisma.solicitorContact.update({
    where: { id },
    data: { secondaryEmail: trimmed || null },
    select: { id: true, name: true, phone: true, email: true, secondaryEmail: true },
  });

  return NextResponse.json(handler);
}
