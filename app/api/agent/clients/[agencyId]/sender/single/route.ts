// Owner-scoped: single-sender ("they gave you a mailbox") verification for a
// progression business's CLIENT agency. No DNS — SendGrid emails a link to the
// address and we adopt it once confirmed. One POST, action in the body:
//   create → start verification (SendGrid sends the link), store as pending sender
//   check  → poll SendGrid; adopt (mark verified) if it's confirmed
//   resend → re-send the verification email
// Authorized via assertOwnerOfClient, exactly like the domain routes alongside.

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { assertOwnerOfClient } from "@/lib/services/progression-clients";
import {
  startAgencySingleSender,
  checkAgencySingleSender,
  resendAgencySingleSender,
} from "@/lib/services/verified-emails";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const { agencyId } = await params;
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return NextResponse.json({ error: "That isn't one of your clients." }, { status: 403 });

  const { action, email } = await req.json();

  if (action === "create") {
    if (!email || typeof email !== "string") return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    const res = await startAgencySingleSender(agencyId, email, agency?.name ?? "Sales Progressor");
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "check") {
    return NextResponse.json(await checkAgencySingleSender(agencyId));
  }

  if (action === "resend") {
    const res = await resendAgencySingleSender(agencyId);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
