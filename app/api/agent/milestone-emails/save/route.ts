// POST /api/agent/milestone-emails/save
// { code, side, tenure, purchaseType, subject, heroLabel, opening, whatHappened, whatNext, action }
//
// Saves (upserts) this agency's own scenario-scoped override for a client
// milestone email. Applies to future sends immediately. Director only; the
// agencyId comes from the session (Law 7) — never client-supplied.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CLIENT_SIDES = new Set(["vendor", "purchaser"]);
const TENURES = new Set(["any", "freehold", "leasehold"]);
const METHODS = new Set(["any", "mortgage", "cash"]);

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

  // agencyId is non-null here, so the compound-unique upsert works (the null
  // default layer can't upsert this way — see the Command Centre save route).
  await prisma.milestoneEmailOverride.upsert({
    where: {
      code_side_tenure_purchaseType_agencyId: { code, side, tenure, purchaseType, agencyId },
    },
    create: { code, side, tenure, purchaseType, agencyId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
