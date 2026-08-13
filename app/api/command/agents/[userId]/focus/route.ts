// POST /api/command/agents/[userId]/focus  (superadmin — Command Centre)
//
// JSON: { focusX, focusY } (0–100). Sets the avatar focal point so a portrait
// headshot keeps the face centred in circular frames. Applied everywhere via
// UserAvatar's object-position.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n))));

export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { userId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const focusX = clamp(body?.focusX);
  const focusY = clamp(body?.focusY);
  if (!Number.isFinite(focusX) || !Number.isFinite(focusY)) {
    return NextResponse.json({ error: "focusX/focusY required" }, { status: 400 });
  }

  const res = await commandDb.user.updateMany({ where: { id: userId }, data: { imageFocusX: focusX, imageFocusY: focusY } });
  if (res.count === 0) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json({ ok: true, focusX, focusY });
}
