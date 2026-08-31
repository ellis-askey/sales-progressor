// POST /api/agent/milestone-emails/reset  { code, side, tenure, purchaseType }
//
// Removes this agency's own override for a scope, so the step reverts to the
// Sales Progressor default (or the built-in default). Director only; the
// agencyId comes from the session (Law 7). Never touches the SP-default rows.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CLIENT_SIDES = new Set(["vendor", "purchaser"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const agencyId = session.user.agencyId;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(b.code ?? "");
  const side = String(b.side ?? "");
  const tenure = String(b.tenure ?? "any");
  const purchaseType = String(b.purchaseType ?? "any");
  if (!code || !CLIENT_SIDES.has(side)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await prisma.milestoneEmailOverride.deleteMany({
    where: { code, side, tenure, purchaseType, agencyId },
  });
  return NextResponse.json({ ok: true });
}
