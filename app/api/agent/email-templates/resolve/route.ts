// GET /api/agent/email-templates/resolve?templateKey=&variant=
//
// Returns the effective Tier-2 email copy for this agency (their own version if
// any, else our default), plus our default for compare/reset. Director only;
// agencyId from the session (Law 7). Completion pack for now; more families add
// a case here.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { describeCompletionPack, type CompletionPackSide } from "@/lib/agency-email/templates";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const templateKey = p.get("templateKey");
  const variant = p.get("variant");

  if (templateKey === "completion_pack" && (variant === "vendor" || variant === "purchaser")) {
    const desc = await describeCompletionPack(session.user.agencyId, variant as CompletionPackSide);
    return NextResponse.json({ exists: true, source: desc.source, effective: desc.effective, base: desc.base });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
