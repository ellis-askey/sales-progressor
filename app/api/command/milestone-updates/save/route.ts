// POST /api/command/milestone-updates/save
// { code, core, subtextOwn, subtextOther }
//
// Upserts the client-portal Updates copy override for a milestone. Empty fields
// store as null (fall back to the hardcoded default). Applies to the next portal
// render immediately. Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(b.code ?? "");
  if (!code) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const nullable = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const data = {
    core: nullable(b.core),
    subtextOwn: nullable(b.subtextOwn),
    subtextOther: nullable(b.subtextOther),
    updatedById: session.user.id,
  };

  await prisma.milestoneUpdateOverride.upsert({
    where: { code },
    create: { code, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
