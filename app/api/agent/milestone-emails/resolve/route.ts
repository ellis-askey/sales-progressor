// GET /api/agent/milestone-emails/resolve?code=&side=&tenure=&method=
//
// Agency-facing counterpart of the Command Centre resolve. Returns the email
// that would send FOR THIS AGENCY for a step + side + scenario: the effective
// copy (the agency's own version if any, else the Sales Progressor default,
// else the built-in default), a filled-in preview, and the copy a reset would
// revert to. Director only; the agencyId comes from the session (Law 7).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { describeEffectiveForAgency, type CopySide, type Scenario } from "@/lib/services/milestone-copy-overrides";
import { renderPreview } from "@/lib/milestone-emails/preview";

// Agencies may only edit client-facing copy (buyer + seller). Seller's-agent
// and internal/progressor copy stay ours.
const CLIENT_SIDES = new Set(["vendor", "purchaser"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const code = p.get("code") ?? "";
  const side = p.get("side") ?? "";
  const tenure = p.get("tenure") === "leasehold" ? "leasehold" : "freehold";
  const method = p.get("method") === "cash" ? "cash" : "mortgage";

  if (!code || !CLIENT_SIDES.has(side)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const scenario: Scenario = { tenure, method };
  const desc = await describeEffectiveForAgency(code, side as CopySide, scenario, session.user.agencyId);

  if (!desc.effective) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    source: desc.source,
    matchedTenure: desc.matchedTenure ?? null,
    matchedMethod: desc.matchedMethod ?? null,
    raw: desc.effective, // copy with {tokens} still in place (for editing)
    base: desc.resetBase, // what "Reset to Sales Progressor" reverts to
    preview: renderPreview(desc.effective, code, scenario),
  });
}
