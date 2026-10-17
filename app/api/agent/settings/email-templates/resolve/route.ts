// GET /api/agent/settings/email-templates/resolve?templateKey=&variant=
//
// Returns the effective Tier-2 email copy for THIS progression business (their
// own version if any, else our platform default) + the default for compare/reset.
// Owner-gated (resolveBusinessOwner); the business counterpart to the agency
// /api/agent/email-templates/resolve route. Generic over the template registry.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { describeBusinessTemplate } from "@/lib/agency-email/templates";

export async function GET(req: Request) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = new URL(req.url).searchParams;
  const desc = await describeBusinessTemplate(owner.businessId, p.get("templateKey") ?? "", p.get("variant") ?? "");
  if (!desc) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json(desc);
}
