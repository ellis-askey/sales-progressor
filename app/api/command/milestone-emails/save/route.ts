// POST /api/command/milestone-emails/save
// { code, side, tenure, purchaseType, subject, heroLabel, opening, whatHappened, whatNext, action }
//
// Saves (upserts) a scenario-scoped override for a milestone email. It applies
// to future sends immediately. Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

const SIDES = new Set(["vendor", "purchaser", "vendorAgent", "progressor"]);
const TENURES = new Set(["any", "freehold", "leasehold"]);
const METHODS = new Set(["any", "mortgage", "cash"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(b.code ?? "");
  const side = String(b.side ?? "");
  const tenure = String(b.tenure ?? "any");
  const purchaseType = String(b.purchaseType ?? "any");

  if (!code || !SIDES.has(side) || !TENURES.has(tenure) || !METHODS.has(purchaseType)) {
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

  // The Command Centre edits the Sales Progressor default layer (agencyId null).
  // Agency-specific rows are written by the agency-facing editor (Phase 1).
  // Prisma types a nullable field as non-null inside a compound-unique `where`,
  // so we can't upsert the agencyId=null row directly — find-then-write instead.
  // The partial unique index (agencyId IS NULL) still guards against duplicates.
  const existing = await prisma.milestoneEmailOverride.findFirst({
    where: { code, side, tenure, purchaseType, agencyId: null },
    select: { id: true },
  });
  if (existing) {
    await prisma.milestoneEmailOverride.update({ where: { id: existing.id }, data });
  } else {
    await prisma.milestoneEmailOverride.create({
      data: { code, side, tenure, purchaseType, agencyId: null, ...data },
    });
  }

  return NextResponse.json({ ok: true });
}
