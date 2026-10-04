// POST /api/agent/settings/milestone-emails/reset  { code, side, tenure, purchaseType }
//
// Removes this progression business's own override for a scope, so the step
// reverts to the Sales Progressor default (or the built-in default) on the files
// they progress. Owner only; the businessId comes from the session (Law 7). Never
// touches the SP-default or any agency's rows.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";

const CLIENT_SIDES = new Set(["vendor", "purchaser"]);

export async function POST(req: Request) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(b.code ?? "");
  const side = String(b.side ?? "");
  const tenure = String(b.tenure ?? "any");
  const purchaseType = String(b.purchaseType ?? "any");
  if (!code || !CLIENT_SIDES.has(side)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await prisma.milestoneEmailOverride.deleteMany({
    where: { code, side, tenure, purchaseType, agencyId: null, progressionBusinessId: owner.businessId },
  });

  return NextResponse.json({ ok: true });
}
