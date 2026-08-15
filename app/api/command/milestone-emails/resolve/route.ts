// GET /api/command/milestone-emails/resolve?code=&side=&tenure=&method=
//
// Returns the email that WOULD send for a given step + side + scenario: the
// resolved copy (override or code default), a filled-in preview, and the base
// copy for compare/reset. Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { describeEffective, type CopySide, type Scenario } from "@/lib/services/milestone-copy-overrides";
import { renderPreview } from "@/lib/command/milestone-emails/preview";

const SIDES = new Set(["vendor", "purchaser", "vendorAgent", "progressor"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const code = p.get("code") ?? "";
  const side = p.get("side") ?? "";
  const tenure = p.get("tenure") === "leasehold" ? "leasehold" : "freehold";
  const method = p.get("method") === "cash" ? "cash" : "mortgage";

  if (!code || !SIDES.has(side)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const scenario: Scenario = { tenure, method };
  const desc = await describeEffective(code, side as CopySide, scenario);

  if (!desc.effective) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    source: desc.source,
    matchedTenure: desc.matchedTenure ?? null,
    matchedMethod: desc.matchedMethod ?? null,
    raw: desc.effective, // copy with {tokens} still in place (for editing)
    base: desc.base, // code default (for reset/compare)
    preview: renderPreview(desc.effective, code, scenario),
  });
}
