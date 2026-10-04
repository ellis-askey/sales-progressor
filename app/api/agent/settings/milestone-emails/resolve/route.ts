// GET /api/agent/settings/milestone-emails/resolve?code=&side=&tenure=&method=
//
// Progression-business counterpart of the agency resolve. Returns the client
// milestone email that would send on a file THIS business progresses: its own
// version if set, else the Sales Progressor default, else the built-in default,
// plus a preview and the copy a reset reverts to. Owner only; the businessId
// comes from the session (Law 7).

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { describeEffectiveForBusiness, type CopySide, type Scenario } from "@/lib/services/milestone-copy-overrides";
import { renderPreview } from "@/lib/milestone-emails/preview";

// Only client-facing copy (buyer + seller) is editable.
const CLIENT_SIDES = new Set(["vendor", "purchaser"]);

export async function GET(req: Request) {
  if (!progressionBusinessesEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = new URL(req.url).searchParams;
  const code = p.get("code") ?? "";
  const side = p.get("side") ?? "";
  const tenure = p.get("tenure") === "leasehold" ? "leasehold" : "freehold";
  const method = p.get("method") === "cash" ? "cash" : "mortgage";
  if (!code || !CLIENT_SIDES.has(side)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const scenario: Scenario = { tenure, method };
  const desc = await describeEffectiveForBusiness(code, side as CopySide, scenario, owner.businessId);
  if (!desc.effective) return NextResponse.json({ exists: false });

  return NextResponse.json({
    exists: true,
    source: desc.source,
    matchedTenure: desc.matchedTenure ?? null,
    matchedMethod: desc.matchedMethod ?? null,
    raw: desc.effective,
    base: desc.resetBase,
    preview: renderPreview(desc.effective, code, scenario),
  });
}
