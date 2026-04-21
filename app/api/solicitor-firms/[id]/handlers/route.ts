// app/api/solicitor-firms/[id]/handlers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/solicitor-firms/[id]/handlers
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const firm = await prisma.solicitorFirm.findFirst({
    where: { id, agencyId: session.user.agencyId },
  });
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const handlers = await prisma.solicitorContact.findMany({
    where: { firmId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, email: true },
  });

  return NextResponse.json(handlers);
}

// POST /api/solicitor-firms/[id]/handlers  — add handler to existing firm
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const { name, phone, email } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const firm = await prisma.solicitorFirm.findFirst({
    where: { id, agencyId: session.user.agencyId },
  });
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const handler = await prisma.solicitorContact.create({
    data: { firmId: id, name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null },
  });

  return NextResponse.json(handler, { status: 201 });
}
