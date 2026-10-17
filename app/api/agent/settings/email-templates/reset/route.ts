// POST /api/agent/settings/email-templates/reset  { templateKey, variant }
//
// Removes THIS progression business's Tier-2 override so the email reverts to the
// Sales Progressor default. Owner-gated; the business counterpart to the agency
// reset route.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { resetBusinessTemplate } from "@/lib/agency-email/templates";

export async function POST(req: Request) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await resetBusinessTemplate(owner.businessId, String(b.templateKey ?? ""), String(b.variant ?? ""));
  if (!r.ok) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
