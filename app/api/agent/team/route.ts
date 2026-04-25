import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

// Only directors can manage the team
async function requireDirector() {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { session: null, error: NextResponse.json({ error: "Director access required" }, { status: 403 }) };
  }
  return { session, error: null };
}

// GET /api/agent/team — list all agent-role users in the agency
export async function GET() {
  const { session, error } = await requireDirector();
  if (error) return error;

  const firmName = session!.user.firmName;
  const teamWhere: Record<string, unknown> = { agencyId: session!.user.agencyId, role: { in: ["director", "negotiator"] } };
  if (firmName) teamWhere.firmName = firmName;

  const team = await prisma.user.findMany({
    where: teamWhere,
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(team);
}

// POST /api/agent/team — create a new negotiator account
export async function POST(req: NextRequest) {
  const { session, error } = await requireDirector();
  if (error) return error;

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: passwordHash,
      role: "negotiator",
      agencyId: session!.user.agencyId,
      firmName: session!.user.firmName,
    },
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
