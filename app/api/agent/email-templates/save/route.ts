// POST /api/agent/email-templates/save  { templateKey, variant, content }
//
// Saves this agency's own Tier-2 email copy + writes the audit row. Director
// only; agencyId from the session (Law 7). Generic over the template registry;
// per-family validation lives in lib/agency-email/templates.ts.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveTemplate } from "@/lib/agency-email/templates";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const editor = { id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "" };

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await saveTemplate(session.user.agencyId, String(b.templateKey ?? ""), String(b.variant ?? ""), b.content, editor);
  if (!r.ok) {
    return NextResponse.json({ error: "Subject and body copy are required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
