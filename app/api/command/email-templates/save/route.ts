// POST /api/command/email-templates/save  { templateKey, variant, content }
//
// Saves Sales Progressor's own default for a Tier-2 email — the copy every
// agency inherits unless they override it. Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { savePlatformTemplate } from "@/lib/agency-email/templates";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await savePlatformTemplate(String(b.templateKey ?? ""), String(b.variant ?? ""), b.content, session.user.id);
  if (!r.ok) return NextResponse.json({ error: "Subject and body copy are required" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
