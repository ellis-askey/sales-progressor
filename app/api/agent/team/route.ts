import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendNegotiatorInvitationEmail } from "@/lib/email/negotiator-invitation";
import { checkInviteLimit, rateLimitJson } from "@/lib/ratelimit";

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
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true, createdAt: true, password: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(
    team.map(({ password, ...m }) => ({
      ...m,
      invitationPending: password === null,
    }))
  );
}

// POST /api/agent/team — invite a new negotiator (creates User + sends email)
export async function POST(req: NextRequest) {
  const { session, error } = await requireDirector();
  if (error) return error;

  const rl = await checkInviteLimit(session!.user.id).catch(() => ({ success: true, reset: 0, remaining: 999 }));
  if (!rl.success) {
    return NextResponse.json(rateLimitJson(rl), { status: 429 });
  }

  const { name, email } = await req.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const normEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email: normEmail } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const pendingInvite = await prisma.negotiatorInvitation.findFirst({
    where: { negotiatorEmail: normEmail, agencyId: session!.user.agencyId!, acceptedAt: null },
  });
  if (pendingInvite) {
    return NextResponse.json({ error: "An invitation has already been sent to this email" }, { status: 409 });
  }

  const agency = await prisma.agency.findUnique({
    where: { id: session!.user.agencyId! },
    select: { name: true },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create the User row with null password (appears in team list as pending)
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normEmail,
      password: null,
      role: "negotiator",
      agencyId: session!.user.agencyId,
      firmName: session!.user.firmName,
    },
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true, createdAt: true },
  });

  await prisma.negotiatorInvitation.create({
    data: {
      agencyId: session!.user.agencyId!,
      invitedByUserId: session!.user.id,
      negotiatorName: name.trim(),
      negotiatorEmail: normEmail,
      token,
      expiresAt,
    },
  });

  const acceptUrl = `${process.env.NEXTAUTH_URL ?? ""}/invite-negotiator/${token}`;

  await sendNegotiatorInvitationEmail({
    to: normEmail,
    negotiatorName: name.trim(),
    invitedByName: session!.user.name ?? "Your director",
    agencyName: agency?.name ?? "your agency",
    acceptUrl,
  }).catch((err) => console.error("[negotiator-invite] Failed to send email:", err));

  return NextResponse.json({ ...user, invitationPending: true }, { status: 201 });
}
