// POST /api/agent/email-templates/reset  { templateKey, variant }
//
// Removes this agency's Tier-2 override so the email reverts to our default +
// writes the audit row. Director only; agencyId from the session (Law 7).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resetCompletionPack, type CompletionPackSide } from "@/lib/agency-email/templates";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const editor = { id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "" };

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const templateKey = String(b.templateKey ?? "");
  const variant = String(b.variant ?? "");

  if (templateKey === "completion_pack" && (variant === "vendor" || variant === "purchaser")) {
    await resetCompletionPack({ agencyId: session.user.agencyId, side: variant as CompletionPackSide, editor });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
