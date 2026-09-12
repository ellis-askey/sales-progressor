// app/api/solicitor-firms/[id]/handlers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { titleCase, validateHandlerContact } from "@/lib/utils";
import { setAgencySolicitorCc, getSolicitorCcForEditing } from "@/lib/services/solicitor-cc";

// GET /api/solicitor-firms/[id]/handlers
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const firm = await prisma.solicitorFirm.findUnique({ where: { id } });
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const handlers = await prisma.solicitorContact.findMany({
    where: { firmId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, email: true, secondaryEmail: true },
  });

  // Return the EFFECTIVE CC for the caller's agency (solicitor gospel → this
  // agency's override → none) plus whether the agent may edit it. ccEditable is
  // false when the solicitor's own value is gospel — the picker shows it
  // read-only in that case. (Fix 1.)
  const agencyId = session.user.agencyId;
  const withCc = await Promise.all(
    handlers.map(async (h) => {
      const cc = await getSolicitorCcForEditing(h, agencyId);
      return { ...h, secondaryEmail: cc.value, ccEditable: cc.editable };
    }),
  );

  return NextResponse.json(withCc);
}

// POST /api/solicitor-firms/[id]/handlers  — add handler to existing firm
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const { name, phone, email, secondaryEmail } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const contactError = validateHandlerContact(phone, email);
  if (contactError) return NextResponse.json({ error: contactError }, { status: 400 });

  const firm = await prisma.solicitorFirm.findUnique({ where: { id } });
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Per-agency CC (Fix 1): the handler row itself no longer carries the
  // agency-entered CC. The solicitor's own secondaryEmail (set in their portal)
  // is the gospel field and starts empty; any CC the agency enters here is stored
  // as THIS agency's private override, so it never leaks to other agencies.
  const handler = await prisma.solicitorContact.create({
    data: {
      firmId: id,
      name: titleCase(name.trim()),
      phone: phone?.trim() || null,
      email: email?.trim().toLowerCase() || null,
    },
  });

  const cc = secondaryEmail?.trim().toLowerCase() || null;
  const agencyId = session.user.agencyId;
  if (cc && agencyId) {
    await setAgencySolicitorCc({ id: handler.id, secondaryEmail: null }, agencyId, cc).catch(() => {});
  }

  return NextResponse.json({ ...handler, secondaryEmail: agencyId ? cc : null }, { status: 201 });
}
