// PATCH /api/solicitor-handlers/[id]
// Update a solicitor case handler's assistant/secretary email (the address
// CC'd on comms to that handler). Lets an existing handler already on files
// gain an assistant without re-creating them. Send an empty string to clear.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const handler = await prisma.solicitorContact.update({
    where: { id },
    data: { secondaryEmail: trimmed || null },
    select: { id: true, name: true, phone: true, email: true, secondaryEmail: true },
  });

  return NextResponse.json(handler);
}
