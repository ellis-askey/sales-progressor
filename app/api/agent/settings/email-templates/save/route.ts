// POST /api/agent/settings/email-templates/save  { templateKey, variant, content }
//
// Saves THIS progression business's own Tier-2 email copy. Owner-gated; the
// business counterpart to the agency save route. Per-family validation lives in
// lib/agency-email/templates.ts.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { saveBusinessTemplate } from "@/lib/agency-email/templates";

export async function POST(req: Request) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await saveBusinessTemplate(owner.businessId, String(b.templateKey ?? ""), String(b.variant ?? ""), b.content, session.user.id ?? null);
  if (!r.ok) return NextResponse.json({ error: "Subject and body copy are required" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
