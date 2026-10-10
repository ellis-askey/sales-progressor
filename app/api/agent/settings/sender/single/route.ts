// Owner-scoped: single-sender ("I have an email address for my business")
// verification for the progression business's OWN default sender. Mirrors the
// client single-sender route, keyed on the owner's progressionBusinessId. One
// POST, action in the body: create / check / resend.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import {
  startBusinessSingleSender,
  checkBusinessSingleSender,
  resendBusinessSingleSender,
} from "@/lib/services/verified-emails";

export async function POST(req: NextRequest) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Only a business owner can do this." }, { status: 403 });

  const { action, email } = await req.json();

  if (action === "create") {
    if (!email || typeof email !== "string") return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const business = await prisma.progressionBusiness.findUnique({ where: { id: owner.businessId }, select: { name: true } });
    const res = await startBusinessSingleSender(owner.businessId, email, business?.name ?? "Sales Progressor");
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "check") {
    return NextResponse.json(await checkBusinessSingleSender(owner.businessId));
  }

  if (action === "resend") {
    const res = await resendBusinessSingleSender(owner.businessId);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
