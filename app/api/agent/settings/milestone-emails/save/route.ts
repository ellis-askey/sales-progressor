// POST /api/agent/settings/milestone-emails/save
// { code, side, tenure, purchaseType, subject, heroLabel, opening, whatHappened, whatNext, action }
//
// Saves this progression business's own scenario-scoped override for a client
// milestone email. Applies to future sends on the files they progress. Owner
// only; the businessId comes from the session (Law 7).

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";

const CLIENT_SIDES = new Set(["vendor", "purchaser"]);
const TENURES = new Set(["any", "freehold", "leasehold"]);
const METHODS = new Set(["any", "mortgage", "cash"]);

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
  if (!code || !CLIENT_SIDES.has(side) || !TENURES.has(tenure) || !METHODS.has(purchaseType)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const nullable = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const subject = str(b.subject);
  const heroLabel = str(b.heroLabel);
  const opening = str(b.opening);
  const whatHappened = str(b.whatHappened);
  if (!subject.trim() || !heroLabel.trim() || !opening.trim() || !whatHappened.trim()) {
    return NextResponse.json({ error: "Subject, hero, opening and what-happened are required" }, { status: 400 });
  }

  const data = {
    subject,
    heroLabel,
    opening,
    whatHappened,
    whatNext: nullable(b.whatNext),
    action: nullable(b.action),
    updatedById: session.user.id,
  };

  // Business-layer rows have agencyId NULL, so the compound-unique upsert can't be
  // used (NULLs are distinct). Find-then-upsert, exactly like the SP-default layer.
  const existing = await prisma.milestoneEmailOverride.findFirst({
    where: { code, side, tenure, purchaseType, agencyId: null, progressionBusinessId: owner.businessId },
    select: { id: true },
  });
  if (existing) {
    await prisma.milestoneEmailOverride.update({ where: { id: existing.id }, data });
  } else {
    await prisma.milestoneEmailOverride.create({
      data: { code, side, tenure, purchaseType, agencyId: null, progressionBusinessId: owner.businessId, ...data },
    });
  }

  return NextResponse.json({ ok: true });
}
